# ASSUMPTIONS

Cada ambiguidade encontrada no enunciado (`SCOPE.md`) ou nos dados (`seed.json`) e a interpretação adotada. Quando eu mesmo decidi, está marcado como **Decisão minha**; quando houver resposta da equipe, ela será registrada como **Resposta recebida**.

## Dados (`seed.json`)

| # | Achado | Interpretação adotada |
|---|---|---|
| A1 | EAN `7891831978575` repetido em P009 (Achocolatado em Pó 400g) e P023 (…Sachê) | A busca por EAN devolve os dois produtos, ordenados por correspondência exata da descrição e depois pelo id. Decisão minha |
| A2 | Cliente C004 sem `tabela_preco_id` | Usa a Tabela Padrão (TP01) e a interface sinaliza o fallback. Decisão minha |
| A3 | P021 está descontinuado (`ativo: false`) e fora da tabela TP03; aparece no histórico PH003 | Produto inativo fica oculto na busca; busca por EAN/SKU exato mostra o produto indisponível com o motivo. Em "repetir pedido" é ignorado com aviso. Decisão minha |
| A4 | P022 está inativo mas aparece no histórico PH001 | Mesmo tratamento de A3 |
| A5 | Produto ativo ausente da tabela do cliente | Aparece desabilitado com o motivo ("sem preço nesta tabela"). Comportamento controlado por variável de ambiente. Decisão minha |
| A6 | Preços do histórico diferem dos atuais (ex.: P001 25,90 × 26,90) | "Repetir pedido" usa o preço atual da tabela do cliente; o histórico é preservado como foi vendido. Decisão minha |
| A7 | Preços são `float` em reais | Convertidos para centavos inteiros na importação (arredondando para o centavo mais próximo). Decisão minha |
| A8 | Quantidades do histórico estão em unidades (ex.: 40 un. de um produto com embalagem de 20) | Quantidade é sempre armazenada e precificada em unidades; o vendedor pode digitar em unidade ou em embalagem, e a interface converte. Decisão minha |
| A9 | `venda_somente_multiplo` é `true` para alguns produtos de embalagem e `false` para outros (ex.: Óleo, CX de 20) | Se `true`, a quantidade em unidades deve ser múltipla de `fator_embalagem`; se `false`, qualquer quantidade ≥ 1 é aceita |
| A10 | `credito_utilizado` é um valor estático | Considera-se que já inclui os pedidos faturados do histórico. Pedidos criados no sistema ("Enviado" e "Aguardando aprovação") passam a somar-se a ele (fase B): o `identity` soma o total no momento da reserva (`ReserveCredit`, síncrona) e libera ao receber `OrderRejected`. Decisão minha |
| A11 | Vendedor V02 tem alçada de 7% e o histórico PH003 usa exatamente 7% | O limite é inclusivo: desconto ≤ alçada fica dentro dela |
| A12 | Nomes com acento e caixa variada | Busca insensível a acento e caixa |
| A13 | Um único supervisor (S01), responsável pelos três vendedores | O supervisor vê apenas pedidos aguardando aprovação dos vendedores que supervisiona |
| A14 | Pedidos do histórico têm status `Faturado` e `Cancelado` | São apenas leitura. Pedidos cancelados aparecem no histórico, mas não contam no crédito. Decisão minha |

## Regras do enunciado

| # | Ambiguidade | Interpretação adotada |
|---|---|---|
| A15 | "Aplicar desconto": por item ou no pedido? | Os dois: percentual por item **e** percentual do pedido. Decisão minha |
| A16 | Como o limite (alçada) se aplica a dois descontos? | O limite é conferido separadamente no percentual de cada item e no percentual do pedido. Se qualquer um excede, o pedido vai para "Aguardando aprovação". Decisão minha |
| A17 | Em que valor se mede o pedido mínimo de R$ 300,00? | No total líquido final (após descontos de item e de pedido). Exatamente R$ 300,00 pode ser enviado. Decisão minha |
| A18 | Regra de arredondamento | Ver seção "Arredondamento" abaixo (método 1) |
| A19 | O que significa "bloquear o envio"? | O botão fica desabilitado com a lista de motivos, e o servidor também recusa o envio (nunca confia no cliente) |
| A20 | Limite de crédito (fase B): bloqueia ou alerta? | Bloqueia quando o total do pedido excede o crédito disponível (limite − utilizado). Pedidos "Enviado" e "Aguardando aprovação" contam. O envio reserva o crédito de forma atômica no `identity` (`ReserveCredit`), então duas submissões simultâneas não passam juntas. Detalhes e limitação conhecida em `ARQUITETURA.md` e `DECISIONS.md` D22. Decisão minha |
| A21 | Fluxo do supervisor | Mínimo: listar pedidos pendentes de seus vendedores, aprovar (→ "Enviado") ou rejeitar. Decisão minha |
| A22 | Preço mudou entre montar e enviar | O preço é recalculado e gravado (snapshot) no envio; a resposta devolve os valores finais. Decisão minha |
| A23 | Envio duplicado (clique duplo, reconexão) | O envio usa uma chave de idempotência gerada no cliente; repetir a chave devolve o mesmo pedido |
| A24 | Estoque | Não é modelado (não existe no enunciado nem no seed) |
| A25 | "Login" | Simulado: tela para escolher vendedor ou supervisor, com sessão por cookie no servidor |
| A26 | Pedido offline (fase C) | Comportamento a decidir quando chegarmos à fase C; o backend continua sendo o dono das regras |

## Arredondamento (método 1 — arredondar cada linha, meio para cima)

Total da linha = preço unitário × quantidade × (1 − desconto%), arredondado uma vez para o centavo. O desconto do pedido incide sobre a soma das linhas já arredondadas e é arredondado uma vez. Esses exemplos viram casos de teste.

**Exemplo 1 — pedido com três linhas**

| Linha | Qtd | Preço unit. | Desconto | Valor exato |
|---|---|---|---|---|
| A | 15 | 7,49 | 5% | 106,7325 |
| B | 12 | 8,99 | 0% | 107,88 |
| C | 7 | 3,33 | 3% | 22,6107 |

Método 1: 106,73 + 107,88 + 22,61 = **237,22**. (Arredondar o preço unitário com desconto daria 237,29; arredondar só o total daria 237,22.)

**Exemplo 2 — linhas que somam o total**

Duas linhas de 10 × 0,99 com 5% de desconto valem 9,405 cada. Método 1: 9,41 + 9,41 = **18,82**. Arredondar só o total mostraria 9,41 + 9,41 com total 18,81.

**Exemplo 3 — o arredondamento muda o veredito do pedido mínimo**

Duas linhas A (15 × 7,49 com 5%) mais uma linha de 86,50 sem desconto. Método 1: 106,73 + 106,73 + 86,50 = **299,96** → bloqueado. (Arredondando o preço unitário daria 300,10 → liberado.)

**Exemplo 4 — com desconto de pedido de 2% sobre o exemplo 1**

237,22 × 0,02 = 4,7444 → 4,74. Total **232,48**.

## Perguntas que eu faria à equipe

1. O desconto de pedido é uma funcionalidade esperada, ou o desconto é só por item?
2. O pedido mínimo se mede antes ou depois dos descontos?
3. Qual é a regra de arredondamento usada pelo ERP?
4. Um cliente sem tabela de preço deve ser bloqueado ou usar a tabela padrão?
