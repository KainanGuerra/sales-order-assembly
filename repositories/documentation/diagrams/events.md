# Eventos e filas

O `orders` publica quatro eventos no exchange `orders.events` (tipo topic). Cada consumidor tem a fila própria, do tipo *quorum*, com limite de entregas, e uma fila de mensagens mortas (`.dlq`) ligada ao exchange `orders.events.dlx`. Uma mensagem que não bate com o esquema vai direto para a `.dlq`; uma que falha é reentregue com espera crescente até esgotar o limite.

```mermaid
flowchart LR
    Orders["orders-api"] -.->|"order.placed, order.submitted, order.approved, order.rejected"| EX(("exchange orders.events\n(topic)"))
    EX -.->|"order.placed, order.rejected"| QI["identity-api-order-events"]
    EX -.->|"order.submitted"| QC["catalog-api-order-events"]
    EX -.->|"order.placed, order.submitted, order.approved, order.rejected"| QN["notifications-api-order-events"]
    QI --> Identity["identity-api\nconfirma ou libera a reserva"]
    QC --> Catalog["catalog-api\nsoma unidades por produto"]
    QN --> Notif["notifications-api\ncria avisos"]
    QI -.->|"falha esgotada ou esquema inválido"| DLX(("exchange orders.events.dlx"))
    QC -.-> DLX
    QN -.-> DLX
    DLX -.-> DQ["identity-api-order-events.dlq\ncatalog-api-order-events.dlq\nnotifications-api-order-events.dlq"]
```

Todo consumidor é idempotente: identity pela reserva do pedido, catalog por `counted_orders` (uma transação com a soma), notifications por (pedido, pessoa, tipo). A publicação não usa outbox. Referenciado em `../architecture/ARCHITECTURE.md` §6.
