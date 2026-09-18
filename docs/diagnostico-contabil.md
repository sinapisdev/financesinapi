# Diagnóstico contábil — o que está errado e como corrigir

Você me disse que a parte financeira é confiável e a contábil não. Os dados
confirmam exatamente isso. Abaixo, o que encontrei, do mais grave ao menor.

---

## 1. Custos de obra estão indo direto para o resultado — R$ 7.929.427,56

**Este é o problema mais grave, e não é um bug: é a configuração dos processos.**

O processo `0011 CUSTOS OBRA` manda todo custo de obra para o grupo 5 (CUSTOS),
que é conta de **resultado**. Ou seja: cada saco de cimento vira prejuízo no mês
em que é pago.

| Empresa | Jogado em resultado |
|---|---:|
| 3 — SPE Izmenia | R$ 4.259.508,71 |
| 2 — SPE Dona Kika | R$ 2.513.184,42 |
| 1 — Construtora Silvereng | R$ 1.081.990,26 |
| 4 — Domus | R$ 74.744,17 |
| **Total** | **R$ 7.929.427,56** |

**Por que está errado.** Numa incorporadora, o dinheiro gasto na obra não é
despesa — é **estoque**. Você está transformando dinheiro em apartamento, e o
apartamento é um bem seu até ser vendido. O custo só vira resultado quando a
unidade correspondente é vendida, casando com a receita daquela venda.

Do jeito que está, as SPEs aparecem com prejuízo gigante durante toda a
construção e lucro irreal no momento da venda. O resultado de cada mês não
significa nada, e isso tem reflexo em tributação e em qualquer análise de
viabilidade da obra.

**O mais irônico:** a conta certa **já existe** no seu plano —
`1.2.1.01 OBRAS EM ANDAMENTO - CUSTOS`. Ela está lá, zerada, sem uso. Também
existem `1.1.3.01 MATERIAIS DE CONSTRUÇÃO EM ESTOQUE` e
`1.1.3.02 IMÓVEIS CONCLUÍDOS - ESTOQUE`, igualmente sem uso.

**Correção:** custo de obra debita `1.2.1.01` (ativo). Na venda da unidade,
baixa-se a parte proporcional de `1.2.1.01` contra `5.x` (custo), casando com a
receita. É o regime de competência que a atividade exige.

---

## 2. Receita à vista debita o caixa duas vezes

No `LAN1778965562448` (R$ 2.200,00 à vista), o sistema gera:

```
D 1.1.1.02  2.200,00   À VISTA            <- caixa entra
C 4.3.02    2.200,00   À VISTA
D 1.1.1.02  2.200,00   Baixa              <- caixa entra DE NOVO
C 1.1.2.01  2.200,00   Baixa
```

A transação fecha, mas o caixa contábil recebe R$ 4.400,00 por uma venda de
R$ 2.200,00. A causa é o processo ter `conta_debito_avista = 1.1.1.02` **e**
`conta_debito_baixa = 1.1.1.02`: o lançamento à vista já joga no caixa, e a
baixa automática joga de novo.

**Correção:** ou o à vista gera `D Clientes / C Receita` e a baixa gera
`D Caixa / C Clientes`; ou o à vista gera `D Caixa / C Receita` e **não** dispara
baixa. Um caminho ou outro, nunca os dois.

---

## 3. "RECEITAS A BAIXAR" está classificada no Ativo

A conta `1.1.2.04 RECEITAS A BAIXAR` funciona como receita ainda não apropriada,
mas está no grupo 1 (**Ativo**). Uma venda gera `D 1.1.2.01 Clientes /
C 1.1.2.04 Receitas a Baixar` — ou seja, ativo contra ativo, o que **infla o
balanço** sem contrapartida em passivo ou resultado.

**Correção:** receita a apropriar é **passivo** (obrigação de entregar o imóvel),
ou conta redutora de Clientes. Deve sair do grupo 1.

---

## 4. Sete processos lançam em conta sintética

Contas sintéticas são títulos de agrupamento e não recebem lançamento. Estes
processos apontam para elas:

| Processo | Conta sintética |
|---|---|
| 0005 DESPESAS COMERCIAIS | débito `6.2` |
| 0007 DESPESAS FINANCEIRAS | débito `6.3` |
| 0009 DESPESAS ADMINISTRATIVAS | débito `6.1` |
| 0011 CUSTOS OBRA | débito `5.1` |
| 0013 OUTRAS RECEITAS | crédito `4.3` |
| 0019 DESPESAS NÃO RECORRENTES | débito `6.5` |
| 0021 APURAÇÃO IMPOSTOS S/ VENDAS | crédito `2.1.2` |

Hoje isso é contornado escolhendo a analítica na tela, o que funciona enquanto
alguém escolhe certo. No sistema novo, o banco deve recusar lançamento em conta
sintética.

---

## 5. Três processos com natureza trocada

- **`0027 BX - JUROS RECEBIDOS EMPRESTIMOS`** — é tipo `receita`, mas debita
  `6.3.05`, que é **despesa** financeira. Juros recebidos são receita (grupo 4).
- **`0038 CUSTO DE MERCADORIA VENDIDA`** — credita `1.1.1.02` (caixa). CMV não
  sai do caixa, sai do **estoque** (`1.1.3.x`).
- **`0035 VENDA DE VEÍCULO - BAIXA DO BEM`** — debita `4.1.05`, conta de
  **receita**, para dar baixa no bem. O correto é uma conta de ganho ou perda na
  alienação de imobilizado; do jeito atual, a receita de vendas fica distorcida.

---

## 6. Seis bancos, uma conta contábil só

As 6 contas do Sicoob (Obras, Incorporadora, Administrativo, GF 1911, Izmenia,
Kika) compartilham a mesma conta `1.1.1.02`, e `MovimentosFinanceiros` não tem
campo de banco. **Conciliação bancária conta a conta é impossível hoje.**

**Correção:** uma conta analítica por banco (`1.1.1.02.001` em diante) e o
movimento financeiro carregando a conta bancária de origem/destino.

---

## 7. Estornos gerando perna solta — R$ 12.876,08

O problema recorrente que você descreveu. 14 transações ativas desbalanceadas,
todas com histórico `ESTORNO —`. Ele voltava sempre porque a causa está na
rotina de estorno, não nos dados: corrigir o saldo não corrige a rotina.

**Como isso acaba de vez:** no Postgres, o livro contábil ganha uma restrição
`DEFERRABLE INITIALLY DEFERRED` que, no fechamento de cada transação, exige
soma de débitos igual à soma de créditos. Uma rotina de estorno com defeito
passa a **falhar na hora de gravar**, em vez de gravar torto e aparecer meses
depois. Deixa de ser disciplina e vira impossibilidade.

---

## 8. Juros e descontos: o financeiro acerta, a contabilidade erra

184 movimentos têm juros, desconto ou multa. Foram conferidos um a um contra a
parcela de origem em ContasReceber/ContasPagar.

**A camada financeira está correta.** Em **169 de 169** casos conferíveis,
`valor_total` é o valor **líquido** — exatamente o que entrou ou saiu do banco,
já com juros somados e descontos abatidos. Nenhum caso registrou o valor bruto.
O extrato financeiro pode ser confiado, inclusive nesses casos.

**A camada contábil erra em quase metade.** Comparando o efeito líquido no caixa
contábil (conta 1.1.1.02) com o valor que foi ao banco:

| | Casos |
|---|---:|
| Caixa contábil bate com o banco | 89 |
| Caixa contábil **não** bate | 80 |
| Sem movimento contábil nenhum | 15 |

**Desvio acumulado: −R$ 176.440,86** — o caixa contábil registra menos do que
realmente entrou.

O padrão dominante é **juros recebidos que não chegam ao caixa**:

| Foi ao banco | Caixa contábil | Diferença | Juros do caso |
|---:|---:|---:|---:|
| R$ 6.266,02 | R$ 5.960,51 | −R$ 305,51 | R$ 305,51 |
| R$ 6.273,80 | R$ 5.960,51 | −R$ 313,29 | R$ 313,29 |
| R$ 6.252,76 | R$ 0,00 | −R$ 6.252,76 | R$ 292,25 |
| R$ 10.343,33 | R$ 343,33 | −R$ 10.000,00 | R$ 143,33 |

Nas duas primeiras linhas a diferença é **exatamente o valor do juros**: o
sistema debita o caixa pela parcela e esquece o acréscimo. Nas duas últimas, a
falha é maior — numa delas o caixa recebeu R$ 343,33 de um depósito de
R$ 10.343,33; em outra, não recebeu nada.

Com desconto acontece o inverso: o caixa é debitado pelo valor cheio da parcela e
o desconto vira um débito solto em `6.3.03`, sem contrapartida — o que também
alimenta o desbalanceamento do item 7.

**Como fica no sistema novo.** A baixa passa a ser uma operação só, que sempre
fecha:

```
D  Caixa/Banco        valor líquido que foi ao banco
D  Desconto concedido  (se houve desconto)
C  Cliente/Fornecedor  valor original da parcela
C  Juros recebidos     (se houve juros)
C  Multa recebida      (se houve multa)
```

O caixa recebe **sempre** o valor líquido — igual ao extrato. Juros e multa vão
para receita, desconto para despesa. E como débito e crédito nascem juntos, a
trava do banco recusa qualquer baixa que não feche.

---

## A decisão de arquitetura que resolve o conjunto

**Dois livros, um derivado do outro:**

**Livro financeiro — fonte de verdade, migra como está.**
Lançamentos, parcelas, baixas, entradas e saídas. É o que bate com seu extrato
e é o que você confere no dia a dia. Vem do Base44 registro por registro.

**Livro contábil — derivado, regerado do zero.**
Não migro os 11.386 movimentos contábeis como dado. Eles entram apenas como
arquivo histórico, para comparação. As partidas são **geradas** a partir dos
eventos financeiros, por um motor de processos com as regras corrigidas.

Por que isso é melhor do que corrigir movimento a movimento:

- Erro de regra se corrige **uma vez** e reprocessa tudo. Sem caça a lançamento.
- Perna solta deixa de ser possível: débito e crédito nascem na mesma transação,
  e o banco recusa o que não fecha.
- Dá para testar: regerar a contabilidade e comparar com a do Base44 mostra
  exatamente onde as regras divergem — cada diferença é um problema conhecido.
- Você mantém o histórico do Base44 intacto para qualquer conferência futura.

**O que não muda:** nenhum lançamento seu se perde. O livro financeiro vem
inteiro, e ele é o que reflete o dinheiro que entrou e saiu.

---

## Antes de executar

As correções de 1 a 3 mudam resultado apurado e, por consequência, base
tributária das SPEs. Isso precisa passar pelo seu contador — não para decidir se
está errado (está), mas para definir **a partir de quando** corrigir e como
tratar os exercícios já encerrados. Esse documento serve para essa conversa.
