# Contexto

Por que este sistema existe, o que o enunciado pede, onde cada pedido do enunciado foi atendido, como o trabalho foi conduzido e onde achar cada decisão. O enunciado original, intacto, está em [`SCOPE.md`](SCOPE.md).

## 1. O problema

Um módulo de montagem de pedidos para **vendedores externos** que visitam pequenos varejistas (mercadinhos, minimercados, conveniências), consultam o catálogo e fecham o pedido no cliente, **muitas vezes com sinal de internet ruim**. É um desafio técnico: a avaliação pesa as decisões e a justificativa, e haverá uma conversa de 60 minutos para explicar o código, fazer uma alteração ao vivo e investigar um defeito introduzido antes da conversa. Por isso tudo precisa ser código que eu consiga explicar, e a opção simples e legível ganha (e o porquê fica em `DECISIONS.md`).

## 2. O que o enunciado pede e onde foi atendido

| # | Pedido | Tipo | Onde está |
|---|---|---|---|
| 1 | Escopo da carteira: o vendedor só vê os próprios clientes | obrigatório | identity (`rules.ts`, `canAccessPortfolio`), sessão no BFF |
| 2 | Buscar produto por nome ou EAN, com o preço da tabela do cliente | obrigatório | catalog (`search-rules.ts`, repositório) |
| 3 | Montar o pedido: itens, quantidade, desconto, unidade e embalagem | obrigatório | web (tela do pedido) e orders (`order-rules.ts`) |
| 4 | Totais e bloqueio do envio quando as regras não são atendidas | obrigatório | orders (`calculateOrder`) |
| 5 | Enviar: dentro da alçada "Enviado"; fora, "Aguardando aprovação" | obrigatório | orders (`OrdersService.submit`) |
| 6 | Testes automatizados das regras | obrigatório | 502 testes (veja [`TESTING.md`](../testing/TESTING.md)) |
| 7 | Respeitar o limite de crédito | desejável | identity (reserva) e orders |
| 8 | Histórico dos últimos pedidos, com "repetir pedido" | desejável | orders (`repeat-order.ts`) e a tela do cliente |
| 9 | Montar o pedido sem conexão e sincronizar depois | opcional | web (service worker, fila) |

Além do pedido, foram feitos a aprovação ou rejeição pelo supervisor, os avisos (com fluxo em tempo real), a estatística de produtos mais pedidos e a implantação em Kubernetes: nada disso é exigido, e cada um tem sua decisão.

## 3. Fases e estado

A entrega foi planejada em fases (D10); todas estão prontas no ambiente local.

| Fase | Conteúdo | Estado |
|---|---|---|
| A | Requisitos 1 a 6 | pronta |
| B | Crédito, histórico e repetir pedido, aprovação do supervisor, avisos, estatística no catálogo | pronta |
| C | Pedido offline com sincronização | pronta; sem teste em celular real |
| D | Helm, kind com Calico, ingress, políticas de rede | pronta no cluster local; imagens não publicadas, repositórios não divididos |

O que falta, e os limites que continuam, está em [`PENDINGS.md`](../pendings/PENDINGS.md).

## 4. Como o trabalho foi conduzido

- **Decisões são minhas, a IA propõe e escreve.** Cada escolha de desenho foi perguntada a mim e respondida antes de entrar no código; quando a IA sugeriu algo que eu não pedi ou errou (o vocabulário dos status, uma conta de arredondamento), a correção está registrada. O retrato honesto está em [`AI_LOG.md`](../../../AI_LOG.md).
- **Convenções antes do código** (D1): o guia em [`style-guide/`](../style-guide/README.md) vem de projetos anteriores, sem nomes, caminhos ou regras de negócio deles.
- **Cada commit** é Conventional Commits em inglês e termina com a linha `IA: nenhuma`, `IA: parcial` ou `IA: majoritária` (D14). Nada foi reescrito depois de feito.
- **Testes de verdade:** as regras são funções puras com teste de borda; o que depende do banco é testado no PostgreSQL real; depois de escrever um teste, o código é quebrado de propósito para ver o teste falhar (veja `TESTING.md`).
- **Verificação:** a interface só é conferida no navegador depois de a fatia estar pronta; falhas e o que não foi verificado são ditos com todas as letras (README, "O que ficou de fora").

## 5. Restrições

- **Os dados de exemplo (cada `seed/seed.json`) mantêm as imperfeições**, de propósito (EAN repetido, cliente sem tabela de preço, preços com vírgula): cada uma virou uma interpretação em `ASSUMPTIONS.md`.
- **Nada confidencial nos arquivos versionados:** sem caminhos locais, nomes de empresas de terceiros, sistemas de fornecedores, regras de negócio de outros projetos ou credenciais.
- **Idioma:** documentos de entrega e esta documentação em português; código, comentários, commits, READMEs dos serviços e o guia de estilo em inglês.
- **O segredo interno só no servidor:** nunca no pacote do navegador, em resposta ou em log.

## 6. Onde achar cada decisão

As decisões (`DECISIONS.md`, D*n*) e as interpretações (`ASSUMPTIONS.md`, A*n*) ficam na raiz do repositório, porque o enunciado as exige lá. Por tema:

| Tema | Decisões |
|---|---|
| Stack e ferramentas | D2 a D7, D13, D23, D37 |
| Dinheiro, regras do pedido e a tela | D8, D32, D33, D38, D43, D48 |
| Serviços e comunicação | D15 a D21, D24 a D26, D28, D34, D35 |
| Dados, crédito e filas | D19, D22, D27, D30, D31, D40 a D42 |
| Sessão e segurança | D11, D16, D36, D39 |
| Ciclo de vida do pedido | D44 a D47 |
| Avisos | D49 a D51 |
| Catálogo (busca e estatística) | D12, D27, D52, D53 |
| Modo offline | D54 a D56 |
| Implantação | D9, D10, D29, D57 a D59 |
| Processo e IA | D1, D14 |

## 7. Glossário curto

- **Alçada:** o desconto máximo que um vendedor pode dar sem aprovação. A efetiva é a menor entre a dele e o teto global (`MAX_DISCOUNT_BP`).
- **BFF (backend for frontend):** o servidor do Nuxt, único contato do navegador; dono da sessão e quem fala com os serviços.
- **EAN / SKU:** código de barras e código interno do produto.
- **Pontos-base:** unidade inteira de desconto (1% = 100).
- **Idempotente:** repetir a operação não muda o resultado; no envio de pedido, o mesmo `orderId` devolve o mesmo pedido.
- **Fila de mensagens mortas (`.dlq`):** onde o RabbitMQ põe a mensagem que não pôde ser tratada.
- **SSE (Server-Sent Events):** fluxo de via única do servidor para a tela, usado para avisar que algo mudou.
- **Outbox:** padrão que grava o evento na mesma transação do dado e o publica depois; **não** foi adotado (D34).
- **NetworkPolicy:** regra do Kubernetes que diz quem pode falar com quem; aqui, tudo é negado e só o necessário é aberto.
