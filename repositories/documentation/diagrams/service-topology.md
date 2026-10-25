# Topologia dos serviços

Quem fala com quem. O navegador só conhece o `web` (Nuxt, que também é o BFF). O `web` chama os quatro serviços por HTTP com o segredo interno; o `orders` consulta `catalog` e `identity` por gRPC e é o único que publica eventos no RabbitMQ. Cada serviço grava só no próprio schema do PostgreSQL.

```mermaid
flowchart LR
    Browser["Navegador"] -->|"cookie de sessão"| Web["web (Nuxt + BFF)"]
    Web <-->|"sessão"| Redis[("Redis")]
    Web -->|"HTTP + inner-auth"| Identity["identity-api"]
    Web -->|"HTTP + inner-auth"| Catalog["catalog-api"]
    Web -->|"HTTP + inner-auth"| Orders["orders-api"]
    Web -->|"HTTP + inner-auth + SSE"| Notif["notifications-api"]
    Orders -->|"gRPC: produtos e preços"| Catalog
    Orders -->|"gRPC: cliente, limites, reserva de crédito"| Identity
    Orders -.->|"publica order.*"| MQ(("RabbitMQ"))
    MQ -.->|"placed, rejected"| Identity
    MQ -.->|"submitted"| Catalog
    MQ -.->|"placed, submitted, approved, rejected"| Notif
    Identity --> PG[("PostgreSQL\n1 schema + 1 papel por serviço")]
    Catalog --> PG
    Orders --> PG
    Notif --> PG
```

Linhas tracejadas são assíncronas (eventos). Referenciado em `../architecture/ARCHITECTURE.md` §1.
