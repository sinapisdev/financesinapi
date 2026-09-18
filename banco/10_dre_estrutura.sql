-- =====================================================================
-- 10 — ESTRUTURA DA DRE GERENCIAL
--
-- A DRE que o Leo já usa, com margem de contribuição e EBITDA, agora
-- alimentada pelo sistema em vez da planilha. A ordem, os agrupamentos e
-- os subtotais são os mesmos do Excel — é o que permite comparar.
-- =====================================================================
begin;

drop table if exists dre_estrutura cascade;
create table dre_estrutura (
  ordem      smallint primary key,
  codigo     text not null,
  rotulo     text not null,
  -- 'conta' soma a linha_dre; 'grupo' soma tudo que começa com o prefixo;
  -- 'total' é subtotal acumulado das linhas anteriores marcadas
  tipo       text not null check (tipo in ('conta','grupo','total','percentual')),
  nivel      smallint not null default 1,
  formula    text,          -- para 'total': lista de códigos somados
  destaque   boolean not null default false
);

insert into dre_estrutura (ordem, codigo, rotulo, tipo, nivel, formula, destaque) values
 (10,'3.01.01.01',   'Receita bruta',                  'grupo',1,null,false),
 (11,'3.01.01.01.01','Venda de imóveis',               'conta',2,null,false),
 (12,'3.01.01.01.02','Venda de produtos',              'conta',2,null,false),
 (13,'3.01.01.01.03','Aluguéis de equipamento',        'conta',2,null,false),
 (14,'3.01.01.01.04','Execução de obra',               'conta',2,null,false),
 (15,'3.01.01.01.05','Administração de obra / BDI',    'conta',2,null,false),
 (20,'3.01.01.02',   'Descontos e devoluções',         'conta',1,null,false),
 (25,'ROB',          'Receita bruta operacional',      'total',1,'3.01.01.01,3.01.01.02',true),
 (30,'3.01.01.03',   'Impostos sobre vendas',          'conta',1,null,false),
 (35,'ROL',          'Receita líquida',                'total',1,'ROB,3.01.01.03',true),
 (40,'3.01.02.01',   'Custo',                          'grupo',1,null,false),
 (41,'3.01.02.01.01','Materiais de construção',        'conta',2,null,false),
 (42,'3.01.02.01.02','Mão de obra direta',             'conta',2,null,false),
 (43,'3.01.02.01.03','Serviços de terceiros - obra',   'conta',2,null,false),
 (44,'3.01.02.01.04','Equipamentos e ferramentas',     'conta',2,null,false),
 (45,'3.01.02.01.05','Custo de mercadoria vendida',    'conta',2,null,false),
 (50,'MGPDV',        'Margem do empreendimento',       'total',1,'ROL,3.01.02.01',true),
 (55,'3.01.02.05',   'Outras desp./rec. de lucro bruto','conta',1,null,false),
 (60,'3.01',         'Lucro bruto',                    'total',1,'MGPDV,3.01.02.05',true),
 (65,'3.02',         'Despesas com obras',             'grupo',1,null,false),
 (66,'3.02.02.01',   'Pessoal',                        'conta',2,null,false),
 (67,'3.02.02.02',   'Aluguel e condomínio',           'conta',2,null,false),
 (68,'3.02.02.03',   'Serviços públicos',              'conta',2,null,false),
 (69,'3.02.02.04',   'Manutenção',                     'conta',2,null,false),
 (70,'3.02.02.05',   'Cartório e certidões',           'conta',2,null,false),
 (71,'3.02.02.06',   'Segurança e monitoramento',      'conta',2,null,false),
 (72,'3.02.02.07',   'Marketing',                      'conta',2,null,false),
 (73,'3.02.02.08',   'Outras despesas/receitas',       'conta',2,null,false),
 (74,'3.02.02.09',   'Comissões',                      'conta',2,null,false),
 (80,'MGCON',        'Margem de contribuição',         'total',1,'3.01,3.02',true),
 (85,'3.03.01',      'Despesas gerais administrativas','grupo',1,null,false),
 (86,'3.03.02',      'Pessoal',                        'conta',2,null,false),
 (87,'3.03.03',      'Execução de obra',               'conta',2,null,false),
 (88,'3.03.04',      'Aluguel e condomínio',           'conta',2,null,false),
 (89,'3.03.05',      'Serviços públicos',              'conta',2,null,false),
 (90,'3.03.06',      'Manutenção e sistemas',          'conta',2,null,false),
 (91,'3.03.07',      'Cartório e certidões',           'conta',2,null,false),
 (92,'3.03.08',      'Segurança e monitoramento',      'conta',2,null,false),
 (93,'3.03.09',      'Marketing',                      'conta',2,null,false),
 (94,'3.03.10',      'Viagens',                        'conta',2,null,false),
 (95,'3.03.11',      'Material de expediente',         'conta',2,null,false),
 (96,'3.03.12',      'Honorários',                     'conta',2,null,false),
 (97,'3.03.13',      'Rateio',                         'conta',2,null,false),
 (98,'3.03.14',      'Outras despesas/receitas',       'conta',2,null,false),
(100,'EBITDAAJ',     'EBITDA ajustado',                'total',1,'MGCON,3.03.01',true),
(105,'3.07',         'Despesas não recorrentes',       'conta',1,null,false),
(110,'EBITDA',       'EBITDA',                         'total',1,'EBITDAAJ,3.07',true),
(115,'3.08',         'Depreciação e amortização',      'grupo',1,null,false),
(116,'3.08.01',      'Depreciação - direito de uso',   'conta',2,null,false),
(117,'3.08.02',      'Depreciação e amortização',      'conta',2,null,false),
(120,'EBIT',         'EBIT',                           'total',1,'EBITDA,3.08',true),
(125,'3.09',         'Resultado financeiro',           'grupo',1,null,false),
(126,'3.09.01.01',   'Juros e correção recebidos',     'conta',2,null,false),
(127,'3.09.01.02',   'Multas recebidas',               'conta',2,null,false),
(128,'3.09.01.03',   'Descontos obtidos',              'conta',2,null,false),
(129,'3.09.02.01',   'Juros e correção pagos',         'conta',2,null,false),
(130,'3.09.02.02',   'Multas pagas',                   'conta',2,null,false),
(131,'3.09.02.03',   'Descontos concedidos',           'conta',2,null,false),
(132,'3.09.02.04',   'Tarifas bancárias',              'conta',2,null,false),
(133,'3.09.04',      'Receita financeira de mútuo',    'conta',2,null,false),
(134,'3.09.05',      'Despesa financeira de mútuo',    'conta',2,null,false),
(140,'EBT',          'EBT',                            'total',1,'EBIT,3.09',true),
(145,'3.12',         'Impostos sobre o lucro',         'grupo',1,null,false),
(146,'3.12.01',      'PIS/COFINS sobre receitas',      'conta',2,null,false),
(147,'3.12.02',      'IRPJ/CSLL',                      'conta',2,null,false),
(148,'3.12.03',      'ISS sobre vendas',               'conta',2,null,false),
(150,'LL',           'Resultado do exercício',         'total',1,'EBT,3.12',true);

commit;
