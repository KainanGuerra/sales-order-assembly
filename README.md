# Montagem de pedidos para vendedores externos

Módulo para vendedores que visitam pequenos varejistas (mercadinhos, minimercados, conveniências), consultam o catálogo e fecham o pedido no cliente, muitas vezes com sinal ruim. O enunciado original está em [`SCOPE.md`](SCOPE.md).

## Estado atual

**Fase de documentação e definição da stack.** Ainda não há código de aplicação; as instruções de execução abaixo descrevem o resultado esperado e serão validadas quando o código existir.

| Fase | Conteúdo | Estado |
|---|---|---|
| A | Requisitos obrigatórios 1–6 | Não iniciada |
| B | Limite de crédito, histórico com "repetir pedido", aprovação do supervisor | Não iniciada |
| C | Pedido offline com sincronização | Não iniciada |
| D | Repositório de orquestração (Helm, kind, ingress), última fase | Não iniciada |

## Stack

Nuxt (Vue 3) + Nuxt UI, Pinia e TanStack Query no frontend; NestJS com Zod no backend; Drizzle ORM; PostgreSQL; Vitest; Docker. As justificativas estão em [`DECISIONS.md`](DECISIONS.md).

## Estrutura de repositórios

O sistema segue o padrão de um repositório por serviço em uma organização do GitHub, mais um repositório guarda-chuva (este) que contém os documentos de entrega, o `docker-compose.yml` e o CI, e traz os serviços como submódulos Git. A distribuição está descrita em [`ARQUITETURA.md`](ARQUITETURA.md).

| Repositório (nomes provisórios) | Papel |
|---|---|
| `sales-web` | Nuxt: telas e BFF (sessão no Redis) |
| `sales-identity-api` | Vendedores, supervisor, clientes, limites, crédito utilizado |
| `sales-catalog-api` | Produtos, tabelas de preço, busca |
| `sales-orders-api` | Regras e ciclo de vida do pedido |
| `sales-notifications-api` | Avisos ao supervisor (fase B) |
| `sales-contracts` | `.proto` e esquemas de eventos |
| `sales-orchestration` | Helm, kind, ingress e Compose (fase D) |

```
<repositório guarda-chuva>
├── README.md  ARQUITETURA.md  DECISIONS.md  ASSUMPTIONS.md  AI_LOG.md  SCOPE.md
├── CLAUDE.md                  instruções para a IA que trabalha no projeto
├── style-guide/               convenções de engenharia
├── seed.json                  dados fornecidos (não alterar)
├── docker-compose.yml         (a criar)
└── repositories/<serviço>/    submódulos (a criar)
```

## Como rodar

Pré-requisitos: Docker com Compose e acesso à internet (as imagens são baixadas do `ghcr.io`).

```bash
git clone --recurse-submodules <url-do-repositório>
cd <pasta>
sh scripts/init-env.sh      # cria o .env com senhas aleatórias (nada de segredo no repositório)
docker compose up
```

Endereços esperados: aplicação web e API em `localhost` (portas a definir), Swagger em `/docs`.

Cada serviço também roda sozinho: veja o `README.md` do repositório dele (`cp .env.example .env && docker compose up --build`).

### Imagens

O CI de cada serviço publica a imagem no GitHub Container Registry (GHCR), com tag do commit e `latest`. O `docker-compose.yml` baixa essas imagens; não é preciso compilar nada localmente.

## Como testar

```bash
pnpm install
pnpm test        # Vitest: regras de negócio e testes de API
```

Os testes das regras cobrem os casos de borda: desconto exatamente na alçada, pedido de R$ 299,99 × R$ 300,00, quantidade fora do múltiplo da embalagem, crédito disponível igual ao total e os exemplos de arredondamento de [`ASSUMPTIONS.md`](ASSUMPTIONS.md).

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [`ARQUITETURA.md`](ARQUITETURA.md) | Serviços, dados, chamadas, eventos e sessão |
| [`DECISIONS.md`](DECISIONS.md) | Decisões: contexto, alternativas, escolha, por quê e o que faria diferente |
| [`ASSUMPTIONS.md`](ASSUMPTIONS.md) | Ambiguidades e interpretações adotadas |
| [`AI_LOG.md`](AI_LOG.md) | Uso de IA e mapa de autoria |
| [`style-guide/`](style-guide/README.md) | Convenções de engenharia |

## O que ficou de fora

_(a preencher ao final de cada fase)_ Itens já previstos como fora do escopo: estoque, autenticação real, notificações ao supervisor, múltiplas moedas.
