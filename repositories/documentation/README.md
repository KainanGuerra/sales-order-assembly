# Documentação

A documentação do sistema de montagem de pedidos: contexto, arquitetura, diagramas, como rodar, testes, operação e pendências. `README.md`, `DECISIONS.md`, `ASSUMPTIONS.md` e `AI_LOG.md` ficam **na raiz do repositório**, não aqui; esta pasta é o resto, para quem quer entender o sistema.

Em uma linha cada: [`DECISIONS.md`](../../DECISIONS.md) é o **porquê**, [`ASSUMPTIONS.md`](../../ASSUMPTIONS.md) é o **que foi interpretado**, [`ARCHITECTURE.md`](architecture/ARCHITECTURE.md) é o **que foi construído**, [`CODE_MAP.md`](architecture/CODE_MAP.md) é **onde está no código**, e [`PENDINGS.md`](pendings/PENDINGS.md) é **o que falta**.

## Por onde começar

1. [`context/CONTEXT.md`](context/CONTEXT.md): o problema, os requisitos e onde foram atendidos.
2. [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) e os [diagramas](diagrams/): como é feito.
3. [`getting-started/GETTING_STARTED.md`](getting-started/GETTING_STARTED.md): como rodar e conferir.
4. [`architecture/CODE_MAP.md`](architecture/CODE_MAP.md): para ler o código.

## Os documentos

| Documento | Conteúdo |
|---|---|
| [`context/CONTEXT.md`](context/CONTEXT.md) | O problema, os requisitos e onde foram atendidos, fases, como o trabalho foi conduzido, decisões por tema, glossário |
| [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) | Serviços, dados, comunicação, ciclo do pedido, crédito, eventos, avisos, sessão, modo offline, implantação, segurança |
| [`architecture/CODE_MAP.md`](architecture/CODE_MAP.md) | Onde mudar cada regra, o caminho de um pedido no código, rotas, como rodar um teste |
| [`diagrams/`](diagrams/) | Nove diagramas Mermaid (topologia, dados, envio, status, crédito, eventos, avisos, offline, Kubernetes) |
| [`getting-started/GETTING_STARTED.md`](getting-started/GETTING_STARTED.md) | Pré-requisitos, `.env`, Compose, Kubernetes, problemas comuns |
| [`testing/TESTING.md`](testing/TESTING.md) | Contagem de testes, como rodar, revisão por mutação, o que não é coberto |
| [`operations/RUNBOOK.md`](operations/RUNBOOK.md) | Logs, banco, filas e mensagens mortas, voltar ao zero, falhas do cluster |
| [`pendings/PENDINGS.md`](pendings/PENDINGS.md) | O que falta para entregar, limites conhecidos, o que seria feito diferente |
| [`style-guide/`](style-guide/README.md) | Convenções de engenharia que os serviços seguem (em inglês) |

## Como esta documentação é organizada

O padrão é o do repositório de documentação de um projeto anterior meu, adaptado (a lista do que foi copiado e do que mudou está abaixo).

- **Uma pasta por intenção de leitura**, em minúsculas com hífen: `context`, `architecture`, `getting-started`, `testing`, `operations`, `pendings`, `diagrams`, `style-guide`. Sem numeração nos nomes e sem pasta `docs/` por fora.
- **Nomes de arquivo em inglês, em `MAIÚSCULAS_COM_SUBLINHADO`** (`ARCHITECTURE.md`), conteúdo em português. A pasta `diagrams/` usa minúsculas com hífen.
- **Seções numeradas** (`## 1.`) nos documentos longos, para citar "ARCHITECTURE §5".
- **Diagramas em Mermaid, um por arquivo**, em `diagrams/`: título, um parágrafo, o diagrama e a última linha "Referenciado em `../architecture/ARCHITECTURE.md` §N". O texto da arquitetura só **aponta** para os diagramas, nunca os copia. Rótulos em português. Linhas tracejadas são assíncronas.
- **Decisões** não ficam aqui: ficam em `DECISIONS.md` (contexto, alternativas, escolha, por quê, o que faria diferente), na raiz. Aqui elas são citadas como D*n* e A*n*. **Nunca escreva o total de decisões como número**; ele muda.
- **Links relativos**: para a raiz com `../../` e para os serviços com `../../<pasta>`.
- **Nada de caminhos locais, nomes de empresas de terceiros ou credenciais**; os segredos aparecem só pelo nome da variável.
- **Sem CI e sem gerador:** é markdown escrito à mão, lido no GitHub. Toda mudança de comportamento no código vem com a mudança do documento correspondente **no mesmo commit**.

**O que se copiou do padrão anterior:** pasta por intenção, nomes `MAIÚSCULAS`, Mermaid um por arquivo com a linha de referência, seções numeradas, tabela de problemas comuns, faixa de estado nas pendências, uma tabela "Documentos" no `CLAUDE.md`, sem CI.

**O que mudou:** só português, sem pares `en-US`/`pt-BR` e sem pastas-resumo de três linhas (os nomes em inglês permitem acrescentar um par depois); o registro de decisões fica na raiz, para ficar junto do `README.md`; sem a pasta de ensaios de "descobertas"; acrescentados `CODE_MAP.md`, `TESTING.md` e `RUNBOOK.md`.
