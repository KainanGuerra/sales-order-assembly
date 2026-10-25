# Montagem de pedidos para vendedores externos

Módulo para vendedores que visitam pequenos varejistas (mercadinhos, minimercados, conveniências), consultam o catálogo e fecham o pedido no cliente, muitas vezes com sinal ruim. O enunciado original está em [`SCOPE.md`](SCOPE.md).

## Estado atual

**Fase A funcionando em Docker Compose**: interface web (Nuxt), catálogo, identity e orders, com PostgreSQL, RabbitMQ e Redis. Crédito, aprovação do supervisor, histórico com "repetir pedido" e notificações já funcionam; a estatística de produtos mais pedidos no catálogo também; falta o modo offline.

| Fase | Conteúdo | Estado |
|---|---|---|
| A | Requisitos obrigatórios 1–6 | Pronta: backend (catálogo, identity, orders com regras e testes) e interface (Nuxt) |
| B | Limite de crédito, aprovação do supervisor, histórico com "repetir pedido", notificações | Pronta: crédito, aprovação, histórico com "repetir pedido", notificações e a estatística de produtos no catálogo |
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
| `sales-notifications-api` | Avisos a vendedores e supervisores, com fluxo SSE |
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

Depois de `docker compose up`, abra `http://localhost:8080`. É o único serviço com porta publicada; os demais ficam na rede interna.

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

**Da fase A, por escolha ou por falta de verificação**

- A tela foi conferida num navegador de computador e numa moldura de 390 px de largura (uma aproximação de celular: sem rolagem horizontal, grade de duas colunas, barra de totais fixa); **não foi testada em um aparelho real**.
- Os caminhos de erro da tela do pedido foram exercitados com **falhas simuladas** (a chamada de rede foi interceptada na própria página): recusa do envio (422), falha de rede ao enviar (o reenvio usa o mesmo id e conclui) e cálculo indisponível (aviso, botão desabilitado, volta ao normal na edição seguinte). Contra o backend de verdade, a recusa só foi exercitada por testes e por chamadas à API.
- Não há testes de componente do front; a lógica testada está no motor de regras, nos serviços, no store, nos utilitários e no BFF.
- Os fluxos de CI (testes e publicação das imagens no GHCR) estão escritos, **mas nunca rodaram no GitHub**.
- A publicação dos eventos não usa outbox: se o RabbitMQ estiver fora no envio, o evento se perde (e com ele um aviso ou uma confirmação de crédito, que a reserva só recupera pela expiração).
- Os avisos em tempo real (SSE) são difundidos no processo do notifications: com mais de uma réplica, precisariam de um corretor entre elas.
- Modo offline e a orquestração com Helm são as fases C e D.

**Fora do escopo do enunciado:** estoque, autenticação real, notificações externas, várias moedas.
