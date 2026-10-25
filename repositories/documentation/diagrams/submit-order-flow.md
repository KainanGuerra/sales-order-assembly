# Envio de um pedido

O caminho de `POST /api/orders`, na ordem em que acontece em `OrdersService.submit`. A reserva de crédito vem **antes** de gravar o pedido; se gravar falhar, o crédito é devolvido. Os eventos saem depois da gravação.

```mermaid
sequenceDiagram
    participant N as Navegador
    participant W as web (BFF)
    participant O as orders-api
    participant I as identity-api
    participant C as catalog-api
    participant DB as PostgreSQL (orders)
    participant MQ as RabbitMQ

    N->>W: POST /api/orders {orderId, clientId, items, orderDiscountBp}
    W->>W: sessão (Redis), JSON obrigatório, Zod de forma
    W->>O: POST /orders (inner-auth + usuário + papel)
    O->>DB: já existe esse orderId?
    alt já existe
        O-->>W: devolve o pedido salvo (sem recalcular)
    else novo pedido
        O->>I: gRPC GetClient, GetSeller
        O->>C: gRPC GetProducts (em lote)
        O->>O: calculateOrder (função pura): totais, bloqueios, alçada
        alt alguma regra violada
            O-->>W: 422 ORDER_NOT_SUBMITTABLE + cálculo com os motivos
        else pode enviar
            O->>I: gRPC ReserveCredit (trava a linha do cliente)
            alt crédito insuficiente
                O-->>W: 422 CREDIT_EXCEEDED
            else reservado
                O->>DB: INSERT pedido + itens + histórico (uma transação)
                Note over O,I: se gravar falhar, ReleaseCredit
                O->>MQ: publica order.placed
                opt dentro da alçada (status SUBMITTED)
                    O->>MQ: publica order.submitted
                end
                O-->>W: 201 pedido
            end
        end
    end
    W-->>N: resposta
```

Referenciado em `../architecture/ARCHITECTURE.md` §3.
