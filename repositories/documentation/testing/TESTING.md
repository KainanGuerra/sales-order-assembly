# Testes

Vitest em todos os pacotes. **502 testes** medidos em 25/10/2026 (cada pacote rodado com o banco disponível); o número muda com o código, então confira com `pnpm test` antes de citá-lo.

## 1. Contagem por pacote

| Pacote | Testes | Arquivos | O que cobrem |
|---|---|---|---|
| `contracts` | 18 | 1 | Esquemas Zod dos eventos (`order-events.spec.ts`) |
| `catalog-api` | 80 | 8 | Busca (27, no PostgreSQL real, inclui a estatística de mais pedidos), regras de visibilidade (14), serviço (8), semente, guarda, consumo e tópicos de mensageria |
| `identity-api` | 91 | 8 | Reserva de crédito e carteira no PostgreSQL real (24), regras puras (21), serviço (20), semente, guarda, mensageria |
| `orders-api` | 182 | 10 | Motor de regras (51), serviço do pedido (55), repositório no PostgreSQL real (22), ciclo de status (13), DTO (10), repetir pedido (9), semente, publicador |
| `notifications-api` | 37 | 6 | Quem é avisado de quê (7), serviço no PostgreSQL real (12), guarda, mensageria |
| `web` | 110 | 14 | Store do pedido (15), formatação (18), fila offline (12), conectividade (9), produtos vistos (9), sessão (9), JSON obrigatório (8), esquema de rejeição (8), mapeamento de erro do upstream (6), temas (4), menu por papel e item ativo (6) e outros |

Cada regra de negócio tem teste com o nome da regra, incluindo os casos de borda: desconto exatamente na alçada, subtotal de R$ 299,99 contra R$ 300,00, quantidade fora do múltiplo da embalagem, crédito disponível igual ao total e os exemplos de arredondamento de [`ASSUMPTIONS.md`](../../../ASSUMPTIONS.md).

## 2. Como rodar

Em cada pasta de serviço (`repositories/<serviço>`), com Node 24:

```bash
corepack pnpm install
corepack pnpm test
```

Os testes que usam o banco só rodam com `TEST_DATABASE_URL`; sem ela são **pulados**, e o resumo mostra "skipped". Para rodá-los, suba só o PostgreSQL (`docker compose up -d postgres`, na raiz) e aponte para o papel do serviço, que enxerga o schema `<serviço>_test`:

```bash
TEST_DATABASE_URL=postgres://<serviço>_role:<senha do .env>@127.0.0.1:5432/sales corepack pnpm test
```

(com `docker-compose.dev.yml` a porta 5432 fica publicada em loopback). Os schemas `<serviço>_test` são criados por `infra/postgres/init-schemas.sh`, que roda na primeira partida de um volume vazio. Os testes aplicam as migrações de verdade nesse schema e limpam as tabelas antes.

`pnpm lint` (oxlint com tipos) e `pnpm typecheck` (no web) também devem passar.

## 3. Banco de verdade, de propósito

Regras que dependem do banco (unicidade, `FOR UPDATE`, `ON CONFLICT`, transações) são testadas contra o PostgreSQL real, não contra um falso: um falso passaria exatamente onde o banco real falharia (D27, D41).

## 4. Revisão por mutação

Depois de escrever um teste, **quebra-se o código de propósito e confere-se que o teste falha**. Um teste que não pode falhar não prova nada. Casos em que isso mudou o código ou o teste:

- **Corrida de crédito:** o primeiro teste de concorrência passava mesmo sem a trava da linha do cliente. Foi trocado por um teste determinístico, que segura a trava numa transação à parte; sem a trava, ele falha (D41).
- **Repetir pedido de outro vendedor:** a regra "só o vendedor do pedido pode repeti-lo" estava escondida pela checagem do cliente; um teste novo (cliente transferido) a expôs.
- **Violação de unicidade:** o repositório tratava qualquer violação como "pedido já existe"; passou a conferir `orders_pkey` (D33).
- **Estatística do catálogo (D53):** seis quebras, todas pegas: sem a marca de pedido contado, sem a transação, soma trocada por substituição, linhas repetidas sem somar, ler-e-gravar no lugar de somar no banco, popularidade antes da similaridade.
- **Fila offline (D55):** nove quebras, todas pegas (parar a rodada sem sinal, filtro por vendedor, recusa que não marca, tratar defeito próprio como falta de sinal, 422 como "tentar depois" e outras).
- **Avisos (D49):** ler o aviso de outra pessoa e uma decisão que fecha todos os tipos de aviso.

## 5. O que os testes **não** cobrem

- Não há testes de componente do front (a lógica testada está nas stores, nos utilitários e no BFF) e não há testes ponta a ponta automatizados: as passadas no navegador foram manuais, num Chrome de computador.
- Nada foi testado num celular real nem com sinal fraco de verdade.
- O `scripts/verify.sh` da orquestração confere o sistema no cluster (pedido, segredo, políticas de rede), mas não roda em CI.
- O CI (`.github/workflows/ci.yml`: contratos, serviços em matriz com PostgreSQL, o web, os gráficos Helm e a publicação das imagens) rodou no GitHub no primeiro envio (25/10/2026) e passou; ele não roda o `verify.sh` nem as passadas no navegador.
