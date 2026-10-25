# AI_LOG

Registro do meu uso de IA neste desafio. Ferramenta: Claude Code, do começo ao fim. O objetivo é o retrato honesto: o que pedi, o que a IA respondeu, o que aceitei, alterei ou descartei, e por quê.

> Texto redigido com a IA a partir do histórico da sessão e revisado por mim. Os trechos marcados com _(confirmar)_ são pontos que só eu posso atestar.

**Em uma frase:** eu decidi o desenho e as regras (cada decisão está em `DECISIONS.md` e `ASSUMPTIONS.md`); a IA escreveu o código e os documentos; eu revisei rodando, perguntando e recusando, não escrevendo código.

**Em números:** 41 commits, todos declarados `IA: majoritária`, entre 20:26 e 23:55 de 24/10 (o histórico é a ordem real, sem squash).

## Momentos significativos

### 1. Escolha do ORM (Drizzle)

- **O que pedi:** a IA já tinha seguido para uma escolha; eu recusei duas perguntas que pressupunham a decisão ("não pedi para você decidir") e pedi argumentos para comparar TypeORM, Prisma e Drizzle. Eu nunca tinha ouvido falar do Drizzle.
- **O que a IA respondeu:** uma comparação dos três, com os riscos do Drizzle: API jovem, v1.0 ainda em beta, menos exemplos com Nest, `numeric` devolvido como texto. Registrou quando surgiu e por quê (julho de 2022, a partir de fontes secundárias, números aproximados).
- **O que aceitei, alterei ou descartei:** escolhi o Drizzle de propósito. Descartei a ideia de deixar a IA decidir por mim.
- **Por quê:** quero aprender uma tecnologia nova e poder dizer na conversa que experimento tecnologias novas, assumindo o risco de ter de explicar código que conheço menos. O risco do `numeric` some porque o dinheiro é inteiro em centavos. Ver `DECISIONS.md` D3.

### 2. A corrida de crédito

- **O que pedi:** "antes de continuar, vamos consertar essa corrida do crédito". Dois envios ao mesmo tempo podiam passar juntos pelo limite.
- **O que a IA respondeu:** opções (reservar no envio de forma síncrona no identity, ou aceitar a corrida e corrigir depois). Escolhi reservar de forma síncrona. Eu propus um TTL no Redis para a reserva expirar; discutimos e escolhi linhas no Postgres com `expires_at`: uma peça a menos, o crédito em uso é calculado e não existe tarefa de limpeza.
- **O que a IA errou:** o primeiro teste de concorrência **passava mesmo sem a trava da linha** (falsa confiança). Foi trocado por um teste determinístico que segura a trava numa transação à parte, e quebrar a trava de propósito passou a derrubar o teste.
- **O que aceitei, alterei ou descartei:** aceitei a reserva síncrona, troquei o Redis pelo Postgres, e exigi que o teste provasse algo.
- **Por quê:** é a regra em que um erro custa dinheiro. Ver `DECISIONS.md` D40 a D43 e `ASSUMPTIONS.md` A20, A38 a A40.

### 3. O vocabulário dos status (a IA errou)

- **O que pedi:** a aprovação do supervisor. A IA ofereceu "aprovar/rejeitar" e eu aceitei, então `REJECTED` entrou no código.
- **O que deu errado:** o seed traz "Faturado" e "Cancelado" nos pedidos do histórico. Perguntei, irritado, desde quando `SUBMITTED` e `REJECTED` eram oficiais. A IA rastreou: `SUBMITTED` e `AWAITING_APPROVAL` vieram do enunciado (nomes em inglês escolhidos pela IA, D25); `REJECTED` foi invenção da IA, que não o reconciliou com o vocabulário do seed e, na primeira resposta, foi vaga sobre a origem.
- **O que aceitei, alterei ou descartei:** descartei a ideia de trocar os nomes (contradiz o requisito 5) e decidi seis status reais em duas cadeias: `AWAITING_APPROVAL → APPROVED → SUBMITTED → INVOICED` e `AWAITING_APPROVAL → REJECTED → CANCELLED`. Contratos, orders, web e o D44 foram corrigidos.
- **Por quê:** o dado real manda no vocabulário, e o enunciado manda no resto. Ver `DECISIONS.md` D44 e D47 (que corrige o D44) e `ASSUMPTIONS.md` A14, A46.

### 4. Testes que enganam: quebrar o código de propósito

- **O que pedi:** que cada regra tivesse teste e que os testes provassem algo. Passei a exigir verificações por mutação: estragar o código e conferir que algum teste falha.
- **O que a IA respondeu e o que as mutações acharam:**
  - a regra "só o dono repete o pedido" estava escondida pela checagem do cliente; entrou um teste para o cliente transferido a outro vendedor;
  - o repositório tratava qualquer violação de unicidade como "o pedido já existe"; passou a checar `orders_pkey`;
  - depois de renomear um evento, uma ligação antiga da fila despejou 3 mensagens na fila de mortas sem falha real (`retireBindings`, D46);
  - nas notificações, duas mutações (marcar o aviso de outra pessoa; uma decisão fechando todos os tipos de aviso) foram pegas.
- **O que aceitei, alterei ou descartei:** aceitei as correções e adotei a prática. Em cada caso, o teste só valeu depois de falhar com o código quebrado.
- **Por quê:** um teste que nunca falha não protege nada, e na conversa ao vivo preciso mostrar que sei a diferença.

### 5. Contas de arredondamento (a IA errou)

- **O que pedi:** exemplos para entender três formas de arredondar.
- **O que a IA respondeu:** uma explicação com números. **A IA errou uma conta:** escreveu 106,7155 onde o correto é 106,7325 (7,49 × 15 × 0,95). Percebi quando os exemplos foram refeitos.
- **O que aceitei, alterei ou descartei:** descartei os números errados, conferi os refeitos lado a lado e escolhi o método 1 (arredondar cada linha uma vez, e o desconto do pedido uma vez sobre a soma).
- **Por quê:** a tela soma o que mostra e o desconto digitado é o desconto aplicado. Os exemplos viraram casos de teste (`ASSUMPTIONS.md` A18, A28).

### Outros usos, em uma linha

- **Guia de estilo:** pedi duas reescritas para que ele ficasse autônomo e sem nomes de empresa, caminhos locais, pipelines ou regras de negócio de projetos de trabalho.
- **Segredo do BFF:** perguntei se o segredo interno poderia aparecer no navegador. Ficou só no servidor. A IA comentou, erradamente, que um login por formulário era recusado; não era, e passou a existir uma recusa de verdade (415 para corpo que não seja JSON).
- **Perguntas da IA:** recusei várias perguntas densas ou cheias de jargão; passaram a ser simples.
- **Navegador:** só conferir no Chrome quando a fatia estiver pronta.

## Mapa de autoria

Legenda: **E** = eu escrevi; **R** = a IA gerou e eu revisei/alterei; **A** = a IA gerou e eu aceitei como veio.

| Parte da solução | Autoria | Observações |
|---|---|---|
| Modelagem de dados | R | Tabelas propostas pela IA a partir do seed. Minhas decisões: centavos e pontos-base inteiros, um schema por serviço sem consultas entre schemas, seis status, reserva de crédito com `expires_at` |
| Regras de negócio | R | Regras decididas por mim (A15 a A31, D40 a D48). A IA as implementou como funções puras (`order-rules.ts`, `order-status.ts`, `plan.ts`), com os casos de borda testados |
| API (serviços, BFF, eventos) | R | Gerada pela IA. Escolhi gRPC e RabbitMQ, o BFF com sessão em Redis, o envio idempotente, a tabela de avisos e o SSE |
| Telas | R/A | Fluxos escolhidos por mim (lista e depois detalhe, motivo em lista com texto livre, perguntar antes de substituir o rascunho). Componentes gerados pela IA; conferi no navegador uma vez por fatia, não em celular de verdade. _(confirmar)_ quanto do código das telas eu li |
| Testes | R | Escritos pela IA; eu exigi as verificações por mutação. Hoje: orders 181, identity 91, web 69, catalog 53, notifications 37, contracts 18 |
| Docker / CI | A | Compose e CI gerados e aceitos. O compose foi verificado rodando; o **CI nunca rodou no GitHub** |
| Documentação | R | `DECISIONS.md` e `ASSUMPTIONS.md` redigidos pela IA a partir das minhas respostas; corrigi fatos (D44 virou D47). `style-guide/` gerado pela IA e revisado por mim |

## Conversas brutas

Opcional. A transcrição da sessão existe localmente e posso exportá-la se pedirem.
