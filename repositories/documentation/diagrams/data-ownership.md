# Dono dos dados

Cada serviço é dono de um schema do PostgreSQL e de um papel (`<serviço>_role`) que só enxerga esse schema; não existe consulta entre schemas nem chave estrangeira entre serviços. O `orders` não guarda cópia de dados dos outros: cada item do pedido leva só o instantâneo (descrição, SKU, preço) do momento do envio. O diagrama mostra as tabelas principais e as relações **dentro** de cada schema.

```mermaid
erDiagram
    SUPERVISORS ||--o{ SELLERS : "supervisiona"
    SELLERS ||--o{ CLIENTS : "carteira"
    CLIENTS ||--o{ CREDIT_RESERVATIONS : "reserva"
    PRODUCTS ||--o{ PRICE_TABLE_ITEMS : "tem preço"
    ORDERS ||--|{ ORDER_ITEMS : "itens"
    ORDERS ||--o{ ORDER_STATUS_HISTORY : "histórico"
    SUPERVISORS {
        text id PK
    }
    SELLERS {
        text id PK
        int discount_limit_bp
    }
    CLIENTS {
        text id PK
        text price_table_id
        int credit_limit_cents
        int credit_used_cents
    }
    CREDIT_RESERVATIONS {
        uuid order_id PK
        int amount_cents
        text status
        timestamptz expires_at
    }
    PRODUCTS {
        text id PK
        text ean
        int pack_factor
        bool multiple_only
        bool active
    }
    PRICE_TABLE_ITEMS {
        text price_table_id PK
        text product_id PK
        int unit_price_cents
    }
    PRODUCT_STATS {
        text product_id PK
        int units_ordered
    }
    COUNTED_ORDERS {
        text order_id PK
    }
    ORDERS {
        uuid id PK
        text seller_id
        text client_id
        text status
        text origin
        int subtotal_cents
        int order_discount_bp
        int total_cents
    }
    ORDER_ITEMS {
        uuid order_id PK
        text product_id PK
        int quantity_units
        int unit_price_cents
        int discount_bp
        int net_cents
    }
    ORDER_STATUS_HISTORY {
        serial id PK
        text status
        text actor
    }
    NOTIFICATIONS {
        uuid id PK
        text recipient_id
        text kind
        uuid order_id
        timestamptz read_at
        timestamptz resolved_at
    }
```

Por schema:

| Schema | Tabelas |
|---|---|
| `identity` | `supervisors`, `sellers`, `clients`, `credit_reservations` |
| `catalog` | `products`, `price_tables` (só `id` e nome, fora do desenho), `price_table_items`, `product_stats`, `counted_orders` |
| `orders` | `orders`, `order_items`, `order_status_history` |
| `notifications` | `notifications` (a combinação `order_id`, `recipient_id`, `kind` é única) |

`product_stats` não tem chave estrangeira para `products` de propósito (DECISIONS D53). Referenciado em `../architecture/ARCHITECTURE.md` §2.
