# Auditoria contábil — Silvereng, exercício de 2026

Base da análise: planilha `Silvereng_DRE_com_Dashboard_V29_corrigido.xlsx`
(42 abas), o banco do sistema novo (1.537 lançamentos, 2.081 baixas) e o
snapshot do Base44. Foco em 2026; 2024 e 2025 entram como comparação.

---

## 1. O achado principal

A planilha contém **24 balancetes de verificação mensais**, de 01/2024 a
12/2025, emitidos pela contabilidade oficial da empresa
(`536 - SILVERENG CONSTRUTORA E INCORPORADORA`, consolidação por empresa,
grau 5, com código referencial SPED em cada conta).

**Existe, portanto, uma contabilidade correta — e nem o Base44 nem a planilha
gerencial estavam conversando com ela.**

O balancete de 12/2025 fecha assim:

| Conta | Descrição | Saldo |
|---|---|---:|
| 1 | ATIVO | 15.696.435,56 |
| 1.1.3 | **ESTOQUES** | **6.905.578,60** |
| 1.2.3 | IMOBILIZADO | 1.444.792,33 |
| 1.2.4 | DEPRECIAÇÃO ACUMULADA | 72.710,62 |
| 2 | PASSIVO | −14.964.571,53 |
| 2.1.2 | **EMPRÉSTIMOS E FINANCIAMENTOS** | **−9.417.562,54** |
| 2.4 | PATRIMÔNIO LÍQUIDO | −558.281,32 |

Duas dessas linhas explicam praticamente todos os erros encontrados.

---

## 2. Três planos de contas rodando ao mesmo tempo

| Origem | Numeração | Onde vive |
|---|---|---|
| Contabilidade oficial | `3` receitas, `4` despesas | balancetes, ECD/SPED |
| Base44 / sistema novo | `4` receitas, `5` custos, `6` despesas | banco de produção |
| DRE gerencial (Excel) | `3.01…3.12`, tudo em resultado | planilha |

Nenhum é errado em si. O problema é existirem três, sem tabela que os una —
e só o primeiro tem valor legal.

---

## 3. Erro nº 1 — financiamento lançado como depreciação

**R$ 3.387.459,68 em 2026**, em 24 lançamentos na conta `6.6.1 DEPRECIAÇÕES E
AMORTIZAÇÕES`. Nenhum deles é depreciação.

Os 31 lançamentos da conta (todo o histórico) são pagamentos ao SICOOB
CREDCANOINHAS — "PARCELA ITAPEMA", "GRUA", "ABATIMENTO NO ROTATIVO",
"CREDITO ITAPEMA" — mais três devoluções a uma pessoa física.

A prova está no próprio balancete:

- A grua existe como bem: `1.2.3.04` Grua Pingon BR50, 50 m de lança
- A depreciação dela é `1.2.4.04.0006` = **R$ 46.173,39 acumulados**
- A depreciação acumulada da empresa inteira é **R$ 72.710,62**

O Base44 lançou, só em 2026, **47 vezes toda a depreciação acumulada
histórica da empresa**.

O que aconteceu foi confundir duas operações distintas:

| | Depreciação | Amortização de financiamento |
|---|---|---|
| Tem caixa? | não | sim |
| Efeito | despesa no resultado | reduz dívida no passivo |
| Lançamento | D despesa / C depreciação acumulada | D empréstimos / C banco |

Pagar a prestação da grua não deprecia a grua. São eventos independentes, e o
Base44 transformou o primeiro no segundo.

**Efeito:** `6.6.1` responde por **64% de todas as despesas de 2026**
(R$ 3,39 mi de R$ 5,29 mi). É a maior parte do prejuízo apurado.

**Correção:** cada parcela se divide em principal (D `2.1.2.01 EMPRÉSTIMOS`)
e juros (D `3.09.02.01 / 6.3.01 JUROS PAGOS`). Só os juros vão ao resultado.

---

## 4. Erro nº 2 — captação de empréstimo virando receita (na planilha)

Este é da planilha, não do Base44.

As entradas de rotativo — "ROTATIVO 3M - 2.3", "2.4", "2.5"… — somam
**R$ 2.029.000,00** classificados em `3.01.01.02 Descontos e Devoluções`,
que na DRE é redutor da receita bruta. Com sinal positivo, **aumentam a
receita**.

Dinheiro que entra por empréstimo não é receita: é passivo. Entra em
`2.1.2.01`, não na DRE.

---

## 5. Erro nº 3 — a mesma parcela, três classificações

| Lançamento | Base44 | Planilha Excel | Correto |
|---|---|---|---|
| Parcela da grua | 6.6.1 Depreciações | 5.1.03 Serviços de Terceiros - Obra | 2.1.2.01 + juros |
| Financiamento Itapema | 6.6.1 Depreciações | 6.5.1 Desp. não Recorrentes | 2.1.2.01 + juros |
| Juros do rotativo | — | 6.3.01 Juros Pagos ✔ | 6.3.01 Juros Pagos |
| Captação de rotativo | — | 4.1.03 Descontos/Devoluções | 2.1.2.01 |

A planilha acerta os juros; o Base44 não separa juros de principal em lugar
nenhum. Nenhum dos dois trata a captação corretamente.

---

## 6. Como a planilha classifica — força e fragilidade

A conta de cada lançamento vem de:

```
S4 = XLOOKUP(C4, Apoio!E:E, Apoio!F:F)      ← C4 é a DESCRIÇÃO do lançamento
```

Busca **pela descrição exata**, contra uma tabela de 1.904 linhas mantida à mão.

**A força:** são 1.904 decisões de classificação humanas. É conhecimento
contábil real, e não pode ser jogado fora — vai virar as regras de partida.

**A fragilidade:** descrição nova não encontra nada; descrição repetida para
coisas diferentes classifica errado; e a tabela cresce para sempre. Em 2026 a
cobertura está em 100% (556 de 556), o que mostra disciplina — mas ao custo de
manutenção manual permanente.

---

## 7. O ano órfão

| Período | Contabilidade oficial | Planilha gerencial | Base44 |
|---|:---:|:---:|:---:|
| 2024 | ✔ balancetes | ✔ | parcial |
| 2025 | ✔ balancetes | ✔ | parcial |
| **2026** | **ausente** | até 30/04 | ✔ completo |

**2026 é exatamente o ano sem contabilidade fechada.** É por isso que ele
precisa nascer certo aqui — não há balancete oficial para copiar, e o que
existe hoje (Base44) tem 64% das despesas classificadas erradas.

A planilha cobre 01/01 a 30/04/2026 (556 lançamentos, todos com `Pago = Sim`,
portanto regime de caixa). O sistema cobre 01/01 a 15/09/2026.

---

## 8. Proposta de estrutura definitiva

1. **Adotar o plano de contas do contador** como plano único do sistema.
   É o que vai para a ECD, tem código referencial da Receita em cada conta e
   já contempla estoque por unidade, financiamento por contrato e depreciação
   por bem. Criar plano novo seria inventar um quarto.

2. **Abrir 2026 com o saldo de 12/2025.** O balancete de dezembro vira o saldo
   inicial; nada antes disso é recalculado. Exercícios fechados ficam fechados.

3. **Manter o de-para em três colunas** — conta oficial, conta do Base44 e
   linha da DRE gerencial. Assim a DRE que você já usa continua saindo, agora
   a partir de contabilidade de verdade.

4. **Transportar as 1.904 classificações da planilha** para regras de partida
   ancoradas em processo + contraparte + conta, não em descrição.

5. **Tratar financiamento como evento de duas pernas:** principal amortiza
   passivo, juros vão ao resultado. Vale para grua, Itapema, rotativo e mútuo.

O estoque por unidade do balancete (`1.1.3.14.0001 AP 101`,
`DUPLEX 401`, `GARAGEM 05`…) corresponde exatamente ao modelo de item com
controle por peça única já construído no sistema — o de-para é direto.

---

## 9. Decisões que dependem de você

1. **Confirmar o plano do contador como plano único.** Ideal validar com ele
   que o de 12/2025 é a versão vigente.
2. **Saldo inicial de 2026.** Preciso do balancete de 12/2025 já fechado — é o
   que tenho; confirmar que não houve ajuste posterior.
3. **Os R$ 2.500.000,00 de 02/04/2026** (SICOOB CREDCANOINHAS): quitação de
   qual contrato? Precisa saber quanto foi principal e quanto foi juros.
4. **"ROTATIVO 3M"**: é uma linha de crédito rotativo de 3 meses? Confirmar
   para modelar captação e liquidação.
5. **Parcelas da grua e do Itapema:** ter os contratos (ou a planilha de
   amortização) permite separar principal de juros com exatidão em vez de
   estimar.
