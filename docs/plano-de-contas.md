# Plano de contas definitivo — Grupo Silvereng

146 contas · 107 analíticas. Cada linha carrega o de-para para as três fontes.

`SPED` = referencial da Receita (ECD) · `CTD` = balancete do contador · `B44` = plano atual do sistema · `DRE` = linha da sua DRE gerencial

| Conta | Descrição | Lç | SPED | CTD | B44 | DRE |
|---|---|:-:|---|---|---|---|
| `1` | **ATIVO** |  | 1 | 1 |  |  |
| `1.1` | &nbsp;&nbsp;&nbsp;**ATIVO CIRCULANTE** |  | 1.01 | 1.1 |  |  |
| `1.1.1` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**DISPONIBILIDADES** |  | 1.01.01 | 1.1.1 |  |  |
| `1.1.1.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CAIXA | ✔ | 1.01.01 | 1.1.1.01 | 1.1.1.01 |  |
| `1.1.1.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**BANCOS CONTA MOVIMENTO** |  | 1.01.01 | 1.1.1.02 | 1.1.1.02 |  |
| `1.1.1.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;APLICAÇÕES FINANCEIRAS | ✔ | 1.01.02 | 1.1.1.03 |  |  |
| `1.1.2` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**CLIENTES** |  | 1.01.02 | 1.1.2.01 |  |  |
| `1.1.2.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CLIENTES - VENDA DE IMÓVEIS | ✔ | 1.01.02 | 1.1.2.01 | 1.1.2.01 |  |
| `1.1.2.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CLIENTES - PRESTAÇÃO DE SERVIÇOS | ✔ | 1.01.02 |  |  |  |
| `1.1.2.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CLIENTES - VENDA DE PRODUTOS | ✔ | 1.01.02 |  |  |  |
| `1.1.2.09` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) PROVISÃO PARA PERDAS | ✔ | 1.01.02 |  |  |  |
| `1.1.3` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**ESTOQUES** |  | 1.01.03 | 1.1.3 |  |  |
| `1.1.3.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**IMÓVEIS EM CONSTRUÇÃO** |  | 1.01.03 | 1.1.3.01 | 1.2.1.01 |  |
| `1.1.3.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**IMÓVEIS CONCLUÍDOS** |  | 1.01.03 | 1.1.3.14 | 1.1.3.02 |  |
| `1.1.3.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TERRENOS | ✔ | 1.01.03 |  | 1.2.1.02 |  |
| `1.1.3.04` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MATERIAIS DE CONSTRUÇÃO | ✔ | 1.01.03 |  | 1.1.3.01 |  |
| `1.1.3.05` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MERCADORIAS PARA REVENDA | ✔ | 1.01.03 |  |  |  |
| `1.1.3.06` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MOSTRUÁRIO | ✔ | 1.01.03 |  |  |  |
| `1.1.4` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TRIBUTOS A RECUPERAR | ✔ | 1.01.04.02 | 1.1.2.04 |  |  |
| `1.1.5` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**ADIANTAMENTOS** |  | 1.01.05 | 1.1.2.03 |  |  |
| `1.1.5.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ADIANTAMENTO A FORNECEDORES | ✔ | 1.01.05.02 | 1.1.2.03.0011 |  |  |
| `1.1.5.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ADIANTAMENTO A FUNCIONÁRIOS | ✔ | 1.01.05.99 | 1.1.2.03.0007 |  |  |
| `1.1.5.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ADIANTAMENTO A SÓCIOS | ✔ | 1.01.05.99 | 1.1.2.03.0010 |  |  |
| `1.1.6` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**PARTES RELACIONADAS A RECEBER** |  | 1.01.05.99 |  |  |  |
| `1.1.6.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MÚTUO A RECEBER | ✔ | 1.01.05.99 |  | 1.1.2.05 |  |
| `1.1.7` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;DESPESAS ANTECIPADAS | ✔ | 1.01.06 |  |  |  |
| `1.2` | &nbsp;&nbsp;&nbsp;**ATIVO NÃO CIRCULANTE** |  | 1.02 | 1.2 |  |  |
| `1.2.1` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;REALIZÁVEL A LONGO PRAZO | ✔ | 1.02.01 | 1.2.2 |  |  |
| `1.2.2` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**INVESTIMENTOS** |  | 1.02.02 | 1.2.3.01 |  |  |
| `1.2.2.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;PARTICIPAÇÕES EM SCP | ✔ | 1.02.02 | 1.2.3.01.0001 |  |  |
| `1.2.2.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;COTAS DE CAPITAL | ✔ | 1.02.02 | 1.2.3.01.0003 |  |  |
| `1.2.3` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**IMOBILIZADO** |  | 1.02.01 | 1.2.3 |  |  |
| `1.2.3.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MÁQUINAS E EQUIPAMENTOS | ✔ | 1.02.01 | 1.2.3.04 | 1.2.2.01 |  |
| `1.2.3.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;VEÍCULOS | ✔ | 1.02.01 | 1.2.3.05 |  |  |
| `1.2.3.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;EQUIPAMENTOS DE INFORMÁTICA | ✔ | 1.02.01 | 1.2.3.03 |  |  |
| `1.2.3.04` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MÓVEIS E UTENSÍLIOS | ✔ | 1.02.01 | 1.2.3.02 |  |  |
| `1.2.3.05` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;IMÓVEIS DE USO | ✔ | 1.02.01 |  |  |  |
| `1.2.4` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**(-) DEPRECIAÇÃO ACUMULADA** |  | 1.02.01 | 1.2.4 |  |  |
| `1.2.4.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) DEPRECIAÇÃO DE MÁQUINAS E EQUIPAMENTOS | ✔ | 1.02.01 | 1.2.4.04 |  |  |
| `1.2.4.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) DEPRECIAÇÃO DE VEÍCULOS | ✔ | 1.02.01 |  |  |  |
| `1.2.4.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) DEPRECIAÇÃO DE INFORMÁTICA | ✔ | 1.02.01 | 1.2.4.03 |  |  |
| `1.2.4.04` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) DEPRECIAÇÃO DE MÓVEIS E UTENSÍLIOS | ✔ | 1.02.01 |  |  |  |
| `1.2.5` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;INTANGÍVEL | ✔ | 1.02.03 |  |  |  |
| `2` | **PASSIVO** |  | 2 | 2 |  |  |
| `2.1` | &nbsp;&nbsp;&nbsp;**PASSIVO CIRCULANTE** |  | 2.01 | 2.1 |  |  |
| `2.1.1` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**FORNECEDORES** |  | 2.01.01 | 2.1.1 |  |  |
| `2.1.1.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;FORNECEDORES - MATERIAIS | ✔ | 2.01.01 | 2.1.1.01 | 2.1.1.01 |  |
| `2.1.1.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;FORNECEDORES - SERVIÇOS | ✔ | 2.01.01 | 2.1.1.02 |  |  |
| `2.1.2` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**EMPRÉSTIMOS E FINANCIAMENTOS - CURTO PRAZO** |  | 2.01.04 | 2.1.2 |  |  |
| `2.1.2.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;FINANCIAMENTO DE BENS | ✔ | 2.01.04.01 | 2.1.2.01 |  |  |
| `2.1.2.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CAPITAL DE GIRO | ✔ | 2.01.04.01 | 2.1.2.01 |  |  |
| `2.1.2.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CRÉDITO ROTATIVO | ✔ | 2.01.04.01 |  |  |  |
| `2.1.2.09` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) JUROS A APROPRIAR | ✔ | 2.01.04.01 |  |  |  |
| `2.1.3` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**OBRIGAÇÕES TRABALHISTAS** |  | 2.01.02 | 2.1.3 |  |  |
| `2.1.3.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SALÁRIOS A PAGAR | ✔ | 2.01.02 |  |  |  |
| `2.1.3.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ENCARGOS SOCIAIS A RECOLHER | ✔ | 2.01.02 |  |  |  |
| `2.1.3.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;PROVISÃO DE FÉRIAS E 13º | ✔ | 2.01.02 |  |  |  |
| `2.1.4` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**OBRIGAÇÕES TRIBUTÁRIAS** |  | 2.01.03 | 2.1.3 |  |  |
| `2.1.4.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;IMPOSTOS SOBRE VENDAS A RECOLHER | ✔ | 2.01.03 |  |  |  |
| `2.1.4.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;IRPJ E CSLL A RECOLHER | ✔ | 2.01.03 | 4.3.1 |  |  |
| `2.1.5` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ADIANTAMENTOS DE CLIENTES | ✔ | 2.01.07.01 | 2.1.2.02 |  |  |
| `2.1.6` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**PARTES RELACIONADAS A PAGAR** |  | 2.01.06 |  |  |  |
| `2.1.6.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MÚTUO A PAGAR | ✔ | 2.01.06 |  |  |  |
| `2.1.7` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OUTRAS OBRIGAÇÕES | ✔ | 2.01.08 |  |  |  |
| `2.2` | &nbsp;&nbsp;&nbsp;**PASSIVO NÃO CIRCULANTE** |  | 2.02 | 2.2 |  |  |
| `2.2.1` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;EMPRÉSTIMOS E FINANCIAMENTOS - LONGO PRAZO | ✔ | 2.02.01.01 |  |  |  |
| `2.2.2` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RECEITAS DIFERIDAS | ✔ | 2.03 | 2.2.2 |  |  |
| `2.2.3` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**OBRAS EM PARCERIA** |  | 2.01.07.03 | 2.1.2.04 |  |  |
| `2.2.3.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;APORTES DE PARCEIROS | ✔ | 2.01.07.03 |  |  |  |
| `2.2.3.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) CUSTOS REPASSADOS | ✔ | 2.01.07.03 |  |  |  |
| `2.3` | &nbsp;&nbsp;&nbsp;**PATRIMÔNIO LÍQUIDO** |  | 2.03 | 2.4 |  |  |
| `2.3.1` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CAPITAL SOCIAL | ✔ | 2.03.01 | 2.4.1 |  |  |
| `2.3.2` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RESERVAS | ✔ | 2.03.04 |  |  |  |
| `2.3.3` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;LUCROS OU PREJUÍZOS ACUMULADOS | ✔ | 2.03.06 | 2.4.3 |  |  |
| `2.3.4` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RESULTADO DO EXERCÍCIO | ✔ | 2.03.06 |  |  |  |
| `3` | **RECEITAS** |  | 3 | 3 |  |  |
| `3.1` | &nbsp;&nbsp;&nbsp;**RECEITA BRUTA** |  | 3.01 | 3.1 |  | 3.01.01.01 |
| `3.1.1` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;VENDA DE IMÓVEIS | ✔ | 3.01 | 3.1.2.01 | 4.1.01 | 3.01.01.01.01 |
| `3.1.2` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;VENDA DE PRODUTOS | ✔ | 3.01 |  | 4.1.02 | 3.01.01.01.02 |
| `3.1.3` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**PRESTAÇÃO DE SERVIÇOS** |  | 3.01 | 3.1.2.01 |  |  |
| `3.1.3.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ALUGUEL DE EQUIPAMENTOS | ✔ | 3.01 |  | 4.3.01 | 3.01.01.01.03 |
| `3.1.3.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;EXECUÇÃO DE OBRA | ✔ | 3.01 |  | 4.3.02 | 3.01.01.01.04 |
| `3.1.3.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ADMINISTRAÇÃO DE OBRA / BDI | ✔ | 3.01 |  | 4.3.03 | 3.01.01.01.05 |
| `3.2` | &nbsp;&nbsp;&nbsp;**(-) DEDUÇÕES DA RECEITA** |  | 3.01 |  |  |  |
| `3.2.1` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) DESCONTOS E DEVOLUÇÕES | ✔ | 3.01 |  | 4.1.03 | 3.01.01.02 |
| `3.2.2` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**(-) IMPOSTOS SOBRE VENDAS** |  | 3.01 | 3.1.2.02 | 4.1.04 | 3.01.01.03 |
| `3.2.2.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) ISS | ✔ | 3.01 | 3.1.2.02.0003 | 6.4.01 | 3.12.03 |
| `3.2.2.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) PIS | ✔ | 3.01 | 3.1.2.02.0004 | 6.4.02 | 3.12.01 |
| `3.2.2.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(-) COFINS | ✔ | 3.01 | 3.1.2.02.0001 |  | 3.12.01 |
| `3.3` | &nbsp;&nbsp;&nbsp;OUTRAS RECEITAS OPERACIONAIS | ✔ | 3.01 |  | 4.1.05 | 3.01.02.05 |
| `4` | **CUSTOS** |  | 3.01 | 4 |  |  |
| `4.1` | &nbsp;&nbsp;&nbsp;CUSTO DE IMÓVEIS VENDIDOS | ✔ | 3.01 |  |  |  |
| `4.2` | &nbsp;&nbsp;&nbsp;**CUSTO DE OBRA** |  | 3.01 | 1.1.3.01 |  | 3.01.02.01 |
| `4.2.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MATERIAIS DE CONSTRUÇÃO | ✔ | 3.01 | 1.1.3.01.0009 | 5.1.01 | 3.01.02.01.01 |
| `4.2.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MÃO DE OBRA DIRETA | ✔ | 3.01 | 1.1.3.01.0001 | 5.1.02 | 3.01.02.01.02 |
| `4.2.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SERVIÇOS DE TERCEIROS | ✔ | 3.01 | 1.1.3.01.0004 | 5.1.03 | 3.01.02.01.03 |
| `4.2.04` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;EQUIPAMENTOS E FERRAMENTAS | ✔ | 3.01 |  | 5.1.04 | 3.01.02.01.04 |
| `4.2.05` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CUSTO DE TERRENO | ✔ | 3.01 |  | 5.1.05 |  |
| `4.2.06` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ENCARGOS E BENEFÍCIOS DE OBRA | ✔ | 3.01 | 1.1.3.01.0002 |  |  |
| `4.3` | &nbsp;&nbsp;&nbsp;CUSTO DE MERCADORIA VENDIDA | ✔ | 3.01 |  | 5.2.01 | 3.01.02.01.05 |
| `4.4` | &nbsp;&nbsp;&nbsp;CUSTO DE SERVIÇOS PRESTADOS | ✔ | 3.01 | 4.2.1.02.0036 |  |  |
| `5` | **DESPESAS OPERACIONAIS** |  | 3.01 | 4.2 |  |  |
| `5.1` | &nbsp;&nbsp;&nbsp;**DESPESAS COM OBRAS** |  | 3.01 |  |  | 3.02 |
| `5.1.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;PESSOAL DE OBRA | ✔ | 3.01 |  | 6.2.02 | 3.02.02.01 |
| `5.1.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;COMISSÕES | ✔ | 3.01 |  | 6.2.01 | 3.02.02.09 |
| `5.1.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ALUGUEL E CONDOMÍNIO DE OBRA | ✔ | 3.01 |  |  | 3.02.02.02 |
| `5.1.04` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SERVIÇOS PÚBLICOS DE OBRA | ✔ | 3.01 |  |  | 3.02.02.03 |
| `5.1.05` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MANUTENÇÃO DE OBRA | ✔ | 3.01 |  |  | 3.02.02.04 |
| `5.1.06` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CARTÓRIO E CERTIDÕES DE OBRA | ✔ | 3.01 |  |  | 3.02.02.05 |
| `5.1.07` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SEGURANÇA E MONITORAMENTO DE OBRA | ✔ | 3.01 |  |  | 3.02.02.06 |
| `5.1.08` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MARKETING DE OBRA | ✔ | 3.01 |  | 6.1.08 | 3.02.02.07 |
| `5.1.09` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OUTRAS DESPESAS DE OBRA | ✔ | 3.01 |  | 6.2.09 | 3.02.02.08 |
| `5.2` | &nbsp;&nbsp;&nbsp;**DESPESAS ADMINISTRATIVAS** |  | 3.01 | 4.2.1 |  | 3.03.01 |
| `5.2.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;PESSOAL | ✔ | 3.01 | 4.2.1.01 | 6.1.01 | 3.03.02 |
| `5.2.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;EXECUÇÃO DE OBRA (ADMINISTRATIVA) | ✔ | 3.01 |  | 6.1.02 | 3.03.03 |
| `5.2.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ALUGUEL E CONDOMÍNIO | ✔ | 3.01 |  | 6.1.03 | 3.03.04 |
| `5.2.04` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SERVIÇOS PÚBLICOS | ✔ | 3.01 |  | 6.1.04 | 3.03.05 |
| `5.2.05` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MANUTENÇÃO E SISTEMAS | ✔ | 3.01 |  | 6.1.05 | 3.03.06 |
| `5.2.06` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CARTÓRIO E CERTIDÕES | ✔ | 3.01 |  | 6.1.06 | 3.03.07 |
| `5.2.07` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SEGURANÇA E MONITORAMENTO | ✔ | 3.01 |  | 6.1.07 | 3.03.08 |
| `5.2.08` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;VIAGENS | ✔ | 3.01 |  | 6.1.09 | 3.03.10 |
| `5.2.09` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MATERIAL DE EXPEDIENTE | ✔ | 3.01 |  | 6.1.10 | 3.03.11 |
| `5.2.10` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;HONORÁRIOS | ✔ | 3.01 | 4.2.1.01.0007 | 6.1.11 | 3.03.12 |
| `5.2.11` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RATEIO ENTRE EMPRESAS | ✔ | 3.01 |  | 6.1.12 | 3.03.13 |
| `5.2.12` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OUTRAS DESPESAS ADMINISTRATIVAS | ✔ | 3.01 | 4.2.1.02 | 6.1.13 | 3.03.14 |
| `5.2.13` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MARKETING ADMINISTRATIVO | ✔ | 3.01 |  |  | 3.03.09 |
| `5.3` | &nbsp;&nbsp;&nbsp;DESPESAS NÃO RECORRENTES | ✔ | 3.01 |  | 6.5.1 | 3.07 |
| `5.4` | &nbsp;&nbsp;&nbsp;**DEPRECIAÇÃO E AMORTIZAÇÃO** |  | 3.01 |  |  | 3.08 |
| `5.4.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;DEPRECIAÇÃO DO IMOBILIZADO | ✔ | 3.01 | 1.2.4 | 6.6.1 | 3.08.02 |
| `5.4.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;AMORTIZAÇÃO DE INTANGÍVEL | ✔ | 3.01 |  |  |  |
| `5.4.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;DEPRECIAÇÃO DE DIREITO DE USO | ✔ | 3.01 |  | 6.6.2 | 3.08.01 |
| `6` | **RESULTADO FINANCEIRO** |  | 3.01 | 4.2.2 |  | 3.09 |
| `6.1` | &nbsp;&nbsp;&nbsp;**RECEITAS FINANCEIRAS** |  | 3.01 | 4.2.2.01 |  | 3.09.01 |
| `6.1.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;JUROS E CORREÇÃO RECEBIDOS | ✔ | 3.01 |  | 4.2.01 | 3.09.01.01 |
| `6.1.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MULTAS RECEBIDAS | ✔ | 3.01 |  | 4.2.02 | 3.09.01.02 |
| `6.1.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;DESCONTOS OBTIDOS | ✔ | 3.01 | 4.2.2.01.0001 | 4.2.03 | 3.09.01.03 |
| `6.1.04` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;JUROS DE MÚTUO RECEBIDOS | ✔ | 3.01 |  | 4.2.04 | 3.09.04 |
| `6.2` | &nbsp;&nbsp;&nbsp;**DESPESAS FINANCEIRAS** |  | 3.01 | 4.2.2.02 |  | 3.09.02 |
| `6.2.01` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;JUROS E CORREÇÃO PAGOS | ✔ | 3.01 | 4.2.2.02.0004 | 6.3.01 | 3.09.02.01 |
| `6.2.02` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;MULTAS PAGAS | ✔ | 3.01 |  | 6.3.02 | 3.09.02.02 |
| `6.2.03` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;DESCONTOS CONCEDIDOS | ✔ | 3.01 |  | 6.3.03 | 3.09.02.03 |
| `6.2.04` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;TARIFAS BANCÁRIAS | ✔ | 3.01 | 4.2.2.02.0001 | 6.3.04 | 3.09.02.04 |
| `6.2.05` | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;JUROS DE MÚTUO PAGOS | ✔ | 3.01 |  | 6.3.05 | 3.09.05 |
| `7` | **TRIBUTOS SOBRE O LUCRO** |  | 3.01 | 4.3 |  |  |
| `7.1` | &nbsp;&nbsp;&nbsp;IRPJ | ✔ | 3.01 | 4.3.1.01 | 6.4.03 | 3.12.02 |
| `7.2` | &nbsp;&nbsp;&nbsp;CSLL | ✔ | 3.01 | 4.3.1.02 |  | 3.12.02 |

## Notas por conta

- **`1.1.1.02` BANCOS CONTA MOVIMENTO** — Uma subconta por conta bancária — é o que permite conciliar banco a banco
- **`1.1.2.02` CLIENTES - PRESTAÇÃO DE SERVIÇOS** — Não existia: a receita de 2026 é quase toda de serviço (BDI, execução, aluguel de equipamento)
- **`1.1.2.03` CLIENTES - VENDA DE PRODUTOS** — Para a loja de decoração e a Simonetto
- **`1.1.3.01` IMÓVEIS EM CONSTRUÇÃO** — Custo de obra acumula aqui até a unidade ser vendida — é o erro nº 1 do Base44
- **`1.1.3.02` IMÓVEIS CONCLUÍDOS** — Uma subconta por unidade, como o contador já faz (AP 101, DUPLEX 401, GARAGEM 05)
- **`1.1.3.05` MERCADORIAS PARA REVENDA** — Não existia em nenhum dos três planos: é o estoque da loja de decoração
- **`1.1.3.06` MOSTRUÁRIO** — Peça exposta no showroom da Simonetto; sai do estoque quando vendida
- **`1.1.6.01` MÚTUO A RECEBER** — R$ 4,4 milhões em 2026 — precisa de subconta por empresa do grupo
- **`2.1.2.01` FINANCIAMENTO DE BENS** — Grua Pingon e crédito Itapema. Só o PRINCIPAL da parcela entra aqui; os juros vão a 6.2.01
- **`2.1.2.03` CRÉDITO ROTATIVO** — ROTATIVO 3M — captação é passivo, não "desconto e devolução" como na planilha
- **`2.1.5` ADIANTAMENTOS DE CLIENTES** — R$ 4,2 milhões no balancete — cliente que pagou antes da entrega não é receita
- **`2.1.6.01` MÚTUO A PAGAR** — A contrapartida de 1.1.6.01 na outra empresa do grupo
- **`2.2.3` OBRAS EM PARCERIA** — SCP por obra: aportes e custos do parceiro, como no balancete (Belle Torre, Igor Totti, Grand Forest)
- **`3.2.1` (-) DESCONTOS E DEVOLUÇÕES** — Só desconto comercial de verdade. Captação de empréstimo NÃO entra aqui — foi o erro da planilha, R$ 2.029.000,00
- **`3.2.2.02` (-) PIS** — O Base44 tem PIS e COFINS numa conta só (6.4.02). A conversão precisa ratear: PIS 1,65%%, COFINS 7,6%% (não cumulativo) ou 0,65%% e 3%% (cumulativo)
- **`3.2.2.03` (-) COFINS** — Ver nota em 3.2.2.02 — a conta 6.4.02 do Base44 alimenta as duas
- **`4.1` CUSTO DE IMÓVEIS VENDIDOS** — Baixa do estoque 1.1.3 no momento da venda — não existia em nenhum dos três planos
- **`5.4.01` DEPRECIAÇÃO DO IMOBILIZADO** — Despesa SEM caixa, contrapartida em 1.2.4. Os R$ 3,39 mi que o Base44 pôs aqui eram parcela de financiamento
- **`6.2.01` JUROS E CORREÇÃO PAGOS** — Recebe a parte de juros das parcelas de financiamento; o principal vai a 2.1.2.01
- **`7.1` IRPJ** — O Base44 junta IRPJ e CSLL em 6.4.03. No balancete de 12/2025 a proporção foi 54,2%% IRPJ / 45,8%% CSLL
- **`7.2` CSLL** — Ver nota em 7.1 — a conta 6.4.03 do Base44 alimenta as duas
