# Guia de estudo

Oito aulas curtas sobre as partes do código em que está o raciocínio do sistema, cada uma com três perguntas de autoteste e o gabarito com o porquê. Foram dadas em sessões guiadas com a IA em 25/10/2026 e estão aqui para serem relidas e refeitas. **Este guia não substitui ler o código:** cada aula aponta os arquivos para a leitura própria, que é o passo seguinte (veja [`PENDINGS.md`](../pendings/PENDINGS.md)).

Os caminhos são relativos a `repositories/` (daqui, `../../<pasta>`). Para o mapa geral do código, veja [`CODE_MAP.md`](../architecture/CODE_MAP.md); as razões das decisões estão em [`DECISIONS.md`](../../../DECISIONS.md) (D*n*) e [`ASSUMPTIONS.md`](../../../ASSUMPTIONS.md) (A*n*).

| # | Aula | Arquivos |
|---|---|---|
| 1 | Arredondamento | `orders-api/src/modules/orders/domain/order-rules.ts` |
| 2 | O motor de regras (`calculateOrder`) | o mesmo |
| 3 | O ciclo de status | `orders-api/src/modules/orders/domain/order-status.ts`, `orders-api/src/modules/orders/repository/orders.repository.ts` |
| 4 | Crédito | `identity-api/src/modules/people/rules.ts`, `identity-api/src/modules/people/repository/people.repository.ts` |
| 5 | Quem é avisado de quê | `notifications-api/src/modules/notifications/domain/plan.ts` |
| 6 | O fluxo do BFF | `web/server/` |
| 7 | O código offline | `web/app/utils/connectivity.ts`, `web/app/stores/pending.ts`, `web/app/composables/` |
| 8 | O envio que não duplica | `orders-api/src/modules/orders/services/orders.service.ts`, `orders-api/src/modules/orders/repository/orders.repository.ts`, `web/app/stores/order.ts` |

---

## 1. Arredondamento

**O problema.** O dinheiro está em **centavos inteiros** e o desconto em **pontos-base** (5% = 500). Mas `preço × quantidade × (1 − desconto)` quase sempre dá fração de centavo, e alguém precisa decidir **onde** arredondar. Há três jeitos, e cada um dá centavos diferentes.

Linha A do exemplo 1 de `ASSUMPTIONS.md` (15 un × R$ 7,49, desconto de 5%):

| Método | O que arredonda | Conta da linha A | Resultado |
|---|---|---|---|
| **1. Cada linha, uma vez** (o do projeto) | o total da linha | 112,35 × 0,95 = 106,7325, arredondado: **106,73** | as linhas somam o subtotal |
| **2. O preço unitário com desconto** | o preço de 1 unidade | 7,49 × 0,95 = 7,1155, arredondado: 7,12; × 15 = **106,80** | o erro de 1 unidade é multiplicado pela quantidade |
| **3. Só o total do pedido** | nada nas linhas | linhas "exatas" 106,7325; soma arredondada no fim | as linhas mostradas podem não somar ao total |

No exemplo 1, o método 1 dá **237,22** e o método 2 dá **237,29**.

**Por que o método 1.**
1. O que a tela mostra fecha: cada linha é um valor real em centavos e a soma das linhas é o subtotal (exemplo 2: 9,41 + 9,41 = 18,82; no método 3 as linhas mostrariam 9,41 + 9,41, e o total seria 18,81).
2. Não multiplica erro (no método 2, o arredondamento de 1 unidade vira diferença de várias unidades).
3. O mínimo de R$ 300 depende disso (exemplo 3): duas linhas A mais uma de 86,50. Método 1: 106,73 + 106,73 + 86,50 = **299,96**, bloqueado. Método 2: **300,10**, liberado. O mesmo pedido, com vereditos diferentes.

**No código.**
```ts
export function divideRoundHalfUp(numerator, denominator) {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));   // só inteiros
}
// linha:  netCents = divideRoundHalfUp(grossCents * (10000 - discountBp), 10000)
// pedido: orderDiscountCents = divideRoundHalfUp(subtotalCents * orderDiscountBp, 10000)
```
Linha A com inteiros: `grossCents = 749 × 15 = 11235`; `11235 × 9500 = 106.732.500`; dividido por 10.000 dá 10673,25, que vira **10673 centavos = R$ 106,73**. O truque `(2n + d) / 2d` faz o "meio" subir (940,5 centavos vira 941). O desconto do pedido segue a mesma regra, sobre a **soma das linhas já arredondadas** (exemplo 4: 23.722 × 200 / 10.000 = 474,44, que vira 474; total 232,48).

### Autoteste 1
1. Duas linhas iguais: 10 un × R$ 0,99, cada uma com 5% de desconto (exato: 9,405 cada). Qual o subtotal pelo método 1? (a) 18,81 (b) 18,82 (c) 18,80 (d) 9,41
2. No exemplo 3 o pedido dá 299,96 (método 1, bloqueado) e 300,10 (método 2, liberado). Por quê?
   (a) o método 1 aplica o desconto duas vezes; (b) o método 2 arredonda o preço de 1 unidade (7,1155 vira 7,12) e a quantidade multiplica esse arredondamento; (c) o mínimo é medido antes do desconto no método 1; (d) um dos dois tem erro de conta.
3. O que faz `divideRoundHalfUp(n, d)`? (a) divide em ponto flutuante e usa `toFixed(2)`; (b) divide e arredonda sempre para baixo; (c) divide só com inteiros e arredonda para o mais próximo, com o meio subindo; (d) divide e arredonda sempre para cima.

**Gabarito 1.** (1) **b**: cada linha vira 9,41 e a soma é 18,82. (2) **b**: 7,1155 vira 7,12 (0,0045 a mais por unidade) e 15 unidades multiplicam isso, cerca de 7 centavos por linha; nenhum método tem "erro de conta", são regras diferentes. (3) **c**: `(2n + d) / 2d` com piso é arredondamento do meio para cima só com inteiros.

---

## 2. O motor de regras (`calculateOrder`)

`order-rules.ts` é **uma função pura**: recebe dados (itens, produtos, política) e devolve um resultado, sem banco nem rede. A ordem do que faz:

1. **Cada linha** (`calculateLine`): confere produto (existe? ativo? tem preço?), quantidade (`toUnits`: embalagem, múltiplos, tamanho máximo), desconto válido e produto repetido. Se tudo está certo, calcula `netCents` (aula 1). Uma linha com problema **fica fora do total** e registra um `blocker`.
2. **Subtotal** = soma dos `netCents`.
3. **Desconto do pedido** sobre o subtotal, arredondado uma vez; **total** = subtotal − desconto.
4. **Bloqueios do pedido** (`blockers`): vazio; desconto do pedido inválido; **`total < mínimo`** (R$ 299,99 bloqueia, R$ 300,00 passa); **`total > crédito disponível`** (exatamente o crédito que sobra passa).
5. **Motivos de aprovação** (`approvalReasons`): o desconto de cada linha e o do pedido são comparados **separadamente** com a alçada efetiva = o **menor** entre o limite do vendedor e o teto global (`MAX_DISCOUNT_BP`). `> limite` gera um motivo; `= limite` não.
6. **Resultado:** `canSubmit` = não há nenhum bloqueio; `status` = `AWAITING_APPROVAL` se houver algum motivo de aprovação, senão `SUBMITTED`.

**A ideia central (D32): bloqueio não é aprovação.**

| | Significa | Efeito |
|---|---|---|
| **Bloqueio** | uma regra não foi atendida (abaixo do mínimo, sem crédito, quantidade inválida...) | **não envia**, nem para aprovação |
| **Motivo de aprovação** | desconto acima da alçada | **envia**, mas fica "Aguardando aprovação" |

São duas listas separadas no resultado, e a tela mostra cada uma com o seu texto. Os testes de borda de `order-rules.spec.ts` têm o nome da regra: `allows exactly R$ 300.00`, `blocks R$ 299.99`, `allows an order of exactly the credit that is left`, `sends the order as submitted when the discount is exactly the limit`, `sends it for approval one basis point above the limit`.

### Autoteste 2
4. Alçada de 5% (500 pontos-base). Uma linha com 5% e outra com 5,01% (501); o total passa do mínimo e cabe no crédito. O que acontece? (a) o envio é bloqueado; (b) vai para "Aguardando aprovação" com um motivo (a linha de 5,01%); (c) vai para aprovação com dois motivos; (d) sai "Enviado", porque a média é 5,005%.
5. Crédito disponível R$ 500,00 e total do pedido R$ 500,00 exatos. O que a regra faz? (a) bloqueia com `CREDIT_EXCEEDED`; (b) libera: só bloqueia quando o total é maior que o disponível; (c) manda para aprovação.
6. Qual a diferença entre `blocker` e `approvalReason`? (a) nenhuma; (b) o blocker impede o envio, o approvalReason deixa enviar, mas o pedido espera a decisão do supervisor; (c) o blocker é só de linha e o approvalReason é só de pedido.

**Gabarito 2.** (4) **b**: a linha de exatamente 5% não conta (`= limite`); só a de 5,01% passa do limite, e o limite é conferido por linha, não pela média. (5) **b**: a comparação é `totalCents > availableCreditCents`. (6) **b**: `canSubmit` olha só os blockers e `status` olha só os approvalReasons.

---

## 3. O ciclo de status

```
AWAITING_APPROVAL → APPROVED → SUBMITTED → INVOICED
AWAITING_APPROVAL → REJECTED → CANCELLED
```
O pedido **nasce** `SUBMITTED` (dentro da alçada) ou `AWAITING_APPROVAL` (fora). Só o `AWAITING_APPROVAL` tem decisão. A decisão percorre **dois degraus de uma vez**: aprovar = `APPROVED` e `SUBMITTED`; rejeitar = `REJECTED` e `CANCELLED`. Os dois ficam em `order_status_history`, mas o pedido **descansa** em `SUBMITTED` ou `CANCELLED`.

**Duas camadas.**
1. **Função pura** (`decideApprove`, `decideReject`): recebe o status e responde o que é permitido: `apply` (com os degraus), `already` (repetição, não é erro) ou `refused` (com o motivo).
2. **Banco** (`applyApproval`, `applyRejection`): `UPDATE ... WHERE status = 'AWAITING_APPROVAL'` numa transação. Se a linha já não estava nesse status, nada muda (`moved.length === 0`) e devolve `false`. Essa é a **garantia final** quando duas pessoas decidem ao mesmo tempo: só uma altera a linha.

**O `wasApproved`.** Os estados finais parecem iguais: `SUBMITTED` pode ser um pedido que nasceu dentro da alçada ou um que foi aprovado. Aprovar de novo o que foi aprovado é repetição; "aprovar" o que nunca esteve aguardando é recusa (`NOT_AWAITING_APPROVAL`). O `wasApproved`, que vem do histórico, distingue os dois (e `wasRejected` faz o mesmo para `CANCELLED`).

**Dois fatos que costumam surpreender (confira no código).**
- `REJECTED` é **sempre** seguido de `CANCELLED`, na mesma transação (`applyRejection` grava as duas linhas de histórico).
- `INVOICED` **não** vem depois de `SUBMITTED` para pedidos criados no sistema: nenhum código de produção o grava. Ele existe para guardar o "Faturado" do seed; faturar seria ação de um sistema de faturamento que não existe aqui. Gravá-lo junto de `SUBMITTED` foi considerado e descartado (D47): todo pedido novo apareceria como "Faturado" ao nascer, e a regra manda ficar "Enviado".

### Autoteste 3
7. Um pedido nasceu dentro da alçada (foi direto para `SUBMITTED`, sem decisão) e o supervisor tenta aprová-lo. O que `decideApprove` devolve? (a) `already`; (b) `refused` com `NOT_AWAITING_APPROVAL`; (c) `apply`.
8. Dois supervisores clicam em "Rejeitar" ao mesmo tempo. Quem garante que a rejeição acontece uma vez? (a) a função pura `decideReject`; (b) o `UPDATE ... WHERE status = 'AWAITING_APPROVAL'`: só um altera a linha; (c) o botão desabilitado no navegador.
9. Depois que o supervisor aprova, em que status o pedido fica e o que o histórico guarda? (a) `APPROVED`, só `APPROVED`; (b) `SUBMITTED`, com `APPROVED` (pelo supervisor) e `SUBMITTED` (pelo sistema); (c) `INVOICED`, com três passos.

**Gabarito 3.** (7) **b**: `wasApproved` é falso, então não é repetição. (8) **b**: as duas leem o status antes de qualquer uma gravar; o `WHERE` do `UPDATE` é o árbitro. (9) **b**.

---

## 4. Crédito

**A conta é calculada, nunca guardada.**
```
em uso     = crédito já usado (do seed) + reservas CONFIRMED + reservas PENDING que ainda não expiraram
disponível = limite − em uso
```
Não há contador que alguém atualize: há uma **tabela de reservas** (`credit_reservations`, uma por pedido) e a conta é refeita a cada vez. Funções puras de `rules.ts`: `isHolding` (`CONFIRMED` conta sempre; `PENDING` só até `expiresAt`; `RELEASED` nunca), `creditInUseCents`, `fitsInCredit` (`valor <= limite − emUso`, ao centavo).

**A corrida que a reserva resolve.** Cliente com R$ 350 disponíveis e dois pedidos de R$ 300 enviados juntos. Se cada um só conferisse o disponível, os dois veriam R$ 350 e os dois passariam. O `calculate` da tela é só um aviso. A solução está em `reserve()`, numa **transação**: (1) `SELECT ... FOR UPDATE` na linha do **cliente**, que trava essa linha até o fim; (2) soma o que está em uso e confere se cabe; (3) grava a reserva `PENDING` com `expiresAt = agora + TTL` (900 s). Como a linha fica travada, **a segunda reserva espera a primeira** e já enxerga a reserva dela. O mesmo `orderId` de novo devolve a reserva existente.

**O ciclo.** `PENDING` → o evento `order.placed` a torna `CONFIRMED` → `order.rejected` a torna `RELEASED`. Se o evento nunca chegar, a `PENDING` **expira sozinha**, sem job, porque a conta olha `expiresAt`. `confirm()` cria a reserva `CONFIRMED` mesmo se ela expirou ou nunca existiu, e um evento repetido **não** ressuscita uma `RELEASED` (`setWhere` só atualiza `PENDING`).

### Autoteste 4
10. Cliente com R$ 350 e dois pedidos de R$ 300 ao mesmo tempo. O que garante que só um passa? (a) o `calculate` da tela; (b) o `SELECT ... FOR UPDATE` na linha do cliente; (c) um contador de crédito usado.
11. Uma reserva `PENDING` criada às 10:00, validade de 15 minutos, evento nunca chegou. Às 10:20 ela conta? (a) conta até um job apagá-la; (b) não conta: `isHolding` só considera `PENDING` até `expiresAt`, sem job; (c) conta, porque `PENDING` sempre conta.
12. Crédito disponível R$ 300,00, pedido de exatamente R$ 300,00, e o evento `order.placed` chega duas vezes. (a) bloqueia e o segundo evento cria outra reserva; (b) libera (`<=`) e o segundo evento não muda nada (já `CONFIRMED`, e o `orderId` é a chave); (c) libera e o segundo evento soma mais R$ 300.

**Gabarito 4.** (10) **b**: duas reservas do mesmo cliente são decididas uma depois da outra. (11) **b**. (12) **b**.

---

## 5. Quem é avisado de quê (`plan.ts`)

Cada evento vira um **plano**: os avisos a criar e, às vezes, "feche os que pediam uma decisão". São quatro funções puras (`planPlaced`, `planSubmitted`, `planApproved`, `planRejected`); o serviço só as executa.

| Evento | Supervisor | Vendedor | Fecha avisos? |
|---|---|---|---|
| `order.placed`, **aguardando aprovação** | `APPROVAL_NEEDED` | `ORDER_AWAITING_APPROVAL` | não |
| `order.placed`, **dentro da alçada** | nada | nada | não |
| `order.submitted` | `ORDER_SENT` | `ORDER_SENT` | não |
| `order.approved` | nada | `ORDER_APPROVED` | **sim** |
| `order.rejected` | nada | `ORDER_CANCELLED` (com o motivo) | **sim** |

**Por que não "um aviso por evento para cada um" (D49).** Um pedido dentro da alçada geraria dois "enviado" para o vendedor (o `placed` e o `submitted`), e o supervisor receberia aviso de um pedido que ele mesmo acabou de decidir.

**Resolver.** `APPROVAL_NEEDED` e `ORDER_AWAITING_APPROVAL` esperam algo; quando o pedido é decidido, `resolveOrderId` os marca como **resolvidos** (`resolved_at`): continuam na lista, esmaecidos. Só esses dois tipos fecham (`CLOSED_BY_A_DECISION`).

**Sem aviso repetido.** A tabela tem restrição única em (`order_id`, `recipient_id`, `kind`) e o insert usa `ON CONFLICT DO NOTHING`. O RabbitMQ entrega "pelo menos uma vez"; na segunda entrega o banco recusa a linha repetida e ninguém é avisado de novo.

### Autoteste 5
13. O pedido nasce dentro da alçada. Quantos avisos o vendedor recebe? (a) dois: `ORDER_AWAITING_APPROVAL` e `ORDER_SENT`; (b) um: `ORDER_SENT`, porque `planPlaced` devolve vazio fora de `AWAITING_APPROVAL`; (c) nenhum.
14. O supervisor aprova. O que acontece com o `APPROVAL_NEEDED` que ele recebeu antes? (a) é apagado; (b) continua na lista, resolvido (`resolved_at`) e esmaecido; avisos só de informação não fecham; (c) fica não lido para sempre.
15. O RabbitMQ entrega o mesmo `order.submitted` duas vezes. Por que não há dois `ORDER_SENT`? (a) o código guarda os ids vistos em memória; (b) restrição única em (pedido, pessoa, tipo) e `ON CONFLICT DO NOTHING`; (c) o RabbitMQ entrega exatamente uma vez.

**Gabarito 5.** (13) **b**. (14) **b**. (15) **b**: a idempotência é uma restrição do banco, não código esperto.

---

## 6. O fluxo do BFF

O servidor do Nuxt (Nitro) é a **única porta de entrada do navegador**. Faz três coisas: **sessão**, **validação de forma** e **repasse** aos serviços. Nenhuma regra de negócio está aqui.

**O caminho de `POST /api/orders`.**
1. **Dois middlewares** antes de qualquer rota: `auth.ts` (toda rota `/api/*` exige sessão, exceto saúde, opções de login, login e logout; lê o cookie `sid`, busca o usuário no Redis; sem sessão, **401**) e `json-only.ts` (requisição **com corpo** só passa com `content-type: application/json`; senão **415**; requisições sem corpo passam).
2. **A rota** valida só a **forma** com Zod (`SubmitOrderSchema`). Não decide nada: mínimo, crédito, quantidade válida são do `orders`.
3. **`backend()`** chama o serviço **como o usuário**: manda `x-inner-auth` (o segredo, que só o servidor conhece) e `x-user-id` / `x-user-role`, com tempo limite de 8 s.
4. **`mapUpstreamError`**: uma resposta **4xx do serviço passa sem mudança, com o corpo** (por exemplo o 422 com os motivos); qualquer outra coisa (serviço caído, demora, 5xx) vira **503**.

**A sessão (`session.ts`).** O navegador guarda só um **id aleatório de 256 bits** num cookie `HttpOnly`. O usuário mora no **Redis**, com validade de 8 horas que **renova a cada uso**. Nada sobre o usuário viaja no cookie, e o logout **apaga a sessão no servidor**. Há **um id novo a cada login** (um id plantado antes não serve). `SameSite=Lax` mais **só JSON** fecham a porta de um formulário vindo de outro site: o navegador envia um formulário sem pedir permissão, mas não envia JSON assim. O segredo interno está em `runtimeConfig` **privado**, nunca no pacote do navegador. Há ainda **defesa em dobro**: a rota de clientes recusa quem não é vendedor (403) e o `identity` confere de novo.

### Autoteste 6
16. Um site malicioso envia, em nome de um vendedor logado, um formulário HTML (`application/x-www-form-urlencoded`, com corpo) para `POST /api/orders`. O que acontece? (a) passa, porque o cookie vai junto; (b) é recusado com 415: só se aceita corpo em JSON e um formulário de outro site não envia JSON; (c) 401, porque o cookie nunca é enviado entre sites.
17. O que o navegador guarda e onde estão os dados do usuário? (a) um token assinado com os dados (como um JWT) no `localStorage`; (b) um id aleatório e sem significado num cookie `HttpOnly`, com os dados no Redis, com validade, e o logout os apaga no servidor; (c) o id do vendedor num cookie comum.
18. O `orders-api` responde 422 com os motivos; em outra tentativa, está fora do ar. O que o navegador recebe? (a) 422 com o mesmo corpo no primeiro caso e 503 "indisponível" no segundo; (b) 500 genérico nos dois; (c) 400 no primeiro e 502 no segundo.

**Gabarito 6.** (16) **b**. (17) **b**. (18) **a**: um 4xx do serviço passa sem mudança e o resto vira 503; o BFF não reescreve o veredito do serviço. Isso importa para a aula 7.

---

## 7. O código offline

**1. "Estou sem sinal?"** (`useApi`, `useConnectivity`, `web/app/plugins/offline.client.ts`). "Online" **não** é `navigator.onLine` (que diz "online" com uma barra de sinal e nada chegando); é "**o servidor respondeu**". Toda chamada passa por `useApi`, com **tempo limite de 8 s**: qualquer **resposta** (até um erro) liga `online`; uma chamada que **falha ou estoura** desliga. Offline, o plugin pergunta `GET /api/health` **a cada 5 s**, e a primeira resposta liga de novo.

**2. O que a tela faz sem sinal.** `queueMode = !online`: o botão vira "Guardar para enviar" e só exige pedido não vazio; o cálculo não é tentado e a tela mostra o último total marcado "desatualizado"; a busca procura só entre os produtos **já vistos** para o cliente.

**3. Guardar e enviar.** `queueOrder` põe o pedido na fila (`localStorage`) **com o `orderId` com que será enviado**, esvazia o rascunho e volta à lista. Mesmo online, `send` classifica a falha: se foi `OFFLINE`, **guarda na fila** em vez de mostrar erro, porque o pedido pode ou não ter chegado.

**4. A classificação (`classifyFailure`) e a rodada (`flush`).**

| O que chegou | Classe | O que o `flush` faz |
|---|---|---|
| sem resposta / tempo esgotado | `OFFLINE` | **para a rodada**, o pedido continua esperando |
| **5xx** (inclui o **503** do BFF) | `SERVER` | para a rodada, continua esperando |
| **401** | `SESSION` | para a rodada; vai quando fizer login de novo |
| **422** | `REFUSED` | **definitivo** para esse pedido (fica em "Pedidos pendentes" com os motivos) e **segue** para o próximo |
| qualquer outro 4xx | `OTHER` | igual ao 422 |

A ligação com a aula 6: o BFF repassa o 4xx sem mudar (o 422 chega como 422, com o corpo, e `calculationOf` acha os motivos) e transforma em 503 o que não pôde responder (cai em `SERVER`, "tente depois"). Se um 503 fosse reescrito como 400, **um pedido bom seria descartado por uma falha passageira**.

**Quando tenta.** Quando o `online` volta, quando o vendedor entra, e a cada 15 s enquanto houver pedido esperando (`useAutoSync`). Um só `flush` por vez (`sending`). Os pedidos guardados são **do vendedor que os fez**; entrar ou sair apaga o cache do service worker e os produtos vistos, **mas não a fila**; sair sem sinal é recusado.

### Autoteste 7
19. Dois pedidos na fila; o primeiro volta com 422 (abaixo do mínimo). O que o `flush` faz? (a) para a rodada; os dois esperam; (b) marca o primeiro como recusado (fica em "Pedidos pendentes" com os motivos) e segue para o segundo; (c) apaga o primeiro e tenta o segundo.
20. "Enviar pedido" com sinal fraco; a chamada passa de 8 s sem resposta. O que a tela faz e por que é seguro? (a) mostra erro e mantém o rascunho; reenviar pode duplicar; (b) guarda o pedido na fila com o mesmo `orderId`; se já tinha chegado, o reenvio devolve o pedido salvo, então não duplica; (c) cancela o pedido.
21. Por que o "online" não usa só `navigator.onLine`? (a) não existe em celular; (b) com uma barra de sinal ele diz "online" e nada chega; o que importa é o servidor responder, então uma chamada que falha ou passa de 8 s desliga e a sonda em `/api/health` religa; (c) é mais lento que uma chamada de rede.

**Gabarito 7.** (19) **b**: o 422 é definitivo para aquele pedido e nada diz sobre o próximo. (20) **b**. (21) **b**.

---

## 8. O envio que não duplica

**Para que serve.** Quando a resposta de um envio não chega (sinal fraco), a tela **não sabe** se o pedido foi gravado. O sistema precisa deixar tentar de novo **sem criar um segundo pedido**. A regra está em `CLAUDE.md` (envio idempotente com chave gerada no cliente) e na D33 (contexto: "toque duplo, sinal ruim"); o modo offline (D54 a D56) reaproveita o mesmo mecanismo.

**Como funciona, do começo ao fim.**
1. **O id nasce no navegador.** `web/app/stores/order.ts` gera um UUID (`crypto.randomUUID()`) **uma vez por pedido em construção**, guarda-o no `localStorage` com o rascunho, e só gera outro quando o pedido é enviado, descartado ou reiniciado.
2. **O envio manda esse id** (`{ orderId, ...itens }`). Se a resposta não chega, o pedido vai para a fila **com o mesmo id**.
3. **O servidor trata o id como chave.** Em `OrdersService.submit`: primeiro `findById(orderId)`; se existe, devolve **o pedido salvo** (`replay`), sem recalcular e sem publicar o evento de novo. Para outro vendedor, esse id responde "não encontrado".
4. **O banco é a garantia final.** Duas requisições com o mesmo id ao mesmo tempo passam ambas pelo "já existe?" e tentam inserir; a **chave primária** de `orders` deixa **uma** gravar, e `insert` devolve `false` à outra, que devolve o pedido da vencedora. **Só** a violação de `orders_pkey` conta como "pedido existente" (um bug que os testes acharam, D33, era tratar qualquer violação de unicidade assim).
5. **Os testes:** `orders.service.spec.ts` (`is idempotent: the same order id returns the saved order without recalculating or publishing again`; `returns the winner of a race on the same order id, and does not publish twice`) e `orders.repository.spec.ts` (`refuses a second order with the same id and reports it, without touching the first`; `settles two submits of the same id sent at once: exactly one wins`).

**Dois detalhes.** "Corrigir" um pedido recusado **gera um id novo** de propósito: o recusado nunca foi gravado, e o que o vendedor muda é, na prática, outro pedido. E o id **não protege** `approve` e `reject` (a D33 lista isso como "o que faria diferente"); essas duas são protegidas pelo `UPDATE ... WHERE status` da aula 3.

### Autoteste 8
22. Onde o `orderId` nasce e quando muda? (a) no servidor, a cada envio; (b) no navegador, uma vez por pedido em construção, e muda quando o pedido é enviado, descartado ou reiniciado; (c) no banco, ao gravar.
23. Dois envios com o mesmo `orderId` chegam ao mesmo tempo. O que garante um pedido só? (a) a checagem "já existe?" antes de inserir; (b) a chave primária de `orders`: só um `INSERT` vence e o outro recebe o pedido da vencedora; (c) um bloqueio no navegador.
24. O vendedor usa "Corrigir" num pedido que o servidor recusou. O id é o mesmo ou novo? (a) o mesmo, para o servidor reconhecer; (b) novo: o recusado nunca foi gravado, e o conteúdo vai mudar; (c) depende de o pedido ter sido guardado offline.

**Gabarito 8.** (22) **b**: se nascesse no servidor, um reenvio depois de uma resposta perdida criaria outro id e duplicaria o pedido. (23) **b**: a checagem "já existe?" sozinha deixaria as duas passarem; a chave primária é a garantia, e o código só trata o `orders_pkey`. (24) **b**: `loadForFixing` gera um id novo.
