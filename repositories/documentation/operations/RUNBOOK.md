# Operação

Receitas para olhar dentro do sistema quando algo não bate. Os comandos de Compose valem na raiz do projeto; os de Kubernetes, com o cluster `sales` no ar (`repositories/orchestration/scripts/up.sh`). Não há ferramenta de operação própria: tudo isto é `docker`, `psql`, `kubectl` e o painel do RabbitMQ.

## 1. Logs

```bash
docker compose logs -f orders-api                 # Compose: um serviço
docker compose logs --since 10m                   # todos, últimos minutos
kubectl -n sales logs deploy/orders-api -f        # Kubernetes
kubectl -n sales logs <pod> -c wait-for-dependencies   # um pod preso em Init
```

Os logs são JSON estruturados e **não trazem corpo de requisição**.

## 2. Olhar o banco

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
# Kubernetes:
kubectl -n sales exec -it postgres-0 -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Consultas úteis (um schema por serviço):

```sql
-- pedidos por status
SELECT status, count(*) FROM orders.orders GROUP BY status;
-- o caminho de um pedido
SELECT status, actor, created_at FROM orders.order_status_history WHERE order_id = '<id>' ORDER BY id;
-- crédito: reservas de um cliente
SELECT order_id, amount_cents, status, expires_at FROM identity.credit_reservations WHERE client_id = 'C001';
-- avisos de uma pessoa
SELECT kind, order_id, read_at, resolved_at FROM notifications.notifications WHERE recipient_id = 'S01' ORDER BY created_at DESC;
-- estatística de mais pedidos
SELECT * FROM catalog.product_stats ORDER BY units_ordered DESC;
```

O administrador enxerga todos os schemas; os papéis dos serviços, só o próprio.

## 3. Filas e mensagens mortas

Com `docker-compose.dev.yml` o painel do RabbitMQ fica em `http://localhost:15672` (usuário `sales`, senha `RABBITMQ_PASSWORD` do `.env`). Em Kubernetes, `kubectl -n sales port-forward svc/rabbitmq 15672` **não funciona**: o Service só expõe a porta 5672; para o painel, use a porta 15672 do pod (`kubectl -n sales port-forward pod/rabbitmq-0 15672`).

- As filas são `identity-api-order-events`, `catalog-api-order-events` e `notifications-api-order-events`, cada uma com a sua `.dlq`.
- Uma mensagem na `.dlq` é de um destes tipos: esquema inválido (vai direto), tratamento que falhou até o limite de entregas, ou uma ligação antiga que entregou um evento sem tratador (D46).
- **Não existe ferramenta de reprocessamento.** Para ver uma mensagem: painel, fila, "Get messages". Para reenviá-la, publique-a de novo no exchange `orders.events` pelo painel. O consumo é idempotente, então reenviar é seguro.

```bash
RP=$(grep '^RABBITMQ_PASSWORD=' .env | cut -d= -f2-)
curl -s -u sales:$RP localhost:15672/api/queues | python3 -c "import sys,json; [print(q['name'], q.get('messages')) for q in json.load(sys.stdin)]"
```

## 4. Voltar ao zero

```bash
docker compose down -v          # Compose: apaga o volume do PostgreSQL; o seed volta na próxima partida
repositories/orchestration/scripts/down.sh   # Kubernetes: apaga o cluster inteiro
```

**Atenção em Kubernetes:** o Secret de senhas é criado uma vez e o banco guarda as senhas com que nasceu. Apagar só o Secret (e não o volume) deixa os serviços sem conseguir entrar no banco, porque o script que cria os papéis só roda na primeira partida de um volume vazio (deduzido do funcionamento, não experimentado); apague o cluster, ou os dois.

## 5. Conferir o cluster

```bash
repositories/orchestration/scripts/verify.sh
```

Confere os pods, o sistema pelo ingress (login, pedido, mesmo id de novo, fluxo SSE), que o segredo interno não está nos arquivos que o navegador baixa e onze conexões entre pods (as permitidas funcionam, as proibidas expiram).

## 6. Reconstruir uma imagem no cluster

```bash
cd repositories
docker build -q -t sales-orders-api:local -f orders-api/Dockerfile .   # o web: docker build -t sales-web:local web
kind load docker-image sales-orders-api:local --name sales
kubectl -n sales rollout restart deploy/orders-api
```

A tag é sempre `local`, então só o `rollout restart` faz o pod usar a imagem nova.

## 7. Falhas conhecidas do cluster

| Sintoma | Causa | Saída |
|---|---|---|
| Nó que nunca fica pronto | limite de `inotify` do computador | veja `GETTING_STARTED.md` |
| Pod em `Init` | espera uma dependência que não responde (ou que a política de rede bloqueia) | `kubectl logs <pod> -c wait-for-dependencies` |
| `helm` expira esperando o Traefik | o Service ficou `LoadBalancer` (nesta versão do gráfico, o tipo está em `service.spec.type`) | já corrigido em `charts/traefik-values.yaml` |
| Serviços recusam a senha do banco | Secret recriado com o volume antigo | seção 4 |
| `docker compose up` e o kind brigam | a porta 8080 é a mesma | pare um dos dois |
