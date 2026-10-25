# Reserva de crédito

O crédito é do `identity`. O `orders` reserva no envio, de forma atômica, e o evento confirma ou libera. O crédito em uso é **calculado** (já usado + reservas `CONFIRMED` + reservas `PENDING` que não expiraram), então uma reserva sem confirmação some sozinha quando `expires_at` passa, sem tarefa agendada.

```mermaid
sequenceDiagram
    participant O as orders-api
    participant I as identity-api
    participant DB as PostgreSQL (identity)
    participant MQ as RabbitMQ

    O->>I: ReserveCredit(clientId, orderId, valor)
    I->>DB: BEGIN
    I->>DB: SELECT cliente FOR UPDATE (uma reserva por vez no mesmo cliente)
    I->>DB: soma o crédito em uso e confere se o valor cabe
    alt cabe
        I->>DB: INSERT reserva PENDING, expires_at = agora + TTL
        I-->>O: reservado
    else não cabe
        I-->>O: recusado + crédito disponível
    end
    I->>DB: COMMIT
    O->>O: grava o pedido (se falhar: ReleaseCredit, reserva RELEASED)
    O-)MQ: order.placed
    MQ-)I: order.placed
    I->>DB: reserva PENDING vira CONFIRMED (cria CONFIRMED se expirou ou não existe)
    Note over O,I: se o pedido for rejeitado
    O-)MQ: order.rejected
    MQ-)I: order.rejected
    I->>DB: reserva vira RELEASED (evento repetido não a revive)
```

Referenciado em `../architecture/ARCHITECTURE.md` §5.
