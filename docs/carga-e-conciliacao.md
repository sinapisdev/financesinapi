# Carga e conciliação — Base44 → Postgres

Snapshot de 16/09/2026 · banco `silvereng_dev` · 0 falhas.

## O que entrou

| | |
|---|---:|
| Empresas | 4 |
| Obras | 10 |
| Pessoas | 111 |
| Contas bancárias | 10 |
| Plano de contas | 118 |
| Processos | 25 |
| **Lançamentos** | **1.537** |
| **Parcelas** | **2.957** |
| **Baixas** | **2.081** |
| Transferências | 6 |

As 127 fichas de cliente, fornecedor e vendedor viraram **111 pessoas** — 16
duplicatas eliminadas por CPF/CNPJ.

## Conciliação do caixa

**Diferença de R$ 0,00**, nas quatro empresas, em todo o histórico. Os únicos
itens sem correspondência são 16 movimentos de valor R$ 0,00 no Base44.

| Empresa | Movs | Entradas | Saídas | Resultado |
|---|---:|---:|---:|---:|
| 1 — Construtora Silvereng | 858 | R$ 5.291.551,68 | R$ 5.250.107,33 | R$ 41.444,35 |
| 2 — SPE Dona Kika | 434 | R$ 4.374.072,55 | R$ 4.230.701,35 | R$ 143.371,20 |
| 3 — SPE Izmenia | 702 | R$ 8.671.073,92 | R$ 8.632.215,56 | R$ 38.858,36 |
| 4 — Domus | 87 | R$ 104.159,84 | R$ 107.665,58 | −R$ 3.505,74 |

São esses números que devem bater com os extratos do Sicoob.

## Três decisões tomadas na carga

### 1. A baixa é o movimento no banco, não o valor da parcela
Primeira tentativa usou `valor_original` da parcela. Errado: no
`LAN1781044538081`, a parcela de R$ 5.000,00 foi paga em duas vezes
(R$ 4.474,80 em 06/07 e R$ 525,20 em 13/08). O que bate com o extrato é o
movimento. O principal é reconstruído por `líquido − juros − multa + desconto`.

### 2. Renegociação virou baixa parcial
O Base44, quando a parcela era renegociada, **criava uma parcela nova com
sufixo** (`-013 A`) e deixava a original aberta. Isso inflava o saldo a receber.

A conversão só acontece quando a original ficou **aberta** e o sufixo foi pago —
aí é renegociação de verdade. Quando todas foram pagas (como a entrada de
R$ 50.000 do `LAN1781548416051`, quitada em 4 vezes), são parcelas legítimas.
Essa distinção explicou **17 de 17** lançamentos que não fechavam.

### 3. O caixa reflete o banco, não a intenção
A view do caixa não filtra lançamento cancelado. Havia **109 baixas de
lançamentos cancelados**, somando R$ 1.227.774,59: o dinheiro se moveu e está no
extrato. Cancelar o lançamento depois não desfaz o movimento — para desfazer é
preciso estorno explícito, que entra como outra baixa.

## Pendências sinalizadas

- **80 parcelas implícitas**: lançamentos que no Base44 não tinham parcela
  nenhuma. Ganharam uma parcela com o valor do lançamento (`categoria =
  gerada_na_migracao`) para que a baixa tivesse onde se apoiar.
- **1 lançamento marcado para revisão** (`requer_revisao = true`).
- **Conta bancária**: o Base44 não registra de qual banco saiu o dinheiro, então
  todas as baixas apontam para a conta guarda-chuva *"A IDENTIFICAR — histórico
  Base44"* de cada empresa. As 6 contas reais do Sicoob estão cadastradas e
  prontas para receber a reclassificação.

## Reproduzir

```bash
createdb silvereng_dev
for f in banco/0*.sql; do psql -d silvereng_dev -f $f; done
node carga/carregar.mjs        # cadastros
node carga/02_movimentos.mjs   # lançamentos, parcelas, baixas
node migracao/reconciliar.mjs  # deve terminar em "diferença de R$ 0,00"
```
