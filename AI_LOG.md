# AI_LOG

Registro do meu uso de IA neste projeto. Ferramenta: Claude Code, do começo ao fim. O objetivo é o retrato honesto: o que pedi, o que a IA respondeu, o que aceitei, alterei ou descartei, e por quê.

> Texto redigido com a IA a partir da transcrição da sessão (e conferido contra o `DECISIONS.md` e o histórico do git). As frases sobre o que li e o que entendo são minhas.

## Como trabalhei com a IA

- **Divisão de papéis.** **O meu papel:** as decisões de arquitetura e a direção do trabalho por prompts (perguntar, recusar, corrigir, impor regras de processo). **O papel da IA:** o desenvolvimento, os testes, a conferência e a verificação das regras de negócio. Cada decisão virou uma pergunta (a IA usava uma ferramenta de perguntas com opções), eu respondia, e o resultado está em `DECISIONS.md` e `ASSUMPTIONS.md`.
- **Regra que impus logo no começo:** "não pedi para você decidir, continue me perguntando sobre tudo". Também recusei perguntas densas ou cheias de jargão ("técnico demais, simplifique"), e várias vezes mandei a IA parar e explicar antes de eu escolher.
- **Como a verificação foi feita:** os testes, a conferência das regras de negócio, o sistema rodando e as passadas no navegador foram trabalho da IA. O meu papel nela foi cobrar: perguntar "por quê", interromper quando algo não fazia sentido e exigir que os testes provassem algo (verificação por mutação, momento 4). Não escrevi código na mão e **não li o código dos serviços linha a linha**. Das telas, só vi o que a IA me mostrou ao usar o navegador (Claude in Chrome).
- **Sessão de estudo (25/10/2026):** depois da publicação, estudei com a IA, em uma sessão guiada de cinco aulas com três perguntas cada, o arredondamento, o motor de regras (`order-rules.ts`), o ciclo de status (`order-status.ts`), o crédito (`rules.ts` e a reserva) e os avisos (`plan.ts`). Acertei as 15 perguntas. Foi estudo explicado pela IA e conferido por perguntas de múltipla escolha: **continuo sem ter lido esses arquivos sozinho**.
- **Regras do processo, pedidas por mim:** commits em inglês, Conventional Commits, última linha `IA: nenhuma|parcial|majoritária` e **sem** `Co-Authored-By`; documentos de entrega em português; nada de caminhos locais, nomes de empresas onde trabalho ou credenciais nos arquivos; só conferir no navegador quando a fatia inteira estiver pronta; nunca pular o hook de commit.
- **Em números:** mais de 50 commits, todos `IA: majoritária`, em dois dias (24 e 25/10; o histórico está na ordem real, sem squash). Foram 5 serviços (identity, catalog, orders, notifications e a tela com o BFF), 1 pacote de contratos, os gráficos Helm e a documentação.

## Momentos significativos

### 1. Escolha do ORM (Drizzle): eu não pedi para a IA decidir

- **O que pedi:** definir stack, bibliotecas de DTO, ORM, estado e UI. A primeira rodada de perguntas da IA já trazia opções para ORM, DTO e UI numa tela só; recusei duas vezes ("preciso esclarecer"), e na pergunta seguinte escrevi que nunca tinha ouvido falar do Drizzle e queria saber por que ele e não TypeORM ou Prisma, que são mais famosos. Depois: "não pedi para você decidir, continue perguntando; me dê argumentos para comparar, tenho curiosidade sobre o Drizzle".
- **O que a IA respondeu:** uma comparação dos três (maturidade, migrações, tipos, risco de usar uma biblioteca nova). Pesquisou na web e registrou quando o Drizzle surgiu, por que cresce e onde (julho de 2022, números de adoção variando muito entre fontes, v1.0 ainda em beta, então fixar a versão exata).
- **O que aceitei, alterei ou descartei:** escolhi o Drizzle de propósito, para ter contato com uma biblioteca nova e porque gosto de experimentar tecnologias novas; pedi que isso e a data de lançamento ficassem registrados.
- **Por quê:** aceito o risco de usar uma biblioteca que conheço menos. O risco do `numeric` como texto desaparece porque o dinheiro é inteiro em centavos. Ver `DECISIONS.md` D3.

### 2. A corrida de crédito: a IA criou o problema e eu pedi o conserto

- **O que a IA fez:** o primeiro desenho (D21) atualizava o crédito por evento. O risco que ele criava ficou registrado no D22: dois envios quase simultâneos liam o mesmo crédito e ambos passavam (exemplo do seed: C002 com R$ 350 disponíveis e dois pedidos de R$ 300).
- **O que pedi:** "antes de continuar, vamos consertar só essa corrida do crédito". Pedi mais explicação antes de escolher e escolhi a opção A: o `identity` reserva o crédito de forma síncrona (D22).
- **O que a IA propôs e eu mudei:** a reserva pendente precisava de uma tarefa agendada para expirar. Sugeri usar uma chave no Redis com TTL. Discutimos e escolhi linhas no Postgres com `expires_at`: uma peça a menos, o crédito em uso é calculado e não há tarefa de limpeza (D40).
- **O que a IA errou:** o teste de concorrência **passava mesmo sem a trava da linha**, em três execuções, porque o segundo pedido só começava depois que o primeiro terminava. Quebrando o código de propósito, a IA viu que o teste não provava nada e o trocou por um determinístico: uma transação segura a trava, uma reserva começa e tem de esperar, e só depois a primeira confirma (D41).
- **Por quê:** é a regra em que um erro custa dinheiro, e o teste precisava falhar quando a trava saísse. Ver `DECISIONS.md` D22, D40 a D43 e `ASSUMPTIONS.md` A20, A38 a A40.

### 3. Os status do pedido: a IA inventou um e eu corrigi (a IA errou)

- **O que aconteceu:** a IA ofereceu "aprovar/rejeitar" na pergunta da aprovação e eu aceitei, então `REJECTED` entrou no código, mais o fluxo de aprovação (22:43 de 24/10). O seed, porém, traz pedidos "Faturado" e "Cancelado". Antes disso eu já tinha proposto que `APPROVED` e `SUBMITTED` fossem passos seguidos e pedido para conversar sobre toda a máquina de estados.
- **O que eu reclamei:** "quero saber quando `SUBMITTED` e `REJECTED` viraram oficiais, já que o seed traz Faturado e Cancelado". A primeira resposta da IA foi vaga sobre a origem; precisei cobrar. Rastreado: `SUBMITTED` e `AWAITING_APPROVAL` vêm dos requisitos (nomes em inglês escolhidos pela IA, D25); `REJECTED` foi invenção da IA, nunca reconciliada com o vocabulário do seed.
- **O que decidi:** seis status reais em duas cadeias, `AWAITING_APPROVAL → APPROVED → SUBMITTED → INVOICED` e `AWAITING_APPROVAL → REJECTED → CANCELLED`. Uma decisão leva o pedido pelos dois primeiros degraus de uma vez, e cada degrau fica no histórico. Descartei trocar `SUBMITTED` por `INVOICED` (contradiz o requisito 5).
- **O que a IA corrigiu:** contratos, orders, web e o próprio D44 (marcado como corrigido pelo D47).
- **Por quê:** o dado real manda no vocabulário e os requisitos mandam no resto. Ver D44, D47 e A14, A46.

### 4. Testes que enganam: quebrar o código de propósito

- **O que pedi:** que cada regra tivesse teste, e que o teste provasse algo. Passamos a estragar o código de propósito para confirmar que algum teste falha.
- **O que isso achou (falhas da IA):**
  - o teste de concorrência do crédito, acima;
  - "só o dono repete o pedido" estava escondido pela checagem do cliente, e entrou um teste para o cliente que passou a outro vendedor;
  - o repositório tratava qualquer violação de unicidade como "o pedido já existe", e passou a checar a restrição `orders_pkey`;
  - ao renomear um evento, uma ligação antiga da fila despejou 3 mensagens na fila de mortas sem nenhuma falha real (`retireBindings`, D46);
  - nas notificações, duas mutações (marcar o aviso de outra pessoa; uma decisão fechando todos os tipos de aviso) foram pegas.
- **O que aceitei:** a prática. Em cada caso, o teste só valeu depois de falhar com o código quebrado.
- **Por quê:** um teste que nunca falha não protege nada, e preciso saber mostrar a diferença.

### 5. Arredondamento: a IA errou a conta e eu não entendi as opções

- **O que a IA errou:** na pergunta sobre arredondamento, o exemplo trazia "7,49 × 15 × 5% = 106,7155"; o correto é 106,7325. O erro estava na própria pergunta que me foi feita.
- **O que eu fiz:** primeiro recusei a pergunta, depois pedi "um exemplo completo", depois "dê exemplos disso", e por fim "ainda não entendi esses métodos, escreva um arquivo mostrando os três". A IA refez os exemplos (e os números certos aparecem lado a lado), com quatro casos: um pedido de três linhas, linhas que não somam, o mínimo de R$ 300 mudando de veredito e o desconto do pedido.
- **O que decidi:** depois dos exemplos, escolhi o método recomendado ("só escolha o recomendado"): arredondar cada linha uma vez, e o desconto do pedido uma vez sobre a soma das linhas arredondadas. Na hora, **não conseguia explicar sozinho a diferença entre os três métodos**: escolhi o recomendado depois de ver os exemplos lado a lado (a conta está em `ASSUMPTIONS.md`, seção "Arredondamento"). Depois estudei os três com a IA, numa sessão guiada com perguntas, e acertei todas; isso não é o mesmo que tê-los lido e refeito sozinho.
- **Por quê:** a tela soma o que mostra e o desconto digitado é o aplicado. Os exemplos viraram casos de teste (`ASSUMPTIONS.md` A18, A28, D8).

## Outras decisões em que a IA propôs e eu redirecionei

| Assunto | O que a IA propôs | O que eu decidi |
|---|---|---|
| DTOs | Zod num pacote compartilhado | Depois de uma pergunta sobre onde viveriam as regras: **o backend é dono das regras**, o front só mostra (D4). Tipos da API no front: "decidir depois" |
| Distribuição | perguntou como publicar um único repositório se o padrão era um por serviço | Primeiro: uma organização nova no GitHub, um repositório por serviço e um guarda-chuva com submódulos (D9). Depois mudei de ideia: **um único repositório público com tudo dentro** (D60), com as imagens publicadas no GHCR e duas formas de rodar |
| Como o orders obtém preço e cliente | RabbitMQ para tudo | Eu pedi RabbitMQ; a IA separou os dois usos e eu fixei: **RabbitMQ para o assíncrono, gRPC para o síncrono** (e pedi para confirmar que gRPC é mais rápido; a resposta honesta, no D17, é que a justificativa é de contrato, não de desempenho) |
| Consultas entre schemas | (a IA mostrou a contradição) | Eu tinha permitido consultas entre schemas; a IA apontou que isso tornava eventos e gRPC redundantes; respondi: "tudo bem, **nada de consultas entre schemas**" (D19) |
| Consumidores dos eventos | — | Identity (crédito), catálogo (estatística) e um quarto serviço, `notifications` |
| Pedido mínimo e desconto máximo | valores no código | Perguntei se os R$ 300 estavam em variável de ambiente (viraram `MIN_ORDER_CENTS`) e pedi um teto global de desconto por variável (`MAX_DISCOUNT_BP`); a alçada efetiva é o menor entre o teto e a do vendedor |
| Produto inativo ou sem preço | comportamento fixo | Uma **flag**: se ligada, mostra o produto desabilitado com o motivo; se desligada, oculta, mas mostra o motivo na busca exata por EAN ou SKU |
| EAN duplicado | "o ativo primeiro" | A IA percebeu na pergunta seguinte que os dois produtos são ativos; decidi: descrição exata e depois o id |
| Cliente sem tabela de preço | bloquear ou usar a padrão | Usar a padrão (TP01) e avisar na tela |
| Sessão | `nuxt-auth-utils` com Redis | A IA leu o código e viu que o módulo não guarda a sessão fora do cookie; foi trocado por um cookie com id opaco e Redis, escrito à mão (D36) |
| Motivo da rejeição | texto livre | Uma lista de opções num campo de seleção **mais** "Outro" com texto livre |
| Repetir pedido | copiar o pedido antigo | Copiar produtos, quantidades e unidade; **descontos em zero**; preços de hoje; perguntar antes de substituir o rascunho |
| Notificações | um aviso só para o supervisor | "Todos, para todos os eventos", com entrega por SSE e "lido ao abrir, resolvido quando o pedido é decidido". A IA propôs a tabela de quem recebe o quê para evitar avisos duplicados (D49) |
| Repositório de orquestração | — | Ideia minha: um repositório de orquestração como o de outro projeto meu, só na última fase (Helm, kind, ingress, NetworkPolicies) |
| Ingress e TLS | ofereceu TLS no ingress com certificado autoassinado; antes, ao montar o Kubernetes, a IA trouxe que o ingress-nginx foi aposentado e propôs o Traefik | Aceitei o Traefik. Sobre o TLS perguntei se não era exagero: era, para este desafio (o tráfego não sai da máquina, o certificado só traria um aviso do navegador). Decisão: **sem TLS e escrever o porquê** (D59) |
| Repositório de documentação | — | Pedi um repositório de documentação no padrão do de outro projeto meu. A IA estudou a estrutura desse e propôs o plano; eu decidi: **só português**, três documentos a mais (mapa do código, testes, operação) e que `README.md`, `DECISIONS.md`, `ASSUMPTIONS.md` e `AI_LOG.md` **ficam na raiz como arquivos de verdade**, para quem clona o repositório os encontrar de primeira |
| Pacotes e versões | npm | Perguntei por que pnpm e não npm; a IA explicou; escolhi pnpm via corepack. Pedi para instalar o Node 24 com nvm. Aceitei o TypeScript 7, que a IA teve de recuar no front (6.0.3, porque o `vue-tsc` não roda no 7, D37) |
| Tipos do gRPC | — | Pedi para conversar só sobre isso; escolhi gerar no `contracts` e versionar a saída |

Na marca (D61), a primeira versão da IA (uma caixa com asas) não me agradou; pedi três propostas diferentes, comparei numa página e escolhi o avião de papel, a que melhor combina com enviar o pedido sem sinal.

Na casca da interface (D61), eu pedi o menu "como no retail/v2"; a primeira versão da IA era uma gaveta sobre a página inteira, o que cobria o cabeçalho, e eu corrigi ("o hambúrguer não pode passar do cabeçalho"): o menu passou a nascer abaixo dele e a ficar aberto em tela larga.

## Onde a IA errou (resumo)

1. Conta de arredondamento errada, dentro da pergunta que me fez (momento 5).
2. Quis decidir ORM, DTO e UI sozinha e fez perguntas com jargão, recusadas por mim (momento 1).
3. O desenho por evento do crédito tinha uma corrida (D21), e o teste que a cobria passava sem a trava (D41).
4. Inventou o status `REJECTED` e não o reconciliou com o seed; foi vaga ao explicar a origem (D47).
5. Planejou a sessão sobre um módulo que não guarda a sessão no Redis (D36); planejou o TypeScript 7 para tudo (D37).
6. Um comentário errado dizendo que um login por formulário era recusado; não era, e passou a existir a recusa de verdade (415 para corpo que não é JSON).
7. O repositório tratava qualquer violação de unicidade como "pedido existente"; a ligação antiga da fila despejou mensagens na fila de mortas (D46).
8. Na tela, achados ao conferir no navegador: botão de enviar desabilitado parecendo habilitado, campo numérico que só confirmava ao sair, selo "Enviado" aparecendo com o pedido bloqueado, "1 itens" no plural, e textos de aprovação sobrescritos por engano.
9. Escreveu senhas de exemplo em arquivos de configuração e constantes de teste, e o hook de commit (que bloqueia linhas que parecem segredo) recusou; foi trocado por um gerador de `.env` e valores montados no teste, sem pular o hook. Um commit chegou a levar arquivos que não eram dele, e foi desfeito e refeito.
10. O consumidor de eventos do catálogo quebrava ao iniciar por faltar uma dependência do transporte RabbitMQ, e os testes não mostravam isso; só apareceu ao subir o sistema de verdade (D52, D53).
11. No Kubernetes, o contêiner que espera as dependências esperava uma porta que a política de rede do próprio pod bloqueia (esperaria para sempre); e duas configurações do ingress estavam no lugar errado do gráfico, e a instalação ficou esperando um endereço que nunca vem (D58, D59).
12. Um diagrama da documentação tinha um `;` dentro de uma mensagem, que o Mermaid trata como separador de comando; o analisador de verdade pegou, a leitura não.
13. Pôs o `INVOICED` no desenho, como pedi, mas sem nenhum caminho para um pedido novo chegar a ele (só o seed), e a explicação não deixava isso claro até eu perguntar por que ele não aparecia depois do `SUBMITTED`. Decidi manter assim e escrever o motivo (D47).

## Mapa de autoria

Legenda: **E** = eu escrevi; **R** = a IA gerou e eu revisei/alterei; **A** = a IA gerou e eu aceitei como veio.

Nota: o meu papel foi a arquitetura e a direção por prompts (as decisões e as regras de negócio, perguntadas uma a uma); o papel da IA foi desenvolver, testar, conferir e verificar as regras de negócio. O código foi gerado pela IA e **eu não o li linha a linha**; por isso a coluna diz **A** nas linhas de código, mesmo onde eu dirigi o comportamento. A verificação (testes, sistema rodando, navegador) também foi feita pela IA. Só `DECISIONS.md` e `ASSUMPTIONS.md` eu li e corrigi (**R**).

| Parte da solução | Autoria | Observações |
|---|---|---|
| Modelagem de dados | A | Tabelas propostas pela IA a partir do seed. Minhas decisões: centavos e pontos-base inteiros, um schema por serviço e nenhuma consulta entre schemas, seis status em duas cadeias, reserva de crédito com `expires_at`, avisos únicos por pedido, pessoa e tipo |
| Regras de negócio | A | Decididas por mim, uma por uma (A15 a A31, D32, D40 a D51). A IA as implementou como funções puras (`order-rules.ts`, `order-status.ts`, `plan.ts`), com os casos de borda testados |
| API (serviços, BFF, eventos) | A | Gerada pela IA. Escolhi gRPC para o síncrono, RabbitMQ para o assíncrono, o BFF com sessão em Redis, o envio idempotente, a tabela de avisos e o SSE |
| Telas | A | Fluxos escolhidos por mim (lista e depois detalhe, motivo em lista com texto livre, perguntar antes de substituir o rascunho, uma tela de pedido pensada para celular). Componentes gerados pela IA; conferi no navegador uma vez por fatia (inclusive numa moldura de 390 px), não num celular de verdade. Não li o código das telas; vi o que a IA me mostrou ao usar o navegador |
| Testes | A | Escritos pela IA; eu exigi as verificações por mutação. Hoje: orders 181, identity 91, web 100, catalog 75, notifications 37, contracts 18 |
| Modo offline | A | Comportamento escolhido por mim, pergunta a pergunta (fila no aparelho, totais "desatualizados", busca só entre o que já foi visto, envio automático, pedido recusado fica para corrigir; D54 a D56). A IA escreveu o código e os testes; conferido no navegador parando o servidor, não num celular real |
| Kubernetes (Helm, kind) | A | Escolhas minhas: gráfico de biblioteca compartilhado, Traefik porque o ingress-nginx foi aposentado, negar todo o tráfego e abrir só o necessário, sem TLS (D57 a D59). A IA escreveu os gráficos e os scripts; `verify.sh` prova o sistema e as políticas, e as políticas foram apagadas de propósito para ver o teste falhar |
| Docker / CI | A | Compose e CI gerados e aceitos. O compose foi verificado rodando (de um clone limpo e com as imagens publicadas); o CI passou no primeiro envio ao GitHub |
| Documentação | R | `DECISIONS.md` e `ASSUMPTIONS.md` redigidos pela IA a partir das minhas respostas; corrigi fatos (D44 virou D47). O guia de estilo foi gerado pela IA a partir de projetos meus anteriores e **reescrito duas vezes por pedido meu**, para tirar nomes de empresas, caminhos locais, pipelines e regras de negócio |

## Conversas brutas

Opcional. A transcrição da sessão existe localmente e posso exportá-la, revisada, se alguém quiser ver.
