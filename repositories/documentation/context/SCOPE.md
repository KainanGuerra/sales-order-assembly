Desafio Técnico — Fullstack Pleno
Desafio Técnico — Fullstack Pleno
Oct 16, 2026
· ​@Jesse Neto
Seu papel
Você é o desenvolvedor pleno responsável por esta funcionalidade no time. O enunciado é
o que o produto conseguiu escrever até agora e, como na vida real, não está completo.
Você decide o escopo que cabe no prazo, questiona o que não fizer sentido, usa IA como
ferramenta e responde pelo resultado.
Não avaliamos quantas funcionalidades você entrega; avaliamos as decisões que você
toma e como as justifica.
1. Enunciado
Construa um módulo de montagem de pedidos para vendedores externos que atendem
pequenos varejistas (mercadinhos, minimercados, conveniências). O vendedor visita o
cliente, consulta o catálogo e fecha o pedido ali mesmo, muitas vezes com sinal de internet
ruim.
Stack: recomendamos Vue 3 no frontend, Node.js com TypeScript no backend e
PostgreSQL, que é a stack do time. Você pode usar outra; nesse caso, explique o motivo no
DECISIONS.md. O projeto deve subir com docker compose up . Bibliotecas e arquitetura
são escolha sua.
Dados: fornecemos um arquivo seed.json com vendedores, clientes, produtos e tabelas
de preço. Use-o como está; ele reflete dados reais, com as imperfeições de dados reais.
Esforço esperado: de 4 a 6 horas, com prazo de entrega de 5 dias corridos.
Conceitos do domínio
Carteira: cada vendedor atende um conjunto fixo de clientes.
Tabela de preço: cada cliente está vinculado a uma tabela; o mesmo produto tem
preços diferentes em tabelas diferentes.
Unidade de venda e fator de embalagem: um produto pode ser vendido por unidade
ou por caixa (ex.: caixa com 12 unidades). Alguns produtos só podem ser vendidos em
múltiplos da embalagem.
Alçada de desconto: cada vendedor pode conceder até um percentual de desconto.
Acima disso, o pedido precisa de aprovação do supervisor.
Pedido mínimo: pedidos abaixo de R$ 300,00 não podem ser enviados.
Page 1 of 3Desafio Técnico — Fullstack Pleno
Requisitos
Obrigatórios
1. O vendedor vê apenas os clientes da sua carteira (pode simular o login escolhendo o
vendedor).
2. Buscar produtos por nome ou código de barras (EAN), exibindo o preço da tabela do
cliente selecionado.
3. Montar um pedido: adicionar e remover itens, ajustar quantidade e aplicar desconto,
respeitando unidade de venda e fator de embalagem.
4. Calcular totais do pedido e bloquear o envio quando as regras não forem atendidas.
5. Enviar o pedido. Pedidos dentro da alçada ficam "Enviado"; fora dela, "Aguardando
aprovação".
6. Testes automatizados cobrindo as regras de negócio.
Desejáveis
7. Respeitar o limite de crédito disponível do cliente.
8. Histórico dos últimos pedidos do cliente com a opção "repetir pedido".
Opcionais
9. Montar o pedido sem conexão e sincronizar quando a conexão voltar.
Não esperamos que você faça tudo. Esperamos que você escolha o que fazer e explique
por quê.
Dúvidas
Se algo não estiver claro, você pode nos perguntar por e-mail (respondemos em até 1 dia
útil) ou assumir uma interpretação e documentá-la. As duas opções são igualmente
válidas.
2. Entregáveis
Entregue um repositório Git (GitHub, GitLab ou zip com a pasta .git ) contendo:
Código do frontend e do backend, subindo com docker compose up .
README.md com como rodar, como testar e o que ficou de fora.
DECISIONS.md com pelo menos 5 decisões relevantes. Para cada uma: o contexto, as
alternativas consideradas, o que você escolheu, por quê, e o que faria diferente com
mais tempo.
ASSUMPTIONS.md com cada ambiguidade que você encontrou e a interpretação que
adotou (ou a resposta que recebeu de nós).
Page 2 of 3Desafio Técnico — Fullstack Pleno
AI_LOG.md com 3 a 5 momentos significativos do seu uso de IA. Para cada um: o que
você pediu, o que a IA respondeu, o que você aceitou, alterou ou descartou, e por quê.
Inclua pelo menos um caso em que a IA errou ou sugeriu algo inadequado. Termine com
um mapa de autoria: para cada parte da solução (modelagem, regras de negócio, API,
telas, testes), diga se você escreveu, se a IA gerou e você revisou ou alterou, ou se a IA
gerou e você aceitou como veio. Não existe resposta certa aqui; queremos o retrato
honesto.
Histórico de commits real. Não faça squash; queremos ver a evolução. Termine cada
mensagem de commit com uma linha "IA: nenhuma", "IA: parcial" ou "IA: majoritária".
Opcionalmente, anexe as conversas brutas com a IA (export ou link). Isso não é
obrigatório e não conta pontos por si só.
Depois da entrega, agendamos uma conversa de 60 minutos com você para discutir a
solução, fazer uma pequena alteração e investigar juntos um defeito que vamos introduzir
no seu código antes da conversa.
3. Uso de IA
Use IA o quanto quiser e como quiser: Claude Code, Cursor, Copilot, ChatGPT ou qualquer
outra ferramenta. Nós usamos IA todos os dias e queremos ver como você trabalha com
ela.
A única regra é: você responde por tudo o que está no repositório. Na conversa final
vamos escolher trechos do código e pedir que você explique, e vamos pedir uma alteração
ao vivo, com IA permitida e tela compartilhada.
Usar muita IA não tira pontos. Não entender o que foi entregue tira.
Não esconda o uso de IA. Queremos ver como você pede, revisa, corrige e decide.
O que mais nos interessa é o seu julgamento: onde você confiou na IA, onde desconfiou
e como verificou.
Page 3 of 3