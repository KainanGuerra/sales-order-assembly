# Pendências

**Estado:** as fases A a D estão prontas e verificadas no ambiente local. Falta a **entrega** (dividir os repositórios, publicar as imagens, conferir a partir de um clone limpo) e há limites conhecidos, listados abaixo com honestidade. O que **seria feito diferente** com mais tempo está em cada decisão de [`DECISIONS.md`](../../../DECISIONS.md) e foi reunido na seção 4.

## 1. Para entregar (em ordem)

1. **Dividir os repositórios e publicar as imagens** (D9, D26, D29). Uma organização nova no GitHub; um repositório por serviço; este como guarda-chuva, com os serviços como submódulos; as imagens no GHCR pelo CI de cada serviço. Hoje tudo é uma pasta de um repositório só e nada foi enviado a lugar nenhum. Ao dividir:
   - o `docker-compose.yml` vai para o repositório de orquestração e a raiz mantém um arquivo fino com `include:` (D29);
   - os caminhos `file://../../../<serviço>/k8s` do gráfico `umbrella` e `file://../../orchestration/charts/sales-lib` dos gráficos dos serviços passam a apontar para submódulos;
   - a documentação vira repositório próprio, e os links relativos `../../../DECISIONS.md` (e os de `README.md`, `ASSUMPTIONS.md`, `AI_LOG.md`) viram links do GitHub;
   - o CI roda pela **primeira vez** no GitHub (nunca rodou).
2. **Passada final de entrega:**
   - clone limpo + `docker compose up --build` funcionando (ainda não foi feito);
   - procurar o segredo interno no pacote do navegador na versão do Compose (no Kubernetes isso já é conferido por `verify.sh`);
   - procurar caminhos locais, nomes de empresas e credenciais nos arquivos versionados;
   - `AI_LOG.md`: ler, escrever com as próprias palavras e resolver as duas marcas `_(confirmar)_` (quanto do código da interface foi lido; se os três métodos de arredondamento podem ser explicados);
   - conferir que cada commit termina com a linha `IA:`.
3. **Ver os diagramas desta documentação renderizados** (seção 3): a sintaxe foi conferida, a aparência não.

## 2. Limites conhecidos (todos já escritos no `README.md`, "O que ficou de fora")

- **Sem outbox:** se o RabbitMQ estiver fora no envio, o evento se perde (D34, D40). Sem ferramenta para reprocessar mensagens mortas (D42).
- **Avisos em tempo real num processo só:** o difusor do `notifications` não funciona com mais de uma réplica (D50). A lista de avisos só cresce (D51).
- **Nenhuma verificação em celular real nem com sinal fraco de verdade.** O limite de 8 s do modo offline é escolhido, não medido (D55). O envio da fila só acontece com o app aberto (D54). Os pedidos guardados ficam no `localStorage` (D56).
- **Sem testes de componente do front nem testes ponta a ponta automatizados;** as passadas no navegador foram manuais.
- **O CI nunca rodou** no GitHub, e `verify.sh` não está nele (D59).
- **Kubernetes:** uma réplica de tudo, sem TLS (de propósito, D59), sem escala automática, limites de recursos chutados, sem cópia de segurança do volume do banco; imagens construídas na máquina; a interface não foi conferida no navegador dentro do cluster.
- **Login simulado** (D11): escolher a pessoa; sem senha.
- **Sem faturamento** (o status `INVOICED` só existe nos pedidos do seed, D47) e sem cancelamento pelo vendedor (D44).

## 3. Diagramas

Os nove diagramas em [`../diagrams/`](../diagrams/) são Mermaid escritos à mão. **A sintaxe de todos passou pelo analisador do Mermaid 11.4.1** (rodado em Node, fora do repositório); nessa conferência um deles tinha um erro real, um `;` dentro de uma mensagem, e foi corrigido. **A aparência não foi conferida:** analisar não é desenhar, e o GitHub pode usar outra versão do Mermaid. Para ver, abra os arquivos no GitHub (que renderiza Mermaid) ou cole o bloco em um editor de Mermaid.

## 4. O que faria diferente (reunido de `DECISIONS.md`)

**Produto e regras**
- Um prazo para o supervisor decidir e o cancelamento pelo vendedor (D44); uma ação de faturamento que marque `INVOICED` (D47).
- Paginar o histórico e mostrar o que mudou de preço (D48); mostrar o crédito reservado por pedidos aguardando (D43).
- Cada pessoa escolher quais avisos recebe (D49); apagar avisos antigos (D51).
- A estatística de mais pedidos com janela de tempo (D52) e uma conciliação entre o `orders` e o catálogo (D53).

**Mensageria e dados**
- Outbox transacional no `orders` (D34); um painel ou comando para reenviar mensagens mortas (D42).
- Difundir os avisos entre réplicas pelo RabbitMQ ou pelo Redis (D50).
- Um papel de migração separado e trava consultiva quando houver mais de uma réplica (D27); separar a carga de referência da carga inicial de saldos (D31).
- Registrar a chave de idempotência também em `approve` e `reject` (D33).

**Segurança e acesso**
- Tokens assinados por chamada no lugar do segredo compartilhado e dos cabeçalhos (D16, D28, D30, D36); autenticação real e limite de tentativas (D11, D36).
- Cifrar a fila offline, ou pedir o login do mesmo vendedor para mostrá-la (D56).

**Offline e interface**
- IndexedDB e Background Sync, para enviar com o app fechado (D54); medir o limite de 8 s (D55).
- Testar num celular real com sinal ruim (D6); testes ponta a ponta com Playwright e tipos gerados da especificação OpenAPI (D38).

**Plataforma e processo**
- Publicar a biblioteca de gráficos como pacote OCI (D57); migrar para Gateway API (D58); rodar `verify.sh` no CI (D59).
- Publicar o pacote `contracts` com versão semântica (D18, D24, D26).
- Estimar o tempo de cada fase antes de começar (D10); medir antes de afirmar (D12, D17).
- Registrar no `AI_LOG.md` o commit de cada trecho gerado por IA (D14).
