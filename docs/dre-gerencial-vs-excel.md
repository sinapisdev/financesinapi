# DRE do sistema × planilha — o que bate, o que não bate e por quê

Material para a conversa com o auditor. O sistema agora tem **duas DREs**:

| | Critério | Onde |
|---|---|---|
| **DRE gerencial** | caixa, estrutura idêntica à planilha | `/relatorios/dre-gerencial` |
| **DRE contábil** | competência, partidas dobradas | `/relatorios/dre` |

---

## Como a planilha classifica — a regra que foi replicada

A conta de cada lançamento na planilha vem de
`XLOOKUP(descrição, Apoio!E:E, Apoio!F:F)` — busca pela **descrição exata** numa
tabela de 1.764 entradas mantida à mão.

Essa regra não é transportável: a migração normalizou descrições em branco para
o nome da contraparte, e só 6,2% casam por texto. Em lugar dela, a classificação
foi derivada de **processo + conta contábil** — dois campos estruturais, que não
dependem de como alguém digitou o histórico.

As 43 regras estão na tabela `regra_gerencial`, e cada uma registra de onde veio:

| Origem | Regras |
|---|---:|
| Observada na planilha (jan–abr/2026, casada por data e valor) | 28 |
| De-para de conta | 11 |
| Decisão explícita, quando o processo diz mais que a conta | 4 |

**Zero lançamentos do sistema ficam sem classificação**, em qualquer empresa e ano.

---

## O que a planilha chama de "Descontos e Devoluções"

A linha `3.01.01.02` não contém desconto comercial nenhum. Ela recebe:

| O que é | Valor em jan–abr/2026 |
|---|---:|
| Mútuo recebido entre empresas | 2.627.800,00 |
| Empréstimo captado | 476.000,00 |
| Empréstimo pago | −154.780,00 |
| Mútuo pago | −42.980,00 |
| Quitação de financiamento | −2.500.000,00 |

É a linha onde a planilha coloca toda movimentação de dívida. Como entra com
sinal positivo e a fórmula da DRE soma essa linha à receita bruta, **captação de
empréstimo aumenta a receita**. A DRE contábil trata isso como passivo.

---

## O que a planilha acertou e ninguém tinha visto

A parcela de financiamento **já vem separada em principal e juros** no Base44,
como dois lançamentos:

```
12/01/26  GRUA   21.993,10  (processo 0023)  +  3.393,76  (processo 0025)  = 25.386,86
11/02/26  GRUA   22.536,69                   +  2.850,17                   = 25.386,86
11/04/26  GRUA   23.001,96                   +  2.384,90                   = 25.386,86
```

Parcela fixa, principal subindo, juros descendo — tabela Price. Os contratos que
eu ia pedir ao banco não são necessários: **o dado já está no sistema**.

O erro nunca foi de separação, foi de nome: a conta `6.6.1` que recebe o
principal chama-se "Depreciações e Amortizações", quando é amortização de
financiamento. São coisas diferentes — uma reduz dívida, a outra é despesa.

---

## Por que os totais não batem exatamente

Não é classificação. **São conjuntos de dados diferentes:**

| | jan–abr/2026 |
|---|---:|
| Linhas na planilha | 556 |
| Baixas no sistema | 522 |
| Casadas por data e valor | 444 |

Duas operações explicam quase toda a diferença de total:

```
31/03/2026   planilha 0,00            sistema +2.780.873,90   empréstimo de R$ 3 mi (Izmenia)
30/04/2026   planilha −550,57         sistema −2.988.714,51   mútuo de R$ 2,36 mi
```

A planilha é o fluxo das contas acompanhadas no dia a dia; essas operações entre
empresas não passaram por lá. **Nenhuma regra de classificação faz esses números
baterem — só a inclusão dos mesmos lançamentos dos dois lados.**

Há ainda 112 linhas só na planilha e 96 baixas só no sistema. Parte é
agrupamento (a planilha soma principal e juros da grua numa linha; o sistema
mantém os dois lançamentos separados) e parte é diferença real de registro.
É a primeira lista a levar ao auditor.

---

## Cinco linhas que batem ao centavo

Comissões, viagens, material de expediente, honorários e marketing fecham em
**R$ 0,00 de diferença** em jan–abr/2026. São as contas em que os dois lados têm
os mesmos lançamentos e a mesma classificação — a prova de que a mecânica está
correta onde os dados coincidem.

---

## Cobertura

| Empresa | Anos com DRE | Movimentos |
|---|---|---:|
| Construtora Silvereng | 2026 | 840 |
| Ed. Dona Kika | 2024 · 2025 · 2026 | 399 |
| Ed. Dona Izmenia | 2023 · 2024 · 2025 · 2026 | 644 |
| Simonetto (Domus) | 2026 | 87 |

---

## Três perguntas para o auditor

1. **Captação de empréstimo na receita.** A planilha soma R$ 2,03 milhões de
   rotativo à receita bruta. Confirma que isso deve sair da DRE e virar passivo?
2. **Custo de obra no resultado.** A planilha lança material e mão de obra como
   despesa do período; o balancete de 12/2025 os capitaliza em `1.1.3 ESTOQUES`
   (R$ 6,9 milhões). A DRE contábil segue o balancete. Confirma?
3. **Reconhecimento de receita.** Venda de 2025 paga em parcelas até 2028: a
   DRE contábil reconhece tudo em 2025 (competência), a gerencial reconhece
   conforme recebe. Para incorporação, cabe avaliar reconhecimento por
   andamento de obra (POC) — o balancete tem `2.2.2 RECEITAS DIFERIDAS` de
   R$ 964.296,06, o que sugere que já há algum diferimento em uso.
