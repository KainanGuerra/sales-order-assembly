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
| A12 | Nomes com acento, caixa variada e erros de digitação | Busca insensível a acento e caixa, tolerante a erro de digitação (similaridade de palavra do `pg_trgm`). Consultas só com dígitos (8 a 14) ou no formato `SKU-n` são tratadas como código exato. Decisão minha |
| A12b | Produtos de busca retornados por consulta | No máximo 50 por consulta (padrão 20); a ordem é descrição exata, mais próximo, id. Decisão minha |
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
| A20 | Limite de crédito (fase B): bloqueia ou alerta? | Bloqueia quando o total do pedido excede o crédito disponível (limite − utilizado). Pedidos "Enviado" e "Aguardando aprovação" contam. O envio reserva o crédito de forma atômica no `identity` (`ReserveCredit`), então duas submissões simultâneas não passam juntas. A reserva expira sozinha (sem job). Detalhes e limites em `ARQUITETURA.md` e `DECISIONS.md` D40 a D43. Decisão minha |
| A21 | Fluxo do supervisor | Lista dos pedidos pendentes da equipe, tela de detalhe, aprovar (passa por "Aprovado" e termina em "Enviado") ou rejeitar com motivo. Detalhes em `DECISIONS.md` D44 e D45. Decisão minha |
| A22 | Preço mudou entre montar e enviar | O preço é recalculado e gravado (snapshot) no envio; a resposta devolve os valores finais. Decisão minha |
| A23 | Envio duplicado (clique duplo, reconexão) | O envio usa uma chave de idempotência gerada no cliente; repetir a chave devolve o mesmo pedido |
| A24 | Estoque | Não é modelado (não existe no enunciado nem no seed) |
| A25b | O vendedor tenta abrir a carteira ou o cliente de outro | A carteira alheia responde 403; um cliente alheio responde 404, igual a um cliente inexistente. Decisão minha |
| A27 | Teto global de desconto (`MAX_DISCOUNT_BP`) | Padrão de 10%. A alçada efetiva é o menor entre a do vendedor e o teto. Pedido com desconto acima dela vai para aprovação, não é bloqueado. Decisão minha |
| A28 | Arredondamento do desconto do pedido | O valor do desconto (soma das linhas × percentual) é arredondado uma vez, meio para cima, e subtraído da soma. Decisão minha |
| A29 | Quantidade máxima por linha | 100.000 unidades; acima disso a linha é bloqueada como quantidade inválida. Decisão minha |
| A30 | Linha com problema no total | Linhas bloqueadas não entram no total exibido, e o envio é recusado enquanto houver qualquer bloqueio. O mínimo é avaliado sobre as linhas calculáveis. Decisão minha |
| A31 | Embalagem em produto vendido só por unidade | `PACK` em produto com fator 1 é bloqueado (`PACK_NOT_AVAILABLE`). Em produto que não exige múltiplo, tanto unidade quanto embalagem são aceitas. Decisão minha |
| A32 | Quem monta pedidos | Só o vendedor. O supervisor recebe 403 ao calcular ou enviar e só verá pedidos na fase B (aprovação). Decisão minha |
| A33 | O rascunho do pedido some ao recarregar a página? | Não: fica no `localStorage` até o pedido ser enviado, o vendedor abrir outro cliente ou sair. Se o armazenamento estiver bloqueado, o app funciona só em memória. Decisão minha |
| A34 | Que status a tela mostra enquanto o pedido está bloqueado? | Nenhum: o selo ("Enviado" ou "Aguardando aprovação") só aparece quando o envio é possível; os motivos do bloqueio explicam o resto. Decisão minha |
| A35 | Quantidade ao adicionar um produto | Uma unidade; uma embalagem se o produto só vende em múltiplos. A busca começa com 2 caracteres. Decisão minha |
| A36 | O que o supervisor vê nesta versão | Uma página avisando que a aprovação ainda não está disponível; ele não abre as telas do vendedor. Decisão minha |
| A37 | Duração da sessão | 8 horas, renovada a cada uso. Decisão minha |
| A38 | Quanto tempo uma reserva de crédito vive sem confirmação | 15 minutos (`RESERVATION_TTL_SECONDS`); depois disso ela deixa de contar. Decisão minha |
| A39 | O que conta como crédito comprometido | O crédito já usado do seed, mais os pedidos enviados e as reservas ainda vivas. Pedidos rejeitados não contam. Decisão minha |
| A40 | Pedidos criados antes de existir reserva de crédito | Não contam (só existem em bancos de desenvolvimento, de antes desta funcionalidade). Decisão minha |
| A41 | Que motivos de rejeição existem | Desconto acima do aceito, risco de crédito, produto ou quantidade inadequados, dados do pedido incorretos, e "Outro" com texto (mínimo de 3 caracteres). A lista é minha; deve ser confirmada com a equipe. Decisão minha |
| A42 | Quanto tempo um pedido pode esperar a decisão | Sem limite: o crédito fica reservado até alguém decidir. Decisão minha |
| A43 | O supervisor pode decidir pedidos de outra equipe? | Não: só os dos vendedores que supervisiona; os demais respondem "não encontrado". Decisão minha |
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
