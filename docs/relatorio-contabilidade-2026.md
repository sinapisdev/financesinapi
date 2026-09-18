# Contabilidade de 2026 — o que estava errado, o que foi construído e o resultado

Relatório da reestruturação contábil. A contabilidade nova foi gerada **em
paralelo**: nenhum lançamento financeiro foi alterado, o plano de contas antigo
continua intacto e o Base44 segue como arquivo histórico.

---

## O número

| | Resultado de 2026 |
|---|---:|
| Como estava no Base44 | **−5.257.627,25** (prejuízo) |
| Contabilidade gerada | **+523.524,09** (lucro) |
| Diferença | **5.781.151,34** |

A empresa não passou de prejuízo a lucro por mágica nem por mudança de critério
gerencial. Passou porque **R$ 5,78 milhões que estavam no resultado não eram
resultado** — eram ativo e redução de dívida.

### De onde vem cada real da diferença

| Reclassificação | Valor |
|---|---:|
| Custo de obra que virou **estoque** (ativo) | 2.326.701,13 |
| Parcela de financiamento que virou **redução de dívida** (passivo) | 3.332.019,68 |
| Outras reclassificações menores | 122.430,53 |
| **Total** | **5.781.151,34** |

---

## Erro nº 1 — financiamento lançado como depreciação

A conta `6.6.1 DEPRECIAÇÕES E AMORTIZAÇÕES` tinha R$ 3.387.459,68 em 2026.
Nenhum dos 31 lançamentos era depreciação: eram parcelas do SICOOB — grua,
crédito Itapema, abatimento de rotativo.

A prova estava no balancete do próprio contador: a depreciação acumulada de
**toda a história da empresa** é R$ 72.710,62. O Base44 lançou 47 vezes isso
em um único ano.

**Antes:**
```
D  6.6.1  Depreciações e amortizações .... 3.387.459,68   → resultado
```

**Depois:**
```
D  2.1.2.01  Financiamento de bens ....... 3.332.019,68   → reduz a dívida
D  6.2.01    Juros pagos ................        416,45   → resultado
C  banco .................................  3.332.200,17
C  6.1.03    Descontos obtidos ..........        235,96
```

Pagar a prestação da grua não deprecia a grua. Uma reduz passivo, a outra
reconhece desgaste — e só a segunda é despesa.

> **Pendente:** enquanto os contratos não chegarem do banco, a parcela inteira
> entra como principal. Quando a planilha de amortização chegar, a parte de
> juros se separa e só ela volta ao resultado. A regra já está escrita para
> isso — muda o dado, não o código.

---

## Erro nº 2 — custo de obra indo para o resultado

R$ 2.326.701,13 de material, mão de obra e serviços de terceiros estavam sendo
lançados como despesa do período.

Custo de obra não é despesa: é **estoque**. Fica no ativo até a unidade ser
vendida, e só então vira custo, casando com a receita da venda. O balancete do
contador já fazia isso — `1.1.3 ESTOQUES` com R$ 6.905.578,60 em 12/2025.

Agora o processo `0011 CUSTOS OBRA` debita `1.1.3.01 Imóveis em construção`, e
a saída acontece por `4.1 Custo de imóveis vendidos` no momento da venda.

---

## Erro nº 3 — captação de empréstimo virando receita

Este era da planilha, não do Base44. As entradas "ROTATIVO 3M" somavam
R$ 2.029.000,00 em `Descontos e Devoluções`, que é redutor de receita — com
sinal positivo, **aumentavam a receita**.

Dinheiro que entra por empréstimo é dívida. Agora entra em `2.1.2.03 Crédito
rotativo`, e só o juro toca o resultado.

---

## O que foi construído

**Plano de contas definitivo** — 146 contas, desenhado do zero combinando as
três fontes. Cada conta carrega quatro endereços: o código referencial do SPED
(para a ECD), a conta equivalente no balancete do contador, a do Base44 e a
linha da sua DRE gerencial. É isso que impede o plano novo de virar a quarta
numeração solta.

Seis contas não existiam em nenhuma das três fontes: clientes de serviços,
mercadorias para revenda, mostruário, crédito rotativo, mútuo a pagar e custo
de imóveis vendidos.

**119 regras de partida**, cobrindo os 25 processos. A contabilidade deixou de
ser digitada e passou a ser gerada: corrigiu a regra, reprocessa, e o histórico
inteiro se ajusta.

**Uma conta contábil por conta bancária** — 10 subcontas de `1.1.1.02`. Sem
isso não há conciliação banco a banco; era a falha nº 6 do diagnóstico.

**Rateio explícito** para o que o Base44 agrupa: PIS/COFINS pelo regime
cumulativo (0,65% e 3%) e IRPJ/CSLL pela proporção do balancete de 12/2025
(54,18% e 45,82%). Fica numa tabela visível, não escondido no motor.

**A trava.** Débito = crédito é verificado no commit, não a cada linha. As
pernas entram em qualquer ordem, mas a transação inteira é recusada se não
fechar. Perna solta deixou de ser corrigível e passou a ser impossível.

---

## A conferência

| Verificação | Resultado |
|---|---|
| Lançamentos contábeis gerados | 2.048 |
| Partidas | 4.223 |
| Débitos | 30.255.152,14 |
| Créditos | 30.255.152,14 |
| **Diferença** | **0,00** |
| Lançamentos que não puderam ser gerados | **0** |
| Baixas de 2026 cobertas | 1.227 de 1.227 |
| Processos sem regra | 0 |
| Caixa do livro financeiro | **inalterado** |

Durante a construção, a trava recusou três situações reais — uma partida em
conta sintética e dois processos cujas baixas tinham desconto ou multa sem
regra correspondente. Cada recusa virou correção antes de qualquer número ser
publicado. É exatamente para isso que ela existe.

---

## O que ainda não está na contabilidade

**Eventos sem caixa não nascem do livro financeiro.** Depreciação real,
provisão de férias e 13º, apropriação de receita por andamento de obra: nada
disso passa pelo banco, então não vem de lançamento nem de baixa. Por isso a
linha de depreciação da DRE está zerada — não é erro de geração, é evento que
ainda não foi lançado.

O modelo já suporta (`origem_tipo = 'manual'`), e a depreciação mensal é
calculável a partir do imobilizado do balancete. Fica como próximo passo.

**Saldos de abertura.** A contabilidade gerada cobre só o movimento de 2026. Os
saldos patrimoniais vêm do balancete de 12/2025 e precisam ser lançados como
saldo inicial para o balanço fechar.

**A separação principal/juros** das parcelas de financiamento, quando os
contratos chegarem.

---

## DRE de 2026 gerada

Ver `docs/dre-2026-gerada.md`. A estrutura é a da sua planilha — margem de
contribuição, EBITDA ajustado, EBITDA, EBIT, EBT — agora saindo de partidas
dobradas em vez de soma de categorias.

| | |
|---|---:|
| Receita líquida | 2.284.392,24 |
| Lucro bruto | 2.247.916,72 |
| Margem de contribuição | 2.165.596,14 |
| EBITDA | 1.053.610,03 |
| Resultado financeiro | −414.902,03 |
| Tributos sobre o lucro | −115.183,91 |
| **Resultado do exercício** | **523.524,09** |

Vale uma observação de auditor: a receita de 2026 é **toda de serviço** —
administração de obra e BDI (R$ 1,73 mi), aluguel de equipamentos (R$ 416 mil)
e execução de obra (R$ 240 mil). Não há venda de imóvel reconhecida no ano. Isso
é coerente com o balancete, onde as unidades estão em estoque — mas significa
que o resultado de 2026 não reflete o valor que está sendo construído.
