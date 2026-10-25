# Pedido sem sinal

Sem resposta do servidor, a tela não calcula nem busca: mostra o último cálculo marcado como desatualizado e procura só entre os produtos já vistos. "Guardar para enviar" põe o pedido na fila do navegador, com o mesmo `orderId` com que ele será enviado. Quando o servidor volta a responder, a fila é enviada, e o servidor confere todas as regras de novo.

```mermaid
sequenceDiagram
    participant V as Vendedor
    participant T as Tela (Pinia + localStorage)
    participant W as web (BFF)
    participant O as orders-api

    Note over T,W: uma chamada que falha ou passa de 8 s desliga o "online"
    V->>T: monta o pedido e toca em "Guardar para enviar"
    T->>T: fila: pedido WAITING, com o orderId
    loop a cada 5 s, enquanto offline
        T->>W: GET /api/health (sonda)
    end
    W-->>T: 200 (o "online" volta)
    T->>W: POST /api/orders (mesmo orderId, um pedido por vez)
    W->>O: POST /orders
    alt aceito (ou o mesmo id já estava salvo)
        O-->>T: pedido
        T->>T: sai da fila, aviso "enviado: Enviado/Aguardando aprovação"
    else regra violada (422) ou outra recusa
        O-->>T: motivos do servidor
        T->>T: fica em "Pedidos pendentes" como REFUSED
        V->>T: "Corrigir" (volta ao editor, id novo) ou "Descartar"
    else sem resposta, erro 5xx ou sessão encerrada
        T->>T: para a rodada e o pedido continua esperando
    end
```

Os pedidos guardados pertencem ao vendedor que os fez. Referenciado em `../architecture/ARCHITECTURE.md` §9.
