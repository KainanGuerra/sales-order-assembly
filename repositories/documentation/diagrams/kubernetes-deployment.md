# Implantação em Kubernetes

O mesmo sistema num cluster kind de um nó. O namespace `sales` nega todo o tráfego, nos dois sentidos; cada carga abre só os caminhos listados (o DNS sai sempre). Só o `web` é alcançável de fora, pelo ingress.

```mermaid
flowchart TB
    Host["localhost:8080"] --> Traefik["Traefik (namespace traefik)"]
    subgraph sales ["namespace sales: nega tudo, entrada e saída"]
        Web["web :3000"]
        Identity["identity-api :3001 / gRPC 50051"]
        Catalog["catalog-api :3002 / gRPC 50052"]
        Orders["orders-api :3003"]
        Notif["notifications-api :3004"]
        PG[("postgres :5432")]
        MQ(("rabbitmq :5672"))
        Redis[("redis :6379")]
    end
    Traefik -->|"3000"| Web
    Web -->|"3001"| Identity
    Web -->|"3002"| Catalog
    Web -->|"3003"| Orders
    Web -->|"3004"| Notif
    Web -->|"6379"| Redis
    Orders -->|"gRPC 50052"| Catalog
    Orders -->|"gRPC 50051"| Identity
    Identity --> PG
    Catalog --> PG
    Orders --> PG
    Notif --> PG
    Identity --> MQ
    Catalog --> MQ
    Orders --> MQ
    Notif --> MQ
```

Qualquer outro caminho (por exemplo `web` para `postgres`, ou `catalog-api` para `orders-api`) é bloqueado; `scripts/verify.sh` prova isso abrindo conexões de dentro dos pods. Referenciado em `../architecture/ARCHITECTURE.md` §10.
