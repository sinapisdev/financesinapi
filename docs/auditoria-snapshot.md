# Auditoria do snapshot Base44 — 16/09/2026

App **"GRUPO SE"** (`69ceaaf2ff370a0c3a2d44e7`) · 25 entidades · 43 páginas.

## 1. O snapshot está completo

**25.015 registros** extraídos. A completude não é presunção: cada entidade foi
varrida em ordem crescente e decrescente de `id`, e os dois conjuntos de ids
bateram exatamente em todas elas.

| Entidade | Registros | | Entidade | Registros |
|---|---:|---|---|---:|
| MovimentosContabeis | 11.386 | | Fornecedores | 69 |
| Auditoria | 5.542 | | Clientes | 57 |
| MovimentosFinanceiros | 3.276 | | DeParaDRE | 54 |
| ContasReceber | 1.467 | | ConfiguracoesProcessos | 25 |
| LancamentosFinanceiros | 1.544 | | Obras | 10 |
| ContasPagar | 1.422 | | Usuarios / User | 8 / 7 |
| PlanoContas | 118 | | ParametrosSistema | 7 |
| InstituicoesBancarias | 6 | | Empresas | 4 |
| Imoveis / FormasPagamento | 5 / 5 | | Permutas / ImoveisPermuta / Vendedores | 1 / 1 / 1 |

Vazias: `Historicos`, `ConfiguracoesBaixa`, `PlanejamentoFinanceiro`.

### Duas armadilhas que quase custaram dados

1. **Adivinhar nomes de tabela perde tabela.** Um probe por lista de candidatos
   encontrou 15 das 24 entidades. Ficariam de fora `InstituicoesBancarias`,
   `Auditoria` (5.542 registros), `DeParaDRE`, `Permutas` e outras. A lista real
   vem de `GET /api/apps/{id}` → `entities`.
2. **Paginar por `created_date` perde registro.** Há 167 empates de timestamp a
   cada 500 registros; com empate, o `skip` devolve páginas instáveis e registros
   somem sem erro nenhum. Duas extrações seguidas deram 3.271 e 3.264 movimentos
   financeiros. Ordenando por `id` (único), o número correto é **3.276**.

## 2. As partidas não fecham em 14 transações

Em partida dobrada, dentro de cada transação a soma dos débitos tem de ser igual
à dos créditos. Considerando apenas movimentos **ativos**:

| Empresa | Movimentos | Transações | Desbalanceadas | Diferença |
|---|---:|---:|---:|---:|
| 1 — Construtora Silvereng | 4.135 | 1.764 | 3 | R$ 3.017,00 |
| 2 — SPE Dona Kika | 1.794 | 568 | 11 | R$ 9.859,08 |
| 3 — SPE Izmenia | 3.654 | 874 | **0** | **R$ 0,00** |
| 4 — Domus | 576 | 208 | **0** | **R$ 0,00** |
| **Total** | **10.159** | **3.414** | **14** | **R$ 12.876,08** |

**As 14 são estornos.** Todos os históricos começam com `ESTORNO —`. Nenhum
lançamento comum está desbalanceado — Izmenia e Domus fecham no centavo.

O padrão é perna solta: o estorno gravou o débito sem o crédito correspondente,
ou gravou o débito duas vezes. Exemplo na Silvereng
(`0010052905202610362761501060`): dois débitos de R$ 3.000,00 em 1.1.1.02 contra
um único crédito de R$ 3.000,00 em 6.1.01.

Contas atingidas pelas transações desbalanceadas:

| Conta | Nome | Débito | Crédito |
|---|---|---:|---:|
| 1.1.1.02 | CAIXA/BANCO CONTA CORRENTE | R$ 6.017,00 | R$ 4.053,72 |
| 1.1.2.01 | CLIENTES - RECEBER/VENDA IMÓVEIS | R$ 50.000,00 | R$ 0,00 |
| 1.1.2.04 | RECEITAS A BAIXAR | R$ 0,00 | R$ 45.000,00 |
| 4.1.01 | VENDA DE IMÓVEIS | R$ 8.000,00 | R$ 0,00 |
| 6.1.01 | DESPESAS COM PESSOAL ADM | R$ 0,00 | R$ 3.000,00 |
| 4.2.01 / 4.2.02 | JUROS / MULTAS RECEBIDAS | R$ 912,80 | R$ 0,00 |

O caixa é atingido em **R$ 1.963,28 líquidos** (6.017,00 − 4.053,72).

## 3. Pontos que precisam da sua interpretação

### 3.1 Saldo do caixa fecha negativo em R$ 4,57 milhões
Somando os 3.410 movimentos ativos da conta 1.1.1.02 (débitos − créditos), o
saldo dá **−R$ 4.573.354,68**. A convenção de sinal está certa (entrada de caixa
debita 1.1.1.02, conferido em três lançamentos de receita), então um caixa
negativo nessa ordem de grandeza não se explica sozinho. Ver 3.2.

### 3.2 Receita à vista parece debitar o caixa duas vezes
No lançamento `LAN1778965562448` (R$ 2.200,00 à vista), os movimentos ativos são:

```
D 1.1.1.02  2.200,00   À VISTA
C 4.3.02    2.200,00   À VISTA
D 1.1.1.02  2.200,00   Baixa — ...-001      <- caixa debitado de novo
C 1.1.2.01  2.200,00   Baixa — ...-001
D 1.1.2.04  2.200,00   Transitória — Baixa
C 4.1.01    2.200,00   Transitória — Baixa
```

A transação fecha (D = C = 6.600,00), mas o caixa recebe 4.400,00 por um
lançamento de 2.200,00. Pode ser dupla contagem do fluxo "à vista + baixa
automática", ou uma convenção interna que eu ainda não interpretei corretamente.
**Isso precisa da sua leitura antes da modelagem** — muda como o caixa é
calculado no sistema novo.

### 3.3 Movimentos apontando para lançamento inexistente
74 movimentos contábeis (28 ativos, 46 cancelados) referenciam `id_lancamento`
que não existe mais em `LancamentosFinanceiros`, somando R$ 611.279,60. São
lançamentos apagados cujos movimentos ficaram para trás.

### 3.4 Nenhum movimento financeiro aponta para conta bancária
As 6 contas do Sicoob estão cadastradas em `InstituicoesBancarias`
(Obras, Incorporadora, Administrativo, GF 1911, Izmenia, Kika), mas
`MovimentosFinanceiros` **não tem campo de banco**. A segregação de caixa é por
obra e empresa. Conciliação bancária de verdade, contra extrato, hoje não é
possível — é uma das coisas que o sistema novo pode resolver.

## 4. O que isso significa para a migração

Nada disso impede migrar, e nada disso se perde: os 25.015 registros estão
salvos e conferidos. São problemas que **já existem hoje no Base44** e que a
migração torna visíveis. As opções para os R$ 12.876,08 são três — corrigir no
Base44 antes de migrar, migrar como está e corrigir depois no sistema novo, ou
migrar com um ajuste contábil documentado. É decisão sua e, provavelmente, do
contador.

## Como reproduzir

```bash
node migracao/extrair.mjs             # snapshot + manifesto com sha256
node migracao/verificar-completude.mjs # varredura dupla
node migracao/validar.mjs             # duplicatas, órfãs, hash
node migracao/conferir-contabil.mjs   # partidas dobradas
```
