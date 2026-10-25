# Arquitetura

Como o sistema foi construído: serviços, dados, chamadas, regras, eventos, sessão, modo offline e implantação. O porquê de cada escolha está em [`DECISIONS.md`](../../../DECISIONS.md) (citado como D*n*) e as interpretações do enunciado em [`ASSUMPTIONS.md`](../../../ASSUMPTIONS.md) (A*n*). Para saber **onde está cada coisa no código**, veja [`CODE_MAP.md`](CODE_MAP.md). Os diagramas estão em [`../diagrams/`](../diagrams/); este texto só aponta para eles.

## 1. Visão geral e serviços

Um frontend com BFF e quatro serviços, mais três peças de infraestrutura. Diagrama: [Topologia dos serviços](../diagrams/service-topology.md).

| Pasta (`repositories/`) | Responsabilidade | Portas | Schema | Fala com |
|---|---|---|---|---|
| `web` | Nuxt: telas e BFF. Dono da sessão (Redis) e do cookie. Única entrada do navegador | 3000 (no computador: 8080) | — | todos os serviços por HTTP |
| `identity-api` | Supervisores, vendedores, clientes (carteira), tabela de preço do cliente (com fallback), limites de alçada e de crédito, reservas de crédito | 3001, gRPC 50051 | `identity` | servidor gRPC; consome `order.placed` e `order.rejected` |
| `catalog-api` | Produtos, tabelas de preço, busca (`pg_trgm` + `unaccent`), regras de embalagem, produtos indisponíveis, estatística de mais pedidos | 3002, gRPC 50052 | `catalog` | servidor gRPC; consome `order.submitted` |
| `orders-api` | Todas as regras do pedido: cálculo, bloqueios, alçada, mínimo, crédito, envio, aprovação, histórico, repetir pedido | 3003 | `orders` | cliente gRPC de catalog e identity; publica os eventos |
| `notifications-api` | Avisos a vendedores e supervisores (lista, lidos, resolvidos) e o fluxo SSE que avisa a tela | 3004 | `notifications` | consome os quatro eventos |
| `contracts` | Arquivos `.proto` e esquemas Zod dos eventos, instalado pelos serviços como pacote local (D26) | — | — | — |
| `orchestration` | Gráficos Helm, cluster kind, scripts (seção 10) | — | — | — |

Infraestrutura: **PostgreSQL** (um schema e um papel por serviço), **RabbitMQ** (eventos) e **Redis** (sessões). Hoje tudo é uma pasta de um repositório só; a divisão em repositórios por serviço, com este como guarda-chuva, está planejada (D9) e não foi feita.

## 2. Dados

Cada serviço é dono de um schema e de um papel (`<serviço>_role`) que só enxerga o próprio schema. **Não há consulta entre schemas** nem chave estrangeira entre serviços. O `orders` não guarda cópia de dados de outros serviços: cada item leva só o instantâneo (descrição, SKU, preço) do momento do envio. Diagrama: [Dono dos dados](../diagrams/data-ownership.md).

- **Dinheiro** é inteiro em centavos e **desconto** é inteiro em pontos-base (5% = 500). O `seed.json` tem reais com vírgula: a conversão é feita na importação (D8, D25).
- **Migrações** com `drizzle-kit`, aplicadas na partida do serviço; as tabelas não levam o nome do schema, que vem do `search_path` da conexão (por isso os testes rodam em `<serviço>_test`).
- **Semente:** cada serviço importa a própria fatia do `seed.json` na partida, de forma idempotente: identity (supervisores, vendedores, clientes), catalog (produtos e tabelas), orders (pedidos do histórico, com `origin = IMPORTED`).
- Restrições únicas no banco garantem as regras de unicidade (o id do pedido, `counted_orders`, o aviso por pedido+pessoa+tipo).

## 3. Comunicação

Diagrama do envio: [Envio de um pedido](../diagrams/submit-order-flow.md).

- **Navegador → web:** só o BFF recebe o navegador. Cookie de sessão opaco; a sessão fica no Redis (seção 8).
- **BFF → serviços:** HTTP/JSON. Cada chamada leva o segredo interno (`x-inner-auth`) e o usuário e o papel da sessão (`x-user-id`, `x-user-role`). Os serviços só aceitam chamadas com o segredo.
- **orders → catalog e identity:** gRPC, em lote, para o que precisa estar correto na hora (preço e regras de embalagem; cliente, vendedor, limites e crédito). O cálculo e o envio usam as mesmas chamadas.
- **Cálculo sem estado:** `POST /orders/calculate` não grava nada; a tela o chama depois de cada edição e **nunca calcula dinheiro** (D4, D20, D33).
- **Envio idempotente:** `POST /orders` leva um `orderId` gerado pelo cliente; o mesmo id devolve o pedido já salvo, sem recalcular nem publicar de novo (D33). Esta é a base do reenvio seguro no modo offline.
- **Eventos:** só o `orders` publica (seção 6).

## 4. Ciclo de vida do pedido

Seis status em duas cadeias. Diagrama: [Ciclo de vida do pedido](../diagrams/order-status.md).

- **Dentro da alçada** o pedido nasce `SUBMITTED` ("Enviado"); **fora**, `AWAITING_APPROVAL` ("Aguardando aprovação").
- **Aprovar** leva `AWAITING_APPROVAL → APPROVED → SUBMITTED` em uma transação; **rejeitar** leva `AWAITING_APPROVAL → REJECTED → CANCELLED`. `order_status_history` guarda cada passo.
- `INVOICED` ("Faturado") seria posto por um faturamento que não existe aqui: só os pedidos importados do seed o têm (D47).
- As decisões são funções puras em `order-status.ts` (`decideApprove`, `decideReject`); o banco aplica a mudança com `UPDATE ... WHERE status = 'AWAITING_APPROVAL'`, então duas decisões simultâneas resultam em uma.
- **Rejeitar exige um motivo** de uma lista fixa (`DISCOUNT_TOO_HIGH`, `CREDIT_RISK`, `PRODUCT_OR_QUANTITY`, `ORDER_DATA_WRONG`, `OTHER`); `OTHER` exige um texto (D44).
- **Alçada:** o limite do vendedor é conferido em cada linha e no pedido; o efetivo é o menor entre o do vendedor e `MAX_DISCOUNT_BP` (D32).

## 5. Reserva de crédito

O identity é dono do crédito. Diagrama: [Reserva de crédito](../diagrams/credit-reservation.md).

A tabela `credit_reservations` guarda, por pedido: `order_id` (chave primária), `client_id`, `amount_cents`, `status` (`PENDING`, `CONFIRMED`, `RELEASED`) e `expires_at`. O crédito comprometido é **calculado**, não guardado em um contador:

> em uso = crédito já usado (do seed) + reservas `CONFIRMED` + reservas `PENDING` que ainda não expiraram
> disponível = limite − em uso

1. **Cálculo:** o orders consulta o cliente por gRPC e bloqueia com `CREDIT_EXCEEDED` se o total passar do disponível. É uma checagem de aviso, para a tela mostrar o motivo.
2. **Envio:** `ReserveCredit(clientId, orderId, valor)`. Numa transação, o identity trava a linha do cliente (`SELECT ... FOR UPDATE`), soma o que está em uso e grava a reserva `PENDING` com `expires_at = agora + TTL` (`RESERVATION_TTL_SECONDS`, 900), ou recusa. Duas reservas do mesmo cliente são decididas uma depois da outra.
3. **Gravação:** o orders grava o pedido; se falhar, chama `ReleaseCredit`.
4. **Confirmação:** `order.placed` torna a reserva `CONFIRMED` (se já tinha expirado ou não existia, o consumidor a cria `CONFIRMED`, então o crédito sempre reflete os pedidos que existem).
5. **Rejeição:** `order.rejected` torna a reserva `RELEASED`; um evento repetido não a revive.
6. **Expiração sem tarefa agendada:** uma reserva `PENDING` deixa de contar quando `expires_at` passa. Não há job.
7. **Repetição:** o mesmo `orderId` devolve a reserva existente.

Razões: D22, D40 a D43.

## 6. Eventos e filas

O orders publica no exchange `orders.events` (topic). Diagrama: [Eventos e filas](../diagrams/events.md).

| Evento | Consumidores | O que fazem |
|---|---|---|
| `order.placed` | identity | confirma a reserva de crédito (`PENDING` para `CONFIRMED`) |
| | notifications | avisa o supervisor (pede decisão) e o vendedor se o pedido aguarda aprovação |
| `order.submitted` | notifications | avisa vendedor e supervisor que o pedido foi enviado |
| | catalog | soma as unidades do pedido por produto, uma vez por pedido; a busca usa o total para desempatar (D52, D53) |
| `order.approved` | notifications | avisa o vendedor e resolve os avisos que esperavam a decisão |
| `order.rejected` | identity | libera o crédito |
| | notifications | avisa o vendedor (pedido cancelado, com o motivo) e resolve os avisos pendentes |

- **Carga:** todo evento leva pedido, vendedor, supervisor, cliente, nome do cliente e total (`OrderRefShape` em `contracts`), para o consumidor não chamar outro serviço. O Nest embrulha a carga como `{ pattern, data }`.
- **Filas:** uma por consumidor (`<serviço>-api-order-events`), *quorum*, com limite de entregas (`CONSUMER_MAX_DELIVERIES`, 5, ou seja, 6 tentativas) e `.dlq` (D42). Mensagem que não bate com o esquema vai direto para a `.dlq`; mensagem que falha volta com espera crescente (0,5 s, 1 s, 2 s, 4 s, 8 s). Ao renomear um evento, `retireBindings` remove a ligação antiga na partida (D46).
- **Idempotência:** identity pela reserva do pedido; catalog por `counted_orders` (marca e soma na mesma transação); notifications por (pedido, pessoa, tipo).
- **Sem outbox:** se o RabbitMQ estiver fora no envio, o evento se perde (D34). A fila de mortas não tem ferramenta de reprocessamento.

## 7. Notificações

Diagrama: [Avisos em tempo real](../diagrams/notifications-sse.md). O notifications guarda um aviso por (pedido, pessoa, tipo), com `read_at` e `resolved_at`. Quem recebe o quê (D49):

| Evento | Supervisor | Vendedor |
|---|---|---|
| `order.placed`, aguardando aprovação | `APPROVAL_NEEDED` | `ORDER_AWAITING_APPROVAL` |
| `order.placed`, dentro da alçada | nada | nada (o `order.submitted` seguinte avisa) |
| `order.submitted` | `ORDER_SENT` | `ORDER_SENT` |
| `order.approved` | — | `ORDER_APPROVED` |
| `order.rejected` | — | `ORDER_CANCELLED`, com o motivo |

A decisão do supervisor **resolve** os avisos `APPROVAL_NEEDED` e `ORDER_AWAITING_APPROVAL` do pedido (continuam na lista, esmaecidos). O fluxo SSE só diz `changed` (e `ping` a cada 25 s); a tela pede a lista de novo (D50, D51). O difusor mora no processo: com mais de uma réplica, precisaria de um corretor entre elas.

## 8. Sessão e BFF

1. A tela de entrada lista vendedores e supervisor (BFF → identity); o login é simulado (D11, D16, D36).
2. Ao escolher, o BFF pede ao identity para validar, cria a sessão no Redis (TTL de 8 horas) e devolve um cookie `HttpOnly` com o id opaco.
3. A cada requisição o BFF lê a sessão e repassa usuário e papel aos serviços; sem sessão, `/api/*` responde 401 (exceto saúde, opções e login).
4. Só JSON: um corpo com outro tipo de conteúdo recebe 415.
5. Cada papel só abre as próprias páginas (vendedor: `/clients`, `/orders`; supervisor: `/supervisor`, `/approvals`). O vendedor nunca vê clientes de outro.
6. O segredo interno vive em `runtimeConfig` privado do Nuxt, nunca no pacote do navegador, em resposta ou em log.

## 9. Modo offline

Diagrama: [Pedido sem sinal](../diagrams/offline-sync.md). Razões: D54 a D56.

- **O app abre sem sinal:** um service worker (`@vite-pwa/nuxt`, só na versão de produção) guarda os arquivos do app e a última resposta de três leituras (`/api/auth/me`, `/api/clients`, `/api/clients/:id`).
- **"Sem sinal"** quer dizer "o servidor não respondeu": uma chamada que falha ou passa de 8 s desliga o estado `online`; uma sonda em `/api/health` a cada 5 s o religa (`useConnectivity`, `web/app/plugins/offline.client.ts`).
- **Sem sinal a tela** não calcula nem busca: mostra o último cálculo marcado "desatualizado" e procura só entre os produtos já vistos para aquele cliente (`web/app/stores/seen-products.ts`, até 300).
- **"Guardar para enviar"** põe o pedido na fila (`web/app/stores/pending.ts`, `localStorage`) com o `orderId` com que será enviado.
- **Envio:** automático, quando o servidor volta e a cada 15 s enquanto houver pedido esperando, um por vez (`usePendingSync`). Sem resposta, 5xx ou sessão encerrada: a rodada para e o pedido continua esperando. 422 ou outra recusa: o pedido fica em "Pedidos pendentes" com os motivos do servidor, para corrigir ou descartar.
- **De quem é a fila:** do vendedor que a fez. Entrar e sair apaga o cache do service worker, os produtos vistos e o cache do TanStack Query, mas **não** os pedidos guardados. Sair sem sinal é recusado.

## 10. Implantação

**Docker Compose** (`docker-compose.yml` na raiz): três de infraestrutura, quatro serviços, o `web` (única porta publicada, 8080) e um volume do PostgreSQL. `docker-compose.dev.yml` publica portas só em loopback para depuração (catalog 13002/15052, identity 13001/15051, orders 13003, notifications 13004, painel do RabbitMQ 15672, PostgreSQL 5432, Redis 6379). `scripts/init-env.sh` gera o `.env` com senhas aleatórias.

**Kubernetes** (`repositories/orchestration`, D57 a D59). Diagrama: [Implantação em Kubernetes](../diagrams/kubernetes-deployment.md).

- Gráfico `umbrella` (instala tudo, mais o Ingress e a política "negar tudo"), gráfico de biblioteca `sales-lib` (Deployment, Service e NetworkPolicy comuns), um gráfico por serviço em `<serviço>/k8s` e gráficos escritos à mão para PostgreSQL, RabbitMQ e Redis.
- Cluster kind de um nó, **Calico** (que aplica as políticas de rede) e **Traefik** como ingress (o ingress-nginx foi aposentado).
- **Negar tudo, entrada e saída**, e abrir só os caminhos necessários; o `orders` fala com catalog e identity só por gRPC.
- Pods sem root, sem capacidades, com sistema de arquivos somente leitura (exceto o RabbitMQ); senhas geradas ao acaso num Secret; o seed e o script do banco chegam por ConfigMap.
- As imagens são construídas na máquina e carregadas no kind; uma réplica de tudo; sem TLS (D59).

## 11. Segurança

- **Segredo interno** (`x-inner-auth`, mínimo de 16 caracteres) exigido por todos os serviços, em HTTP e em gRPC; fica só no servidor.
- **Um papel de banco por serviço**, sem acesso ao schema dos outros; senhas por ambiente, nunca no repositório (`.env.example` sem valores).
- **O vendedor só enxerga a própria carteira** (filtro no identity pelo vendedor da sessão); o pedido de outro vendedor responde como inexistente.
- **Validação** com Zod na borda de cada serviço (formato) e as regras de negócio só no orders.
- **Logs** estruturados, sem corpo de requisição.
- **Sem TLS**, de propósito, em ambiente local (D59); a opção `NUXT_SESSION_COOKIE_SECURE` já existe para quando houver HTTPS.

## 12. Quem faz o quê nas regras

| Regra | Dono |
|---|---|
| Carteira (vendedor só vê seus clientes) | identity (filtro por vendedor da sessão) |
| Fallback da tabela de preço do cliente | identity |
| Reserva e liberação de crédito | identity |
| Preço por tabela, embalagem, busca, produtos indisponíveis | catalog |
| Totais, desconto, arredondamento, alçada, pedido mínimo, crédito disponível, status, idempotência do envio | orders |
| Aprovação e rejeição pelo supervisor | orders (com o papel vindo do BFF) |
| Quem é avisado de quê | notifications (`plan.ts`) |
| Mostrar, nunca calcular | web |
