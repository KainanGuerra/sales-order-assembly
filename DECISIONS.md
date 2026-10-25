# DECISIONS

Registro das decisões deste projeto, na ordem em que foram tomadas. Cada entrada tem: **Contexto**, **Alternativas consideradas**, **Escolha**, **Por quê** e **O que faria diferente com mais tempo**. Entradas não são renumeradas; mudanças de rumo viram uma nova entrada que referencia a anterior.

---

## D1. Escrever as convenções de engenharia antes do código, e registrar as decisões aqui

- **Contexto:** O enunciado avalia as decisões e a justificativa, não a quantidade de funcionalidades. Antes de conhecer a stack final, defini como costumo estruturar serviços.
- **Alternativas consideradas:** (a) um guia genérico de boas práticas; (b) decidir convenções caso a caso durante o desenvolvimento; (c) um ADR por arquivo.
- **Escolha:** Um guia curto em `style-guide/` (arquitetura primeiro, linguagem depois) e este arquivo único, cronológico.
- **Por quê:** Um padrão escrito deixa o revisor julgar desvios contra um critério declarado, e um log único é rápido de ler.
- **O que faria diferente:** Fixar o guia depois de ver o código pronto, para podar o que não foi usado.

## D2. Stack: Nuxt 4 (Vue 3) + NestJS + TypeScript + PostgreSQL

- **Contexto:** O enunciado recomenda Vue 3, Node com TypeScript e PostgreSQL. Tenho experiência em TypeScript e .NET e foco em arquitetura de serviços.
- **Alternativas consideradas:** Vue 3 puro (SPA) com Express/Fastify; .NET no backend (justificaria explicar o desvio da stack do time).
- **Escolha:** Nuxt no frontend e NestJS no backend, ambos em TypeScript, com PostgreSQL. Versões exatas são fixadas na fase de código, depois de checar a compatibilidade entre elas.
- **Por quê:** Fica dentro da stack recomendada. O NestJS impõe módulos, injeção de dependência e camadas, o que combina com a forma como organizo serviços.
- **O que faria diferente:** Medir se o Nuxt (com SSR desligado) compensa frente a um Vue SPA simples para um app usado em campo.

## D3. ORM: Drizzle (em vez de Prisma ou TypeORM)

- **Contexto:** As regras do domínio são aritmética e junções (produto × tabela de preço × cliente). Eu nunca usei Drizzle, e quis experimentar uma tecnologia nova de forma consciente.
- **Alternativas consideradas:** Prisma (mais conhecido, migrações mais maduras, linguagem de schema própria); TypeORM (integração nativa com Nest, tipagem mais fraca, `numeric` como string).
- **Escolha:** Drizzle, com schema em TypeScript e `drizzle-kit` para migrações.
- **Por quê:** Consultas próximas do SQL, sem etapa de geração de código, tipagem forte e um schema que o revisor lê como TypeScript. Dinheiro em centavos inteiros evita o problema do `numeric` virar string.
- **Contexto da tecnologia (fontes secundárias, valores aproximados):** lançamento público em julho de 2022 (v0.11.0), código desde 2021, criado por Andrii Sherman e Alex Blokh; adoção citada entre ~4 e ~19 milhões de downloads semanais no npm e ~35 mil estrelas no GitHub, dependendo da fonte; a versão 1.0 ainda estava em beta/RC no fim de setembro de 2026, então a versão exata é fixada.
- **Riscos assumidos:** API jovem, migrações menos tolerantes que as do Prisma, menos exemplos com Nest.
- **O que faria diferente:** Escrever os mesmos testes de repositório contra Prisma e comparar o custo real de cada um.

## D4. DTOs com Zod, e todas as regras no backend

- **Contexto:** O pedido envolve regras de preço, embalagem, desconto e crédito que não podem divergir entre cliente e servidor.
- **Alternativas consideradas:** class-validator/class-transformer (padrão em Nest, só backend); Zod em pacote compartilhado entre Nest e Nuxt; Valibot.
- **Escolha:** Zod no backend (a integração com o Nest mudou em D23: pipe nativo, sem `nestjs-zod`), e **o backend é dono de todas as regras**: o frontend só exibe e envia intenções.
- **Por quê:** Uma única implementação das regras elimina a divergência de preço e é o que o teste automatizado cobre. O pacote compartilhado foi descartado por quebrar a separação em repositórios por serviço.
- **O que faria diferente:** O modo offline (fase C) não consegue recalcular totais localmente; se ele for implementado, reavaliar um pacote de regras puras compartilhado.

## D5. Estado no frontend: Pinia + TanStack Query

- **Contexto:** O app precisa guardar o rascunho do pedido e tolerar rede ruim.
- **Alternativas consideradas:** Pinia + Pinia Colada; só Pinia; apenas `useState`/`useFetch` do Nuxt.
- **Escolha:** Pinia para estado local (cliente selecionado, rascunho) e TanStack Query para dados do servidor (cache, repetição, atualização otimista).
- **Por quê:** Separação clara entre estado do cliente e estado do servidor, com tratamento de falha e novo envio já resolvidos.
- **O que faria diferente:** Avaliar o Pinia Colada quando estabilizar.

## D6. UI: Nuxt UI

- **Contexto:** O vendedor usa o app no celular, em campo.
- **Alternativas consideradas:** PrimeVue, Vuetify, Tailwind puro.
- **Escolha:** Nuxt UI (módulo oficial, Tailwind + Reka UI).
- **Por quê:** Componentes acessíveis e responsivos prontos, menos peças para configurar com Nuxt.
- **O que faria diferente:** Testar a usabilidade em um celular real com sinal ruim.

## D7. Testes com Vitest em todos os pacotes

- **Contexto:** O enunciado exige testes automatizados das regras de negócio.
- **Alternativas consideradas:** Jest no backend e Vitest no frontend; Jest em tudo.
- **Escolha:** Vitest em todos os repositórios.
- **Por quê:** Um runner só, TypeScript e ESM sem configuração extra, e é o que o Nuxt usa.
- **O que faria diferente:** Acrescentar testes de integração com Postgres real (Testcontainers) para o repositório.

## D8. Dinheiro em centavos inteiros e arredondamento "por linha"

- **Contexto:** Porcentagem de desconto gera frações de centavo, e o valor decide o pedido mínimo e a alçada. O `seed.json` traz preços em reais com ponto flutuante.
- **Alternativas consideradas:** `numeric(12,2)` (Drizzle devolve string); arredondar o preço unitário já com desconto; arredondar só o total.
- **Escolha:** Valores em centavos inteiros (conversão na importação do seed). Total da linha = preço × quantidade × (1 − desconto), arredondado uma vez, meio para cima. Desconto do pedido aplicado sobre a soma das linhas arredondadas e arredondado uma vez. Exemplos numéricos em `ASSUMPTIONS.md`.
- **Por quê:** As linhas somam exatamente o total exibido, e a porcentagem digitada é aplicada de forma exata por linha.
- **O que faria diferente:** Confirmar a regra com o produto; o arredondamento pelo preço unitário seria o certo se o desconto virasse preço de nota.

## D9. Um repositório por serviço, mais um repositório guarda-chuva com submódulos

- **Contexto:** Quero seguir o padrão que já uso (uma organização, um repositório por serviço, imagens em um registry), mas o enunciado pede um único repositório Git com `docker compose up`, `README.md` e histórico completo.
- **Alternativas consideradas:** monorepo; repositórios separados sem guarda-chuva; guarda-chuva só com imagens publicadas; perguntar à equipe.
- **Escolha:** Uma organização nova no GitHub com um repositório por serviço, e um repositório guarda-chuva que contém os documentos de entrega, o `docker-compose.yml`, o CI e os serviços como submódulos Git. Imagens publicadas no GitHub Container Registry (GHCR) pelo CI de cada serviço. A divisão exata em serviços fica para a próxima fase.
- **Por quê:** Preserva a arquitetura em que acredito e entrega um único repositório clonável com `--recurse-submodules`.
- **O que faria diferente:** Se o revisor tiver atrito com submódulos, entregar um monorepo equivalente.

## D10. Entrega em fases

- **Contexto:** 4 a 6 horas esperadas; "não esperamos que você faça tudo".
- **Alternativas consideradas:** só os obrigatórios; tudo de uma vez.
- **Escolha:** Fase A: requisitos obrigatórios 1–6. Fase B: limite de crédito e histórico com "repetir pedido". Fase C: pedido offline com sincronização.
- **Por quê:** Cada fase deixa o sistema funcionando e testado; o que não for concluído fica documentado como fora do escopo.
- **O que faria diferente:** Estimar cada fase antes de começar e registrar o tempo real.

## D11. Sessão por cookie no servidor, escolhendo o vendedor ou o supervisor

- **Contexto:** O enunciado permite simular o login escolhendo o vendedor, mas o vendedor só pode ver a própria carteira.
- **Alternativas consideradas:** `X-Seller-Id` no cabeçalho (qualquer um altera); JWT.
- **Escolha:** Tela única de seleção (vendedores e supervisor); o servidor guarda a sessão e entrega um cookie. Toda consulta é filtrada pelo vendedor da sessão no servidor.
- **Por quê:** A restrição de carteira é imposta no servidor, não por confiança no cliente.
- **O que faria diferente:** Trocar a simulação por autenticação real.

## D12. Busca de produtos por similaridade (pg_trgm) e EAN exato

- **Contexto:** Nomes têm acento (Açúcar, Feijão), o vendedor digita no celular, e o EAN `7891831978575` está duplicado no seed.
- **Alternativas consideradas:** `ILIKE` com `unaccent`; busca de texto completo; só EAN exato.
- **Escolha:** `pg_trgm` com `unaccent` para texto; EAN por igualdade exata. Em caso de EAN duplicado, ambos os produtos aparecem, ordenados por correspondência exata da descrição e depois pelo id.
- **Por quê:** Tolera erro de digitação sem esconder produtos; as extensões são ativadas no script de inicialização do banco.
- **O que faria diferente:** Medir a qualidade da busca com um catálogo maior.

## D13. Configuração e flags por variáveis de ambiente validadas com Zod

- **Contexto:** Produtos inativos ou sem preço na tabela do cliente precisam de um comportamento configurável.
- **Alternativas consideradas:** flags em tabela do banco; parâmetro de consulta.
- **Escolha:** Variáveis de ambiente (ex.: `SHOW_UNAVAILABLE_PRODUCTS`), validadas na inicialização.
- **Por quê:** Simples, rastreável no compose, sem tela administrativa.
- **O que faria diferente:** Flags em runtime se alguém precisasse alterá-las sem reiniciar.

## D14. Mensagens de commit terminam com o nível de uso de IA

- **Contexto:** O enunciado exige a linha final `IA: nenhuma`, `IA: parcial` ou `IA: majoritária`.
- **Alternativas consideradas:** acrescentar também um trailer `Co-Authored-By`.
- **Escolha:** Assunto, corpo e, por último, a linha `IA: …`. Sem trailer adicional.
- **Por quê:** A linha pedida é a declaração honesta e a última da mensagem.
- **O que faria diferente:** Registrar também, no `AI_LOG.md`, o commit de cada trecho gerado por IA.

## D15. Backend em quatro serviços: identity, catalog, orders e notifications (mais web e contracts)

- **Contexto:** Quero seguir o padrão de microsserviços que já uso. O enunciado pede 4 a 6 horas, então cada serviço extra tem custo real (imagem, CI, schema, chamadas entre serviços).
- **Alternativas consideradas:** um backend modular único; dois serviços (catalog e orders); três serviços (sem notifications).
- **Escolha:** `identity` (vendedores, supervisor, clientes, limites), `catalog` (produtos, preços, busca), `orders` (todas as regras de pedido) e `notifications` (avisos ao supervisor), mais o `web` (Nuxt) e o repositório `contracts`.
- **Por quê:** Cada serviço tem um dono claro dos dados e das regras, e o fluxo de eventos tem consumidores reais.
- **O que faria diferente:** Começar com os três serviços da fase A e criar o `notifications` só na fase B, medindo o custo de cada serviço adicional.

## D16. Nuxt como BFF, dono da sessão (Redis)

- **Contexto:** O navegador precisa falar com vários serviços e a restrição de carteira deve ser imposta no servidor.
- **Alternativas consideradas:** proxy reverso por caminho; navegador chamando cada serviço; sessão sob responsabilidade do identity.
- **Escolha:** O servidor do Nuxt é o BFF: o navegador só fala com ele. Ele valida a escolha de vendedor/supervisor com o identity, guarda a sessão no Redis, envia o cookie e, em cada chamada aos serviços, inclui um segredo interno e o usuário e o papel da sessão.
- **Por quê:** Esconde os serviços, evita CORS e mantém a sessão num lugar só.
- **O que faria diferente:** Trocar o segredo interno compartilhado por tokens assinados por chamada.

## D17. Comunicação: gRPC síncrono e RabbitMQ assíncrono

- **Contexto:** O pedido depende de preço, regras de embalagem, cliente e limites que pertencem a outros serviços.
- **Alternativas consideradas:** HTTP entre serviços; cópias locais dos dados via eventos; RPC sobre RabbitMQ.
- **Escolha:** `orders` consulta `catalog` e `identity` por gRPC, em lote, tanto no cálculo quanto no envio. O RabbitMQ (`@nestjs/microservices`, transporte RMQ) carrega apenas eventos publicados por `orders`, com consumidores idempotentes.
- **Por quê:** Contratos fortemente tipados e uma separação clara entre o que precisa de resposta agora e o que pode ser assíncrono. O ganho de velocidade do gRPC sobre HTTP/JSON é real em geral (mensagens menores, HTTP/2; as fontes que consultei citam cerca de metade da latência), mas as medições variam muito e, com 23 produtos, a diferença é imperceptível. Por isso a justificativa é de contrato, não de desempenho.
- **Custo assumido:** Arquivos `.proto` como segundo formato de contrato ao lado do Zod; cada chamada de cálculo depende de dois serviços disponíveis.
- **O que faria diferente:** Medir o tempo de um cálculo com gRPC e com HTTP no mesmo ambiente antes de afirmar a diferença.

## D18. Contratos em um repositório próprio, usado como submódulo

- **Contexto:** Não há pacote compartilhado de código, mas os `.proto` e os esquemas de eventos precisam de uma fonte única.
- **Alternativas consideradas:** cada serviço dono do seu `.proto` e os chamadores copiando; pacote publicado no GitHub Packages.
- **Escolha:** Um repositório `contracts` incluído como submódulo Git em cada serviço.
- **Por quê:** Uma fonte de verdade sem registry nem autenticação extra no build.
- **O que faria diferente:** Gerar os tipos TypeScript no CI e publicá-los, se o número de serviços crescesse.

## D19. Um PostgreSQL, um schema e um papel por serviço, sem consultas entre schemas

- **Contexto:** Isolamento dos dados de cada serviço com uma infraestrutura leve de rodar.
- **Alternativas consideradas:** um contêiner de banco por serviço; consultas entre schemas.
- **Escolha:** Um PostgreSQL com os schemas `identity`, `catalog`, `orders` e `notifications`, cada um com seu papel e suas concessões. Nenhuma consulta entre schemas.
- **Por quê:** A fronteira é imposta pelo banco, não só por convenção, e o compose continua enxuto.
- **O que faria diferente:** Um banco por serviço, se fossem implantados separadamente.

## D20. Rascunho no navegador, cálculo no servidor, e orders sem cópia dos dados dos outros serviços

- **Contexto:** O backend é dono das regras, mas o vendedor edita o pedido continuamente.
- **Alternativas consideradas:** rascunho salvo no servidor a cada edição; cópias locais de preços e clientes alimentadas por eventos.
- **Escolha:** O rascunho fica no Pinia. A cada edição, o BFF envia o rascunho ao endpoint de cálculo de `orders`, que consulta catalog e identity por gRPC e devolve totais, motivos de bloqueio e status previsto, sem gravar nada. `orders` só grava no envio, com instantâneo de preço e produto em cada item.
- **Por quê:** Nenhuma regra duplicada no frontend e nenhuma cópia de dados para manter sincronizada.
- **O que faria diferente:** Se o cálculo a cada edição ficar lento, agrupar edições (debounce) ou guardar um cache curto de preços; para o modo offline, reavaliar o rascunho no servidor.

## D21. Eventos de pedido e seus consumidores

- **Contexto:** Sem cópias locais, o RabbitMQ precisa de uma função real.
- **Alternativas consideradas:** publicar eventos sem consumidor; só o consumidor de crédito.
- **Escolha:** `OrderSubmitted`, `OrderApproved` e `OrderRejected`, publicados por `orders`. `identity` mantém o crédito utilizado do cliente (soma no envio, libera na rejeição), `catalog` mantém a estatística de produtos mais pedidos e `notifications` avisa o supervisor. Todos idempotentes pelo id do pedido.
- **Por quê:** Cada consumidor atualiza dados que pertencem a ele, sem consulta entre schemas.
- **Risco assumido:** Duas submissões quase simultâneas podem ler o mesmo crédito disponível, porque a atualização é assíncrona. **Corrigido por D22** (reserva síncrona); o consumidor de crédito no identity passa a confirmar e liberar reservas, em vez de somar o total.
- **O que faria diferente:** Reservar o crédito por uma chamada síncrona no momento do envio.

## D22. Reserva síncrona de crédito no identity (corrige o risco de D21)

- **Contexto:** Em D21, o crédito era atualizado por evento. Dois envios quase simultâneos para o mesmo cliente liam o mesmo crédito disponível e ambos passavam. Exemplo com o seed: o cliente C002 tem 350 disponíveis e recebe dois pedidos de 300; sem proteção, o crédito utilizado chegaria a 12.250 sobre um limite de 12.000.
- **Alternativas consideradas:** (B) `orders` verificar o crédito sob um bloqueio por cliente (`pg_advisory_xact_lock`) na mesma transação que grava o pedido, somando os pedidos em aberto do próprio schema; manter a atualização por evento e aceitar o risco.
- **Escolha:** (A) O `orders` chama `ReserveCredit(clientId, orderId, amount)` no `identity` por gRPC antes de gravar o pedido. O `identity` insere a reserva (chave primária = id do pedido, portanto idempotente) e faz `UPDATE ... SET credit_used = credit_used + :amount WHERE limit - credit_used >= :amount` na mesma transação; zero linhas atualizadas significa crédito insuficiente. Se a gravação do pedido falhar, o `orders` chama `ReleaseCredit`. A reserva nasce `pendente`, `OrderSubmitted` a torna `confirmada`, `OrderRejected` a libera, e um job libera as `pendente` com mais de 15 minutos.
- **Por quê:** Mantém o crédito sob o dono dos dados do cliente, fecha a corrida com uma única instrução atômica e dá ao evento `OrderSubmitted` uma função real no identity. A opção B era mais simples (uma transação, sem compensação), mas move o controle do crédito para o `orders`.
- **Custo assumido:** Fluxo em dois passos entre serviços e uma tabela de reservas; se `OrderSubmitted` atrasar mais que 15 minutos, uma reserva válida pode ser liberada por engano.
- **O que faria diferente:** Publicar os eventos com um outbox transacional no `orders` (eliminando a janela do evento perdido) ou, se o crédito pudesse morar no `orders`, adotar a opção B por ser mais simples de explicar e de testar.

## D23. Versões e ferramentas: Node 24, pnpm 12, TypeScript 7, NestJS 12

- **Contexto:** Na fase de código, conferi as versões publicadas e a compatibilidade. O `nestjs-zod` 5.5 declara suporte apenas ao Nest 10 e 11, mas o Nest atual é o 12.2.0, que traz um `StandardSchemaValidationPipe` nativo (o arquivo está no pacote `@nestjs/common`). O TypeScript mais recente é o 7.0.2.
- **Alternativas consideradas:** Nest 11 com `nestjs-zod` (par suportado, com integração ao Swagger); Nest 12 com `nestjs-zod` ignorando o aviso de dependência; TypeScript 6.0.3 (ferramentas mais maduras); npm no lugar do pnpm.
- **Escolha:** Node 24, pnpm 12 (via corepack), NestJS 12 com o pipe nativo de Standard Schema e Zod (**sem** `nestjs-zod`, o que ajusta o D4) e TypeScript 7.0.2. No repositório de contratos, `buf lint`, a geração, a checagem de tipos com o TypeScript 7 e os testes passaram. As demais peças serão validadas uma a uma e este registro será atualizado se algo falhar.
- **Por quê:** Suporte oficial, uma dependência a menos, e a oportunidade de usar as ferramentas atuais. O pnpm bloqueia scripts de instalação por padrão; liberei só o `@bufbuild/buf` (`allowBuilds`), que baixa o seu binário.
- **Risco assumido:** O TypeScript 7 é o compilador nativo novo; plugins do Nest e do Nuxt (`vue-tsc`) podem ter lacunas. Se algum bloquear, a saída é fixar o 6.0.3 e registrar aqui.
- **O que faria diferente:** Fixar o TypeScript 6.0.3 até confirmar a compatibilidade de todas as ferramentas, e só então subir para o 7.

## D24. Tipos do gRPC gerados no repositório de contratos e versionados

- **Contexto:** Com tipos escritos à mão, uma mudança no `.proto` passa despercebida pelo compilador e os testes com mocks continuam verdes.
- **Alternativas consideradas:** carregar o `.proto` em tempo de execução com interfaces manuais; gerar os tipos em cada serviço.
- **Escolha:** `buf` + `ts-proto` (com `nestJs=true`) rodam só no repositório `contracts`; o código gerado é versionado em `gen/ts`, e os serviços o leem pelo submódulo. O CI do contracts roda `buf lint`, falha se `gen/` estiver desatualizado e roda checagem de tipos e testes.
- **Por quê:** Renomear um campo do contrato vira erro de compilação nos serviços que o usam, e nenhum serviço precisa do gerador no build.
- **Custo assumido:** Código gerado no Git e a necessidade de atualizar o ponteiro do submódulo em cada serviço.
- **O que faria diferente:** Publicar os tipos como pacote versionado se houvesse mais consumidores.

## D25. Convenções dos contratos: centavos, pontos-base, `sales.<serviço>.v1` e eventos em Zod

- **Contexto:** O seed traz descontos inteiros (5, 7, 3), mas um vendedor pode querer dar 2,5%.
- **Alternativas consideradas:** percentual inteiro; decimal com duas casas; eventos em Protobuf ou JSON Schema.
- **Escolha:** Dinheiro em centavos inteiros e descontos em **pontos-base** (1% = 100, inteiro, sem ponto flutuante). Pacotes `sales.catalog.v1` e `sales.identity.v1`, no layout padrão do `buf`. Entidade inexistente responde com o status gRPC `NOT_FOUND`. Os eventos (`OrderSubmitted`, `OrderApproved`, `OrderRejected`) são esquemas Zod em TypeScript, validados por quem publica e por quem consome. Os códigos internos de status são `SUBMITTED` e `AWAITING_APPROVAL`; a interface exibe "Enviado" e "Aguardando aprovação".
- **Por quê:** Inteiros em todo lugar evitam arredondamento acidental; Zod combina com a validação do restante da stack.
- **O que faria diferente:** Se houvesse consumidores em outras linguagens, descrever os eventos em Protobuf ou JSON Schema.

## D26. Os serviços instalam o `contracts` como pacote local (`file:`), construído com `tsc`

- **Contexto:** O `contracts` é um repositório à parte (D18), mas os serviços TypeScript precisam importar seus tipos gerados em tempo de execução. Com um vínculo simbólico (`link:`), o Node resolve as bibliotecas a partir da pasta do `contracts`, o que cria duas cópias de `@nestjs/microservices` e `zod` e não funciona numa imagem Docker.
- **Alternativas consideradas:** `link:` para a pasta do `contracts`; compilar os `.ts` do `contracts` junto com cada serviço; publicar um pacote no registry.
- **Escolha:** O `contracts` compila para JavaScript ESM (`pnpm build`), declara `zod` e `@bufbuild/protobuf` como dependências e `@nestjs/*`, `rxjs` e `@grpc/grpc-js` como dependências pares; os serviços o instalam com `file:../contracts`. O build do Docker usa a pasta `repositories/` como contexto: constrói o `contracts` e depois o serviço. Os caminhos dos `.proto` vêm de `CATALOG_PROTO_PATH` e `IDENTITY_PROTO_PATH`, porque o transporte gRPC do Nest ainda carrega o `.proto` em tempo de execução.
- **Por quê:** Uma única cópia de cada biblioteca e uma imagem autossuficiente.
- **Custo assumido:** Depois de mudar o contrato é preciso rodar o build do `contracts` e `pnpm install` nos serviços. Quando os serviços forem repositórios separados, o `contracts` entra como submódulo dentro de cada um e só os caminhos do Dockerfile mudam.
- **O que faria diferente:** Publicar o pacote com versão semântica no GitHub Packages.

## D27. Catálogo: busca por similaridade de palavra, migrações no início da aplicação e testes no Postgres real

- **Contexto:** O vendedor digita no celular (erros de digitação, sem acento), o seed tem um EAN duplicado e produtos descontinuados.
- **Alternativas consideradas:** `ILIKE` simples; similaridade de string inteira do `pg_trgm` (`%`), que falhou ao comparar "arros" com a descrição completa de "Arroz Branco Tipo 1 5kg"; testes só com mocks; esquema de teste separado criado pelos testes.
- **Escolha:** Código numérico (EAN) ou SKU exato; texto por "contém" mais `word_similarity` (`<%`), ambos sobre `immutable_unaccent(lower(descrição))`, com índice GIN de trigramas. A ordem é descrição exata, depois a mais próxima, depois o id. Regras de visibilidade (disponível, sem preço, inativo) ficam em funções puras. As migrações do Drizzle rodam na criação do provedor do banco (a aplicação só sobe depois), e o próprio migrador registra o que já foi aplicado. Os testes de banco rodam as migrações reais no schema `catalog_test` do Postgres do compose.
- **Por quê:** Os testes de busca com mocks não provariam o trigrama nem o acento, que são a parte mais arriscada do serviço. Uma mutação deliberada (inverter a ordenação por id) mostrou um buraco na cobertura, que foi corrigido com um teste de desempate.
- **Custo assumido:** Os papéis de serviço receberam `CREATE` no banco, porque o migrador executa `CREATE SCHEMA IF NOT EXISTS` e o Postgres checa esse privilégio antes de verificar a existência. Isso não dá acesso ao schema de outro serviço (que exige `USAGE`), mas alarga o D19. A migração `0001` é escrita à mão e o script `db:generate` remove o prefixo `"public".` das chaves estrangeiras geradas.
- **O que faria diferente:** Usar um papel de migração separado, com `CREATE`, e deixar o papel do serviço apenas com leitura e escrita nas tabelas; e travar a migração com um bloqueio consultivo se houver mais de uma réplica.

## D28. Autenticação interna igual em HTTP e gRPC, e dois portões no mesmo processo

- **Contexto:** O catálogo atende o BFF (HTTP) e o `orders` (gRPC).
- **Alternativas consideradas:** dois processos; confiar apenas na rede interna.
- **Escolha:** Uma aplicação Nest híbrida (HTTP e gRPC) e um único guard que lê o segredo de `x-inner-auth` do cabeçalho ou dos metadados, comparando em tempo constante. Sem o segredo, HTTP responde 401 e gRPC responde `UNAUTHENTICATED` (um erro HTTP do Nest chegaria ao chamador gRPC como `UNKNOWN`).
- **Por quê:** Um só código de autenticação, testado nos dois caminhos.
- **O que faria diferente:** Tokens assinados por chamada em vez de um segredo compartilhado (já registrado em D16).

## D29. Repositório de orquestração, na fase D (a última)

- **Contexto:** Nos meus projetos anteriores, um repositório de orquestração reúne o gráfico Helm "guarda-chuva", os subgráficos de cada serviço, o cluster local (kind), o ingress e as políticas de rede, com um guia de primeiros passos. Quero o mesmo padrão aqui, mas só depois que as funcionalidades estiverem prontas.
- **Alternativas consideradas:** deixar só o Docker Compose; substituir o Compose por Kubernetes; incluir a orquestração antes da fase de modo offline.
- **Escolha:** Um repositório `orchestration` na **fase D**, depois das fases A (obrigatórios), B (crédito, histórico, aprovação, notificações) e C (offline). Ele contém: o gráfico Helm guarda-chuva com um subgráfico por serviço (cada serviço mantém o seu em `/k8s`), a configuração do cluster kind sem CNI padrão e com Calico para que as NetworkPolicies sejam aplicadas, o ingress, um `Deployment` por serviço com `wait-for-postgres`, contexto de segurança não-root, probes em `/health`, Secrets e ConfigMaps, e o guia de primeiros passos com imagens baixadas do GHCR. **O arquivo do Docker Compose também passa a morar nele**, para haver um único lugar que define como tudo roda.
- **Como atende ao enunciado:** o enunciado exige `docker compose up`. Até a fase D o compose fica na raiz; na fase D o repositório raiz mantém um `docker-compose.yml` fino que usa `include:` para o do `orchestration`, então o comando continua o mesmo.
- **Por quê:** Mantém o padrão que já uso e deixa a infraestrutura de execução concentrada, sem atrasar as regras de negócio, que é o que a avaliação pesa.
- **Risco assumido:** É a fase mais dispensável para o enunciado; se o tempo acabar, o Compose na raiz continua sendo uma entrega completa, e isso será dito no README.
- **O que faria diferente:** Fazer a versão mínima do Helm (um subgráfico) junto da fase A, para validar a forma de implantação cedo.

## D30. Identity: quem pode ver o quê é decidido no servidor, com o usuário repassado pelo BFF

- **Contexto:** O enunciado pede que o vendedor veja apenas os clientes da sua carteira, e o login é simulado (escolher o vendedor).
- **Alternativas consideradas:** o BFF filtrar a carteira sozinho; o identity confiar no `sellerId` do caminho; o identity emitir tokens.
- **Escolha:** O BFF valida a escolha com `POST /sessions/validate`, guarda a sessão e, em cada chamada, repassa `x-user-id` e `x-user-role` junto do segredo interno. O identity aplica a regra em uma função pura: um vendedor só acessa a própria carteira, e um supervisor só a dos vendedores que supervisiona. Um vendedor que pede o cliente de outro recebe a mesma resposta (404) de um cliente inexistente, e quem pede a carteira alheia recebe 403. As leituras entre serviços (gRPC) não passam por essa regra, porque o chamador é de confiança.
- **Por quê:** A restrição vale mesmo que o BFF tenha um erro de filtro, e a regra tem testes diretos (quebrar a regra de propósito derrubou 3 testes em cada variação).
- **Risco assumido:** O identity confia nos cabeçalhos de usuário do BFF, protegidos apenas pelo segredo compartilhado (D16).
- **O que faria diferente:** Tokens assinados com o usuário dentro, em vez de cabeçalhos.

## D31. O crédito utilizado não é sobrescrito pela carga do seed

- **Contexto:** O identity importa o seed a cada partida, e o crédito utilizado passará a ser alterado pelos pedidos (reserva, D22).
- **Alternativas consideradas:** sobrescrever tudo a cada partida (simples, mas apagaria o crédito consumido); importar só quando a tabela está vazia.
- **Escolha:** A carga atualiza os demais campos, mas não toca em `credit_used_cents` depois da primeira carga. Há um teste para isso.
- **Por quê:** Reiniciar o serviço não pode devolver crédito.
- **O que faria diferente:** Separar a carga de dados de referência (a que reexecuta) da carga inicial de saldos (que roda uma vez).

## D32. Motor de regras puro: bloqueios e motivos de aprovação são coisas diferentes

- **Contexto:** O enunciado separa "bloquear o envio" (regras não atendidas) de "aguardando aprovação" (desconto acima da alçada). A avaliação pede testes das regras de negócio.
- **Alternativas consideradas:** regras espalhadas pelo serviço e pelo controlador; lançar exceção no primeiro problema; regras no frontend.
- **Escolha:** `calculateOrder(pedido, produtos, política)` é uma função pura em `order-rules.ts`: recebe dados simples e devolve dados simples. Ela devolve os totais, **todos** os bloqueios (por linha e do pedido) e todos os motivos de aprovação, de uma vez, para a tela mostrar tudo ao vendedor. Bloqueios: pedido vazio, abaixo do mínimo, produto desconhecido/inativo/sem preço, quantidade inválida, embalagem indisponível, quantidade que não é múltipla, linha repetida, desconto inválido. Aprovação: desconto de linha ou de pedido acima do limite efetivo (o menor entre a alçada do vendedor e o teto global `MAX_DISCOUNT_BP`, padrão 10%). A quantidade chega como `quantity` + `unit` (UNIT/PACK) e o backend converte; um produto aparece em uma linha só.
- **Por quê:** Uma única implementação, sem I/O, que se testa com tabelas de exemplos. Os exemplos de arredondamento do `ASSUMPTIONS.md` e os casos de borda (desconto exatamente na alçada e um ponto-base acima, R$ 299,99 e R$ 300,00, quantidade fora do múltiplo) são testes. Quebrar de propósito sete linhas do motor derrubou testes em todos os casos.
- **Custo assumido:** Linhas bloqueadas ficam fora do total exibido; o total só vale quando `canSubmit` é verdadeiro.
- **O que faria diferente:** Tratar mais de uma moeda e tabelas de preço com vigência, que o enunciado não pede.

## D33. Cálculo sem estado, envio idempotente pelo id do pedido

- **Contexto:** O rascunho fica no navegador (D20) e o vendedor pode enviar duas vezes (toque duplo, sinal ruim).
- **Alternativas consideradas:** rascunho salvo no servidor; chave de idempotência em uma tabela à parte; checar "já existe?" antes de inserir.
- **Escolha:** `POST /orders/calculate` não grava nada. `POST /orders` recebe um `orderId` (UUID) gerado pelo cliente. Se o pedido já existe, devolve o mesmo pedido sem recalcular nem publicar de novo. A chave primária da tabela `orders` é a garantia: duas requisições simultâneas com o mesmo id resultam em um pedido e um evento. Preço e dados do produto são copiados para cada linha no envio. Um pedido de outro vendedor responde como inexistente.
- **Bug encontrado pelos testes:** o repositório tratava qualquer violação de unicidade como "pedido já existe", inclusive uma linha repetida. Agora só a violação da chave `orders_pkey` conta como pedido existente.
- **O que faria diferente:** Registrar a chave de idempotência também para o `approve`/`reject` da fase B.

## D34. Eventos num exchange `topic`, publicados depois de salvar, sem outbox ainda

- **Contexto:** Três serviços vão consumir os mesmos eventos (identity, catalog, notifications), e o `@nestjs/microservices` por padrão envia para uma única fila.
- **Alternativas consideradas:** uma fila compartilhada; um exchange `fanout`; um outbox transacional.
- **Escolha:** O orders publica no exchange `orders.events` (tipo `topic`, com curingas) com a chave `order.submitted`. Cada consumidor vincula a sua própria fila com nome explícito (`<serviço>-api-<evento>`). O Nest envolve a carga como `{ "pattern", "data" }`. Foi verificado com uma fila de teste vinculada a `order.*`. A publicação ocorre depois da gravação; se o broker falhar, o erro é registrado e o pedido continua salvo.
- **Risco assumido:** Sem outbox, um evento pode se perder (broker parado no momento do envio). O limite de 15 minutos da reserva de crédito (D22) depende desse evento chegar.
- **O que faria diferente:** Outbox transacional no orders, publicando por um processo que relê a tabela.

## D35. O gerador do contracts passa a emitir o parâmetro de metadados

- **Contexto:** O segredo interno viaja nos metadados do gRPC, mas o cliente gerado só aceitava a requisição.
- **Escolha:** `addGrpcMetadata=true` no `buf.gen.yaml`. As chamadas do orders passam `x-inner-auth` nos metadados, com prazo de `GRPC_TIMEOUT_MS`; `NOT_FOUND` vira "não encontrado" e qualquer outra falha vira 503 ("indisponível, tente de novo"), nunca 500.

## D36. Sessão do BFF: cookie com id opaco + Redis, escrita à mão

- **Contexto:** O D16 previa a sessão no Redis, dona do BFF. Ao ler o código do `nuxt-auth-utils`, vi que ele guarda a sessão inteira num cookie criptografado e que seus ganchos (`fetch`, `clear`) só acrescentam dados ou registram; não há armazenamento externo plugável.
- **Alternativas consideradas:** `nuxt-auth-utils` como é (sem Redis, sessão não revogável); `nuxt-auth-utils` guardando só um id e eu buscando o usuário no Redis (o módulo viraria só um criptografador de cookie).
- **Escolha:** Código próprio e pequeno em `server/utils/session.ts`. O navegador guarda só um id aleatório de 256 bits num cookie `HttpOnly` e `SameSite=Lax`; o usuário fica no Redis com expiração deslizante (8 h, renovada a cada leitura); o logout apaga a chave; cada login gera um id novo (contra fixação de sessão). O `Secure` do cookie é ligado por variável de ambiente quando houver HTTPS.
- **Por quê:** A sessão pode ser encerrada no servidor, nada sobre o usuário viaja no cookie, e o código cabe numa tela para explicar ao vivo. Isso mantém a decisão de usar Redis.
- **Verificado:** um cookie antigo depois do logout e um id inventado recebem 401; a resposta e o HTML entregue ao navegador não contêm o segredo interno nem URLs internas (busca textual).
- **Falha encontrada na verificação:** um `POST` com corpo de formulário (`application/x-www-form-urlencoded`) fazia login, ao contrário do que um comentário meu afirmava. Agora toda requisição com corpo precisa ser JSON (415 caso contrário); há testes da regra.
- **O que faria diferente:** Trocar o segredo compartilhado do BFF por tokens assinados por chamada (já anotado em D16) e adicionar limite de tentativas ao login quando ele deixar de ser simulado.

## D37. Versões do TypeScript: 7 só no contracts; 6.0.3 no web (correção do D23)

- **Contexto:** O D23 escolheu o TypeScript 7.0.2 e anotou o risco de ferramentas incompatíveis.
- **O que aconteceu:** O `vue-tsc` 3.3.13 não roda sobre o TypeScript 7 (`ERR_PACKAGE_PATH_NOT_EXPORTED` para `typescript/lib/tsc`). Os serviços criados pela CLI do Nest já vieram com `typescript ^6.0.2`; só o `contracts` usa o 7.0.2 (e compila, checa tipos e testa sem problema).
- **Escolha:** O `web` fica com o 6.0.3 (o plano de contingência do D23). Os serviços Nest ficam no 6.x da CLI. O `contracts` permanece no 7.0.2.
- **Por quê:** O que importa é que `typecheck` funcione em cada repositório. Alinhar tudo no 6.0.3 seria mais simples de explicar.
- **O que faria diferente:** Fixar o 6.0.3 em todos os repositórios até o `vue-tsc` suportar o 7, e então subir todos juntos.

## D38. A tela do pedido: uma página mobile-first, totais sempre vindos do backend

- **Contexto:** O vendedor usa o celular em campo; as regras são do backend (D4, D20).
- **Alternativas consideradas:** duas páginas (catálogo e carrinho); botão "Calcular"; calcular totais no navegador.
- **Escolha:** Uma única página: busca no topo, itens abaixo, totais e o botão Enviar fixos embaixo. Depois de cada edição (300 ms) o navegador pede o cálculo; a chave da consulta é o próprio rascunho, então uma resposta antiga nunca substitui uma nova. O botão Enviar só habilita quando o backend disse que pode enviar **e** nada mudou desde então. O Pinia guarda só o que o vendedor digitou (produtos, quantidades, unidade, descontos, id do pedido); o rascunho é gravado no `localStorage` e sobrevive a recarregar a página ou à sessão expirar. O id do pedido é gerado uma vez por pedido, então reenviar não duplica. Os tipos das respostas são escritos à mão no front (fecha a pendência "tipos do front" com a opção manual).
- **Achados ao usar a tela de verdade:** o campo numérico do Nuxt UI só confirmava a quantidade ao perder o foco (o total ficava atrasado) e foi trocado por um campo numérico simples; o botão desabilitado quase não parecia desabilitado (o estilo do componente vencia o meu); e o selo "Enviado" aparecia mesmo com o pedido bloqueado, então agora só aparece quando o envio é possível.
- **Acessibilidade:** os avisos que aparecem enquanto o vendedor digita (bloqueios, falha de envio) têm `role="alert"` e os avisos de aprovação `role="status"`; o componente de alerta do Nuxt UI não traz esses papéis, então um leitor de tela não os anunciaria.
- **Custo assumido:** Os tipos escritos à mão podem se afastar das respostas reais; não há testes de componente (a lógica que vale testar está no store, nos utilitários e no BFF).
- **O que faria diferente:** Gerar os tipos a partir da especificação OpenAPI dos serviços e testar a tela com Playwright.

## D39. SPA com BFF, ícones locais e cache limpo quando a sessão termina

- **Contexto:** O app precisa funcionar em contêiner sem acesso à internet para ícones e, depois, offline (fase C); e os dados em cache de uma pessoa não podem aparecer para a próxima.
- **Escolha:** `ssr: false` (as páginas rodam no navegador; o servidor Nitro continua sendo o BFF). Os ícones vêm do pacote local `@iconify-json/lucide`, sem CDN. Uma sessão que termina (logout ou 401 no meio do pedido) esvazia o cache do TanStack Query; no 401 o visitante volta à tela de login e o rascunho continua guardado.
- **O que faria diferente:** Ao implementar o modo offline, avaliar um service worker com `@vite-pwa/nuxt`.
