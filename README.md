# Montagem de pedidos para vendedores externos

Módulo para vendedores que visitam pequenos varejistas (mercadinhos, minimercados, conveniências), consultam o catálogo e fecham o pedido no cliente, muitas vezes com sinal ruim. O enunciado original está em [`repositories/documentation/context/SCOPE.md`](repositories/documentation/context/SCOPE.md).

A documentação completa (contexto, arquitetura, diagramas, mapa do código, testes, operação, pendências) está em [`repositories/documentation/`](repositories/documentation/README.md). Este arquivo tem o que o enunciado pede: como rodar, como testar e o que ficou de fora.

## Estado atual

Todas as fases estão prontas e funcionam em Docker Compose; a fase D também roda num cluster Kubernetes local.

| Fase | Conteúdo | Estado |
|---|---|---|
| A | Requisitos obrigatórios 1 a 6 | Pronta: catálogo, identity, orders (regras e testes) e interface (Nuxt) |
| B | Crédito, aprovação do supervisor, histórico com "repetir pedido", avisos, estatística de mais pedidos | Pronta |
| C | Pedido offline com sincronização | Pronta: o app abre sem sinal, o pedido fica guardado no aparelho e é enviado quando o sinal volta (`DECISIONS.md` D54 a D56) |
| D | Orquestração (Helm, kind, ingress) | Pronta no cluster local (kind, Calico, Traefik, políticas de rede verificadas); falta publicar as imagens e dividir os repositórios (D57 a D59) |

## Como rodar

Pré-requisitos: Docker com Compose e acesso à internet (a primeira vez baixa as imagens base e constrói as cinco imagens, o que demora).

```bash
git clone <url-do-repositório>
cd <pasta>
sh scripts/init-env.sh      # cria o .env com senhas aleatórias (nada de segredo no repositório)
docker compose up --build
```

Abra `http://localhost:8080` e escolha uma pessoa (Carlos Menezes, Paulo Andrade ou Renata Lima, vendedores; Marta Fernandes, supervisora). É o único serviço com porta publicada; os demais ficam na rede interna.

Em Kubernetes (kind, Helm, Calico e Traefik; precisa de `docker`, `kind`, `kubectl`, `helm` e `openssl`):

```bash
cd repositories/orchestration
./scripts/up.sh && ./scripts/verify.sh     # depois, http://localhost:8080; ./scripts/down.sh apaga tudo
```

Pare o Compose antes (a porta 8080 é a mesma). Os detalhes e os problemas comuns estão em [`GETTING_STARTED.md`](repositories/documentation/getting-started/GETTING_STARTED.md).

## Como testar

Cada serviço tem os próprios testes (Vitest), dentro da pasta dele, com Node 24 e `corepack pnpm`:

```bash
cd repositories/orders-api          # ou catalog-api, identity-api, notifications-api, contracts, web
corepack pnpm install
corepack pnpm test
```

Os testes que usam o banco só rodam com `TEST_DATABASE_URL` apontando para o PostgreSQL do compose; sem ela, são pulados (`docker compose up -d postgres` e a variável, como está em [`TESTING.md`](repositories/documentation/testing/TESTING.md)). São 502 testes ao todo. Os das regras cobrem os casos de borda: desconto exatamente na alçada, pedido de R$ 299,99 contra R$ 300,00, quantidade fora do múltiplo da embalagem, crédito disponível igual ao total e os exemplos de arredondamento de [`ASSUMPTIONS.md`](ASSUMPTIONS.md).

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [`DECISIONS.md`](DECISIONS.md) | Decisões: contexto, alternativas, escolha, por quê e o que faria diferente |
| [`ASSUMPTIONS.md`](ASSUMPTIONS.md) | Ambiguidades e interpretações adotadas |
| [`AI_LOG.md`](AI_LOG.md) | Uso de IA e mapa de autoria |
| [`repositories/documentation/`](repositories/documentation/README.md) | Contexto, arquitetura, diagramas, mapa do código, como rodar, testes, operação e pendências; o guia de estilo |
| `CLAUDE.md` | Instruções para a IA que trabalha no projeto |

## O que ficou de fora

**Verificação**

- A tela foi conferida num navegador de computador e numa moldura de 390 px de largura (uma aproximação de celular: sem rolagem horizontal, grade de duas colunas, barra de totais fixa); **não foi testada em um aparelho real**.
- Os caminhos de erro da tela do pedido foram exercitados com **falhas simuladas** (a chamada de rede interceptada na própria página): recusa do envio (422), falha de rede ao enviar (o reenvio usa o mesmo id e conclui) e cálculo indisponível. Contra o backend de verdade, a recusa só foi exercitada por testes e por chamadas à API.
- Não há testes de componente do front nem testes ponta a ponta automatizados; a lógica testada está no motor de regras, nos serviços, nas stores, nos utilitários e no BFF.
- **Um clone limpo com `docker compose up --build` ainda não foi conferido** nesta versão do repositório.
- Os fluxos de CI (testes e publicação de imagens no GHCR) estão escritos, **mas nunca rodaram no GitHub**; os gráficos Helm não passam por lint no CI.

**Sistema**

- A publicação dos eventos não usa outbox: se o RabbitMQ estiver fora no envio, o evento se perde (e com ele um aviso ou uma confirmação de crédito, que a reserva só recupera pela expiração). Não há ferramenta para reprocessar mensagens mortas.
- Os avisos em tempo real (SSE) são difundidos no processo do notifications: com mais de uma réplica, precisariam de um corretor entre elas.
- **Modo offline:** verificado em Chrome de computador, parando o servidor da interface para simular a falta de sinal; **não testado num celular real** nem com sinal fraco de verdade (a regra de 8 segundos tem teste de lógica, não medição). O service worker só existe na versão de produção (a imagem Docker). Os pedidos guardados ficam no `localStorage`, que o usuário pode apagar, e só são enviados com o app aberto. Não há ícones para instalar o app na tela inicial.
- **Kubernetes:** as imagens são construídas na máquina e carregadas no kind (não passam por um registry); uma réplica de cada serviço; sem TLS (de propósito, D59), sem escala automática, sem cópia de segurança do volume do banco; os limites de recursos são estimativas. A interface não foi conferida no navegador dentro desse cluster (só pela API, incluindo o fluxo de avisos pelo ingress).
- Hoje o sistema é um repositório com os serviços em pastas; a divisão em repositórios por serviço, com este como guarda-chuva e submódulos (D9), não foi feita.

**Fora do escopo do enunciado:** estoque, autenticação real (o login é simulado), notificações externas, várias moedas, faturamento.
