# Avisos em tempo real

Um evento de pedido vira um aviso no banco e, em seguida, um sinal `changed` para quem está com a tela aberta. O fluxo SSE **não carrega o conteúdo**: a tela pede a lista de novo, então perder um sinal custa uma leitura a mais, nunca um aviso perdido.

```mermaid
sequenceDiagram
    participant O as orders-api
    participant MQ as RabbitMQ
    participant N as notifications-api
    participant DB as PostgreSQL (notifications)
    participant W as web (BFF)
    participant T as Tela (sino)

    T->>W: GET /api/notifications/stream
    W->>N: GET /notifications/stream (inner-auth + usuário)
    N-->>T: event: changed (ao conectar) e ping a cada 25 s
    O-)MQ: order.placed
    MQ-)N: order.placed
    N->>DB: INSERT aviso ON CONFLICT DO NOTHING
    N-->>T: event: changed
    T->>W: GET /api/notifications
    W->>N: GET /notifications
    N-->>T: lista (novos não lidos viram um toast)
    T->>W: POST /api/notifications/:id/read (ao abrir o aviso)
```

O difusor mora no processo do `notifications` (limite conhecido: uma réplica). Referenciado em `../architecture/ARCHITECTURE.md` §7.
