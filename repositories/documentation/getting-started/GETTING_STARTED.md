# Primeiros passos

Como rodar o sistema, conferir que funciona e entrar nele. Há dois jeitos: **Docker Compose** (o mais simples) e **Kubernetes local** (kind, Helm). Para entender o que você vai ver, comece por [`CONTEXT.md`](../context/CONTEXT.md) e [`ARCHITECTURE.md`](../architecture/ARCHITECTURE.md).

## Pré-requisitos

- **Docker** com Compose: roda tudo.
- **Node 24 e pnpm 12** (`corepack enable`): só para rodar testes e desenvolver fora do Docker.
- Para Kubernetes: **kind**, **kubectl**, **helm** e **openssl**.
- Acesso à internet na primeira vez (imagens base e pacotes).

## 1. Obter o código

```bash
git clone https://github.com/KainanGuerra/sales-order-assembly.git
cd sales-order-assembly
```

Os serviços são pastas do próprio repositório (`repositories/`); não há submódulos (D60).

## 2. Criar o `.env`

```bash
sh scripts/init-env.sh
```

Cria o `.env` a partir do `.env.example`, com senhas aleatórias (nenhum segredo vai para o repositório). Não sobrescreve um `.env` que já existe.

| Variável | Para que serve | Padrão |
|---|---|---|
| `POSTGRES_PASSWORD`, `*_DB_PASSWORD` | administrador e um papel por serviço | gerado |
| `RABBITMQ_PASSWORD`, `REDIS_PASSWORD` | corretor e sessões | gerado |
| `INNER_AUTH` | segredo entre o BFF e os serviços (só no servidor) | gerado |
| `MIN_ORDER_CENTS` | pedido mínimo, em centavos | 30000 |
| `MAX_DISCOUNT_BP` | teto global de desconto, em pontos-base | 1000 |
| `DEFAULT_PRICE_TABLE_ID` | tabela para cliente sem tabela | TP01 |
| `SHOW_UNAVAILABLE_PRODUCTS` | mostrar produto sem preço na tabela, desabilitado | true |
| `RESERVATION_TTL_SECONDS` | validade de uma reserva de crédito | 900 |
| `CONSUMER_MAX_DELIVERIES` | reentregas de um evento que falha | 5 |
| `WEB_PORT` | porta do computador | 8080 |
| `IMAGE_REGISTRY`, `IMAGE_TAG` | de onde vêm as imagens e qual versão | `ghcr.io/kainanguerra`, `latest` |

## 3. Subir com Docker Compose

São duas formas. As duas dão o mesmo sistema (PostgreSQL, RabbitMQ, Redis e os cinco serviços); o que muda é de onde vêm as imagens.

**Forma 1: imagens publicadas, sem compilar.** O CI publica as cinco imagens (`ghcr.io/kainanguerra/sales-<serviço>`) no GitHub Container Registry a cada push na `main`.

```bash
docker compose pull
docker compose up
```

**Forma 2: construir as imagens aqui.** A primeira vez demora (instala as dependências e compila).

```bash
docker compose up --build
```

- `IMAGE_REGISTRY` e `IMAGE_TAG` (no `.env`) escolhem o repositório e a versão das imagens; o padrão é `latest`. Para fixar uma versão publicada, use o sha completo do commit.
- `docker compose pull` responde `denied` quando as imagens ainda não são públicas (ou o nome não existe): use a forma 2.
- `docker compose up` sozinho usa a imagem que já estiver na máquina; se não houver, tenta baixar e, se não conseguir, constrói. Isso foi conferido com a imagem ainda não publicada (construiu) e com uma imagem local (usou-a). A forma 1 foi conferida com as imagens publicadas, a partir de um clone público: `docker compose pull` sem login e `docker compose up` sem compilar subiram o sistema.
- Cada serviço leva o próprio `seed/seed.json` dentro da imagem, então as duas formas importam os mesmos dados de exemplo na partida.

Abra `http://localhost:8080`: é a **única** porta publicada; os serviços ficam na rede interna.

Para depurar, `docker-compose.dev.yml` publica portas só em loopback:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

| O quê | Porta no computador |
|---|---|
| web | 8080 |
| catalog-api (HTTP, gRPC) | 13002, 15052 |
| identity-api (HTTP, gRPC) | 13001, 15051 |
| orders-api | 13003 |
| notifications-api | 13004 |
| painel do RabbitMQ | 15672 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## 4. Conferir

- Saúde: `curl http://localhost:8080/api/health` responde `{"status":"ok"}`; cada serviço responde `GET /health` na própria porta.
- Entre como vendedor (Carlos Menezes, Paulo Andrade ou Renata Lima) ou como supervisor (Marta Fernandes): o login só pede para escolher a pessoa.
- Roteiro rápido: **vendedor** → um cliente → "Novo pedido" → buscar "arroz" → adicionar → subir a quantidade até passar de R$ 300,00 → "Enviar pedido". Para ver a aprovação, dê um desconto de 8% numa linha (acima da alçada de 5% do Carlos): o pedido vai para "Aguardando aprovação" e o **supervisor** recebe o aviso (o sino) e decide na tela "Aprovações" (botão "Analisar").
- Os testes estão em [`TESTING.md`](../testing/TESTING.md).

## 5. Parar

```bash
docker compose down        # mantém os dados do PostgreSQL
docker compose down -v     # apaga também o volume
```

## 6. Kubernetes local

```bash
cd repositories/orchestration
./scripts/up.sh        # cluster kind + Calico + Traefik + imagens + gráficos (5 a 10 min na primeira vez)
./scripts/verify.sh    # o sistema, o segredo e as políticas de rede
# http://localhost:8080
./scripts/down.sh      # apaga o cluster
```

Pare o Compose antes: a porta 8080 é a mesma. O guia completo está em `repositories/orchestration/README.md`.

## 7. Rodar um serviço sozinho

Cada serviço tem o próprio `README.md` (`repositories/<serviço>/README.md`). Em geral, na raiz do projeto:

```bash
sh scripts/init-env.sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build <serviço>   # sobe também o que ele precisa
```

Para desenvolver e testar fora do Docker, dentro da pasta do serviço:

```bash
(cd ../contracts && pnpm install && pnpm build)
pnpm install
pnpm test
```

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `docker compose up` reclama de `POSTGRES_PASSWORD must be set` | falta o `.env` | `sh scripts/init-env.sh` |
| `docker compose pull` responde `denied` | as imagens ainda não são públicas | `docker compose up --build` |
| Os testes do banco aparecem como "skipped" | falta `TEST_DATABASE_URL` | seção 2 de [`TESTING.md`](../testing/TESTING.md) |
| `Cannot find module 'contracts'` ou tipos de evento desatualizados | o `contracts` não foi construído, ou mudou | `pnpm build` no `contracts` e `pnpm install` no serviço |
| A porta 8080 está ocupada | o Compose e o kind usam a mesma | pare um dos dois |
| No kind, o nó nunca fica pronto (`containerd` registra "too many open files") | limite de `inotify` baixo (outro cluster kind na máquina) | `sudo sysctl fs.inotify.max_user_instances=512 fs.inotify.max_user_watches=524288` |
| O modo offline não funciona no `nuxt dev` | o service worker só existe na versão de produção | use a imagem Docker (`docker compose up --build`) |
| Mensagens na fila `*.dlq` depois de renomear um evento | ligação antiga na fila (D46) | `retireBindings` a remove na partida; veja [`RUNBOOK.md`](../operations/RUNBOOK.md) |
| A tela volta ao login depois de reiniciar o `web` | a sessão está no Redis; se o Redis reiniciou, ela se foi | entre de novo; o rascunho continua guardado |
