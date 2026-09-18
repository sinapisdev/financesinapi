# Raio-x contábil — varredura sistemática

Gerado por `migracao/raio-x-contabil.mjs` em 16/09/2026.
Testa regras que **têm** de valer sempre, em vez de procurar erro caso a caso.

```
## 1. Contas com saldo de natureza invertida

  1.2.2.01    MÁQUINAS E EQUIPAMENTOS                  -R$ 6.709.931,98  (esperado devedor, 168 movs)
  2.1.1.03    FORNECEDORES A PAGAR                      R$ 5.886.273,15  (esperado credor, 1308 movs)
  1.1.1.02    CAIXA/BANCO CONTA CORRENTE               -R$ 4.573.354,68  (esperado devedor, 3410 movs)
  1.1.2.04    RECEITAS A BAIXAR                        -R$ 3.573.107,99  (esperado devedor, 1039 movs)
  2.1.1.04    FORNECEDORES OUTRAS DESPESAS                R$ 412.010,58  (esperado credor, 47 movs)
  1.1.2.02    CLIENTES - RECEBER/OBRAS OU OUTRAS R       -R$ 227.150,12  (esperado devedor, 74 movs)
  2.1.1.01    FORNECEDORES - MATERIAIS                    R$ 167.548,88  (esperado credor, 32 movs)
  4.2.02      MULTAS RECEBIDAS                             R$ 50.683,50  (esperado credor, 6 movs)
  1.2.4.01    PARTICIPAÇÕES SOCIETÁRIAS                   -R$ 40.000,00  (esperado devedor, 3 movs)
  2.2.1.03    MUTUO A PAGAR                                R$ 25.000,00  (esperado credor, 1 movs)
  4.2.04      RECEITA FINANCEIRA DE MÚTUO                  R$ 10.000,00  (esperado credor, 3 movs)
  2.1.2       IMPOSTOS E TRIBUTOS A PAGAR                   R$ 7.400,00  (esperado credor, 1 movs)
  6.2.02      DESPESAS COM PESSOAL                             -R$ 3,12  (esperado devedor, 2 movs)

## 2. Movimentos lançados em conta sintética

  4.3         OUTRAS RECEITAS                        1 movimentos
  2.1.2       IMPOSTOS E TRIBUTOS A PAGAR            1 movimentos

## 3. Contas analíticas nunca usadas: 29 de 83

  1.1.1.01    CAIXA/GERAL
  1.1.1.03    CAIXA/APLICAÇÕES FINANCEIRAS
  1.1.3.01    MATERIAIS DE CONSTRUÇÃO EM ESTOQUE
  1.1.3.02    IMÓVEIS CONCLUÍDOS - ESTOQUE
  1.2.1.01    OBRAS EM ANDAMENTO - CUSTOS
  1.2.1.02    TERRENOS
  1.2.2.02    VEÍCULOS
  2.1.1.02    FORNECEDORES - SERVIÇOS
  2.1.4.01    SALÁRIOS A PAGAR
  2.2.1.02    EMPRÉSTIMOS SFH/CEF
  3.1.01      CAPITAL INTEGRALIZADO
  3.2.01      LUCROS/PREJUÍZOS ACUMULADOS
  4.1.02      VENDA DE PRODUTOS
  6.2.03      ALUGUEL/CONDOMÍNIO
  ... e mais 15

## 4. saldo_atual do plano x razão recalculado

  1.1.1.02    CAIXA/BANCO CONTA CORRENTE       gravado  R$ 1.785.820,20  razão -R$ 4.573.354,68
  1.1.2.01    CLIENTES - RECEBER/VENDA DE IM   gravado  R$ 6.176.935,73  razão  R$ 4.088.297,10
  1.1.2.02    CLIENTES - RECEBER/OBRAS OU OU   gravado    R$ 441.515,10  razão   -R$ 227.150,12
  1.1.2.04    RECEITAS A BAIXAR                gravado -R$ 3.358.413,61  razão -R$ 3.573.107,99
  1.1.2.05    MUTUO A RECEBER                  gravado -R$ 1.999.508,41  razão  R$ 3.920.560,08
  1.2.2.01    MÁQUINAS E EQUIPAMENTOS          gravado -R$ 6.807.214,13  razão -R$ 6.709.931,98
  1.2.4.01    PARTICIPAÇÕES SOCIETÁRIAS        gravado     R$ 40.000,00  razão    -R$ 40.000,00
  2.1.1.01    FORNECEDORES - MATERIAIS         gravado    R$ 762.158,41  razão    R$ 167.548,88
  2.1.1.03    FORNECEDORES A PAGAR             gravado  R$ 5.962.436,89  razão  R$ 5.886.273,15
  2.1.1.04    FORNECEDORES OUTRAS DESPESAS     gravado   -R$ 522.281,18  razão    R$ 412.010,58
  2.1.2.03    IRPJ/CSLL A PAGAR                gravado     -R$ 7.063,91  razão   -R$ 115.183,91
  2.2.1.01    FINANCIAMENTOS BANCÁRIOS - LP    gravado -R$ 8.564.237,76  razão -R$ 8.109.563,47
  -> 36 contas divergem entre saldo gravado e razão

## 5. Valor do lançamento x movimentos gerados

  lançamentos cujos débitos somam exatamente 2x o valor: 1016
  lançamentos com débitos acima do valor (outras proporções): 158
    1778763827819 · despesa · R$ 6.723,77 · IOF
    1778766703428 · despesa · R$ 30,00 · 
    1778778231382 · despesa · R$ 100,00 · Instalação PC novo
    1778784192315 · receita · R$ 100.000,00 · 
    1778876526805 · despesa · R$ 1.000,00 · Multa - Estruture-se

## 6. Processos com natureza incoerente

  [0001] VENDAS DE IMÓVEIS
      - à vista e baixa debitam a mesma conta (1.1.1.02) — dupla contagem
  [0005] DESPESAS COMERCIAIS
      - débito em conta sintética (6.2)
  [0007] DESPESAS FINANCEIRAS
      - débito em conta sintética (6.3)
  [0009] DESPESAS ADMINISTRATIVAS
      - débito em conta sintética (6.1)
  [0011] CUSTOS OBRA
      - débito em conta sintética (5.1)
  [0013] OUTRAS RECEITAS
      - à vista e baixa debitam a mesma conta (1.1.1.02) — dupla contagem
      - crédito em conta sintética (4.3)
  [0019] DESPESAS NÃO RECORRENTES
      - débito em conta sintética (6.5)
  [0021] APURAÇÃO IMPOSTOS S/ VENDAS
      - débito em conta sintética (6.4)
      - crédito em conta sintética (2.1.2)
  [0027] BX - JUROS RECEBIDOS EMPRESTIMOS
      - tipo receita mas debita despesa (6.3.05)
  [0031] RECEITAS FINANCEIRAS DE MÚTUO
      - à vista e baixa debitam a mesma conta (1.1.1.02) — dupla contagem
  [0033] DAÇÃO EM PAGAMENTO - RECEBIMENTO DE VEÍC
      - à vista e baixa debitam a mesma conta (1.2.2.02) — dupla contagem
  [0037] VENDA GERAL
      - à vista e baixa debitam a mesma conta (1.1.1.02) — dupla contagem

================================================================
# 31 incoerências catalogadas
```
