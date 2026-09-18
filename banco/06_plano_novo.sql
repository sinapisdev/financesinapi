-- =====================================================================
-- 06 — PLANO DE CONTAS DEFINITIVO
--
-- Desenhado do zero a partir de três fontes, nenhuma delas suficiente:
--   · balancetes do contador  — patrimonial completo e código SPED, mas
--                               resultado quase vazio (tudo vai a estoque)
--   · DRE gerencial do Excel  — resultado rico (margem, EBITDA), mas sem
--                               patrimonial e com captação virando receita
--   · Base44                  — operacional (processo, centro de custo),
--                               com financiamento lançado como depreciação
--
-- Vive ao lado de `plano_conta`, que não é tocada. O de-para em cada linha
-- é o que torna isto definitivo: a mesma conta responde ao contador (ECD),
-- à sua DRE e ao histórico já carregado.
-- =====================================================================

begin;

create table conta (
  id                bigint generated always as identity primary key,
  codigo            text        not null unique,
  descricao         text        not null,
  conta_pai_id      bigint      references conta(id),
  nivel             smallint    not null,
  grupo             smallint    not null check (grupo between 1 and 7),
  natureza          text        not null check (natureza in ('devedora','credora')),
  aceita_lancamento boolean     not null,
  -- redutora: entra no grupo com sinal invertido (deprec. acumulada, deduções)
  redutora          boolean     not null default false,

  -- ---------- de-para: é isto que impede a quarta numeração solta ----------
  codigo_sped       text,   -- referencial da Receita Federal, para a ECD
  codigo_contador   text,   -- conta equivalente nos balancetes
  codigo_base44     text,   -- conta equivalente no plano atual (plano_conta.codigo)
  linha_dre         text,   -- linha da DRE gerencial (3.01.01.01.01 etc.)

  observacao        text,
  ativo             boolean     not null default true,
  criado_em         timestamptz not null default now(),
  unique (id, aceita_lancamento)
);
comment on table conta is 'Plano de contas definitivo. grupo: 1 ativo · 2 passivo · 3 receitas · 4 custos · 5 despesas · 6 resultado financeiro · 7 tributos sobre o lucro';
comment on column conta.redutora is 'Conta que reduz o saldo do grupo (depreciação acumulada, deduções de receita)';

create index conta_pai_idx      on conta (conta_pai_id);
create index conta_base44_idx   on conta (codigo_base44) where codigo_base44 is not null;
create index conta_contador_idx on conta (codigo_contador) where codigo_contador is not null;

-- Carga declarativa: nível e pai saem do próprio código, para não haver
-- hierarquia digitada errada.
create or replace function cadastrar_conta(
  p_codigo text, p_descricao text, p_natureza text, p_aceita boolean,
  p_sped text default null, p_contador text default null,
  p_base44 text default null, p_dre text default null,
  p_redutora boolean default false, p_obs text default null
) returns bigint language plpgsql as $$
declare
  v_pai text := regexp_replace(p_codigo, '\.[^.]+$', '');
  v_id  bigint;
begin
  insert into conta (codigo, descricao, conta_pai_id, nivel, grupo, natureza,
                     aceita_lancamento, redutora, codigo_sped, codigo_contador,
                     codigo_base44, linha_dre, observacao)
  values (p_codigo, upper(p_descricao),
          (select id from conta where codigo = v_pai and v_pai <> p_codigo),
          length(p_codigo) - length(replace(p_codigo, '.', '')) + 1,
          left(p_codigo, 1)::smallint, p_natureza, p_aceita, p_redutora,
          p_sped, p_contador, p_base44, p_dre, p_obs)
  returning id into v_id;
  return v_id;
end $$;

-- =====================================================================
-- 1 · ATIVO
-- =====================================================================
select cadastrar_conta('1','Ativo','devedora',false,'1','1');
select cadastrar_conta('1.1','Ativo circulante','devedora',false,'1.01','1.1');

select cadastrar_conta('1.1.1','Disponibilidades','devedora',false,'1.01.01','1.1.1');
select cadastrar_conta('1.1.1.01','Caixa','devedora',true,'1.01.01','1.1.1.01','1.1.1.01');
select cadastrar_conta('1.1.1.02','Bancos conta movimento','devedora',false,'1.01.01','1.1.1.02','1.1.1.02',null,false,
  'Uma subconta por conta bancária — é o que permite conciliar banco a banco');
select cadastrar_conta('1.1.1.03','Aplicações financeiras','devedora',true,'1.01.02','1.1.1.03');

select cadastrar_conta('1.1.2','Clientes','devedora',false,'1.01.02','1.1.2.01');
select cadastrar_conta('1.1.2.01','Clientes - venda de imóveis','devedora',true,'1.01.02','1.1.2.01','1.1.2.01');
select cadastrar_conta('1.1.2.02','Clientes - prestação de serviços','devedora',true,'1.01.02',null,null,null,false,
  'Não existia: a receita de 2026 é quase toda de serviço (BDI, execução, aluguel de equipamento)');
select cadastrar_conta('1.1.2.03','Clientes - venda de produtos','devedora',true,'1.01.02',null,null,null,false,
  'Para a loja de decoração e a Simonetto');
select cadastrar_conta('1.1.2.09','(-) Provisão para perdas','credora',true,'1.01.02',null,null,null,true);

select cadastrar_conta('1.1.3','Estoques','devedora',false,'1.01.03','1.1.3');
select cadastrar_conta('1.1.3.01','Imóveis em construção','devedora',true,'1.01.03','1.1.3.01','1.2.1.01',null,false,
  'Custo de obra acumula aqui até a unidade ser vendida — é o erro nº 1 do Base44. O contador abre subconta por obra; aqui o corte por obra vem do centro de custo gravado em cada partida, que não exige conta nova a cada empreendimento');
select cadastrar_conta('1.1.3.02','Imóveis concluídos','devedora',true,'1.01.03','1.1.3.14','1.1.3.02',null,false,
  'O detalhe por unidade (AP 101, DUPLEX 401, GARAGEM 05) vem do item de estoque, não de subconta');
select cadastrar_conta('1.1.3.03','Terrenos','devedora',true,'1.01.03',null,'1.2.1.02');
select cadastrar_conta('1.1.3.04','Materiais de construção','devedora',true,'1.01.03',null,'1.1.3.01');
select cadastrar_conta('1.1.3.05','Mercadorias para revenda','devedora',true,'1.01.03',null,null,null,false,
  'Não existia em nenhum dos três planos: é o estoque da loja de decoração');
select cadastrar_conta('1.1.3.06','Mostruário','devedora',true,'1.01.03',null,null,null,false,
  'Peça exposta no showroom da Simonetto; sai do estoque quando vendida');

select cadastrar_conta('1.1.4','Tributos a recuperar','devedora',true,'1.01.04.02','1.1.2.04');
select cadastrar_conta('1.1.5','Adiantamentos','devedora',false,'1.01.05','1.1.2.03');
select cadastrar_conta('1.1.5.01','Adiantamento a fornecedores','devedora',true,'1.01.05.02','1.1.2.03.0011');
select cadastrar_conta('1.1.5.02','Adiantamento a funcionários','devedora',true,'1.01.05.99','1.1.2.03.0007');
select cadastrar_conta('1.1.5.03','Adiantamento a sócios','devedora',true,'1.01.05.99','1.1.2.03.0010');

select cadastrar_conta('1.1.6','Partes relacionadas a receber','devedora',false,'1.01.05.99');
select cadastrar_conta('1.1.6.01','Mútuo a receber','devedora',true,'1.01.05.99',null,'1.1.2.05',null,false,
  'R$ 4,4 milhões em 2026 — precisa de subconta por empresa do grupo');
select cadastrar_conta('1.1.7','Despesas antecipadas','devedora',true,'1.01.06');

select cadastrar_conta('1.2','Ativo não circulante','devedora',false,'1.02','1.2');
select cadastrar_conta('1.2.1','Realizável a longo prazo','devedora',true,'1.02.01','1.2.2');
select cadastrar_conta('1.2.2','Investimentos','devedora',false,'1.02.02','1.2.3.01');
select cadastrar_conta('1.2.2.01','Participações em SCP','devedora',true,'1.02.02','1.2.3.01.0001');
select cadastrar_conta('1.2.2.02','Cotas de capital','devedora',true,'1.02.02','1.2.3.01.0003');
select cadastrar_conta('1.2.3','Imobilizado','devedora',false,'1.02.01','1.2.3');
select cadastrar_conta('1.2.3.01','Máquinas e equipamentos','devedora',true,'1.02.01','1.2.3.04','1.2.2.01');
select cadastrar_conta('1.2.3.02','Veículos','devedora',true,'1.02.01','1.2.3.05');
select cadastrar_conta('1.2.3.03','Equipamentos de informática','devedora',true,'1.02.01','1.2.3.03');
select cadastrar_conta('1.2.3.04','Móveis e utensílios','devedora',true,'1.02.01','1.2.3.02');
select cadastrar_conta('1.2.3.05','Imóveis de uso','devedora',true,'1.02.01');
select cadastrar_conta('1.2.4','(-) Depreciação acumulada','credora',false,'1.02.01','1.2.4',null,null,true);
select cadastrar_conta('1.2.4.01','(-) Depreciação de máquinas e equipamentos','credora',true,'1.02.01','1.2.4.04',null,null,true);
select cadastrar_conta('1.2.4.02','(-) Depreciação de veículos','credora',true,'1.02.01',null,null,null,true);
select cadastrar_conta('1.2.4.03','(-) Depreciação de informática','credora',true,'1.02.01','1.2.4.03',null,null,true);
select cadastrar_conta('1.2.4.04','(-) Depreciação de móveis e utensílios','credora',true,'1.02.01',null,null,null,true);
select cadastrar_conta('1.2.5','Intangível','devedora',true,'1.02.03');

commit;

-- =====================================================================
-- 2 · PASSIVO E PATRIMÔNIO LÍQUIDO
-- =====================================================================
begin;
select cadastrar_conta('2','Passivo','credora',false,'2','2');
select cadastrar_conta('2.1','Passivo circulante','credora',false,'2.01','2.1');

select cadastrar_conta('2.1.1','Fornecedores','credora',false,'2.01.01','2.1.1');
select cadastrar_conta('2.1.1.01','Fornecedores - materiais','credora',true,'2.01.01','2.1.1.01','2.1.1.01');
select cadastrar_conta('2.1.1.02','Fornecedores - serviços','credora',true,'2.01.01','2.1.1.02');

-- É aqui que os R$ 3,39 milhões lançados como "depreciação" deveriam estar.
select cadastrar_conta('2.1.2','Empréstimos e financiamentos - curto prazo','credora',false,'2.01.04','2.1.2');
select cadastrar_conta('2.1.2.01','Financiamento de bens','credora',true,'2.01.04.01','2.1.2.01',null,null,false,
  'Grua Pingon e crédito Itapema. Só o PRINCIPAL da parcela entra aqui; os juros vão a 6.2.01');
select cadastrar_conta('2.1.2.02','Capital de giro','credora',true,'2.01.04.01','2.1.2.01');
select cadastrar_conta('2.1.2.03','Crédito rotativo','credora',true,'2.01.04.01',null,null,null,false,
  'ROTATIVO 3M — captação é passivo, não "desconto e devolução" como na planilha');
select cadastrar_conta('2.1.2.09','(-) Juros a apropriar','devedora',true,'2.01.04.01',null,null,null,true);

select cadastrar_conta('2.1.3','Obrigações trabalhistas','credora',false,'2.01.02','2.1.3');
select cadastrar_conta('2.1.3.01','Salários a pagar','credora',true,'2.01.02');
select cadastrar_conta('2.1.3.02','Encargos sociais a recolher','credora',true,'2.01.02');
select cadastrar_conta('2.1.3.03','Provisão de férias e 13º','credora',true,'2.01.02');

select cadastrar_conta('2.1.4','Obrigações tributárias','credora',false,'2.01.03','2.1.3');
select cadastrar_conta('2.1.4.01','Impostos sobre vendas a recolher','credora',true,'2.01.03');
select cadastrar_conta('2.1.4.02','IRPJ e CSLL a recolher','credora',true,'2.01.03','4.3.1');

select cadastrar_conta('2.1.5','Adiantamentos de clientes','credora',true,'2.01.07.01','2.1.2.02',null,null,false,
  'R$ 4,2 milhões no balancete — cliente que pagou antes da entrega não é receita');

select cadastrar_conta('2.1.6','Partes relacionadas a pagar','credora',false,'2.01.06');
select cadastrar_conta('2.1.6.01','Mútuo a pagar','credora',true,'2.01.06',null,null,null,false,
  'A contrapartida de 1.1.6.01 na outra empresa do grupo');
select cadastrar_conta('2.1.7','Outras obrigações','credora',true,'2.01.08');

select cadastrar_conta('2.2','Passivo não circulante','credora',false,'2.02','2.2');
select cadastrar_conta('2.2.1','Empréstimos e financiamentos - longo prazo','credora',true,'2.02.01.01');
select cadastrar_conta('2.2.2','Receitas diferidas','credora',true,'2.03','2.2.2');
select cadastrar_conta('2.2.3','Obras em parceria','credora',false,'2.01.07.03','2.1.2.04',null,null,false,
  'SCP por obra: aportes e custos do parceiro, como no balancete (Belle Torre, Igor Totti, Grand Forest)');
select cadastrar_conta('2.2.3.01','Aportes de parceiros','credora',true,'2.01.07.03');
select cadastrar_conta('2.2.3.02','(-) Custos repassados','devedora',true,'2.01.07.03',null,null,null,true);

select cadastrar_conta('2.3','Patrimônio líquido','credora',false,'2.03','2.4');
select cadastrar_conta('2.3.1','Capital social','credora',true,'2.03.01','2.4.1');
select cadastrar_conta('2.3.2','Reservas','credora',true,'2.03.04');
select cadastrar_conta('2.3.3','Lucros ou prejuízos acumulados','credora',true,'2.03.06','2.4.3');
select cadastrar_conta('2.3.4','Resultado do exercício','credora',true,'2.03.06');
commit;

-- =====================================================================
-- 3 · RECEITAS   |   4 · CUSTOS   |   5 · DESPESAS
-- 6 · RESULTADO FINANCEIRO   |   7 · TRIBUTOS SOBRE O LUCRO
--
-- Aqui o plano segue a SUA DRE gerencial, não a do contador: é ela que
-- tem margem de contribuição e EBITDA, e é como você lê o negócio.
-- =====================================================================
begin;
select cadastrar_conta('3','Receitas','credora',false,'3','3');
select cadastrar_conta('3.1','Receita bruta','credora',false,'3.01','3.1',null,'3.01.01.01');
select cadastrar_conta('3.1.1','Venda de imóveis','credora',true,'3.01','3.1.2.01','4.1.01','3.01.01.01.01');
select cadastrar_conta('3.1.2','Venda de produtos','credora',true,'3.01',null,'4.1.02','3.01.01.01.02');
select cadastrar_conta('3.1.3','Prestação de serviços','credora',false,'3.01','3.1.2.01');
select cadastrar_conta('3.1.3.01','Aluguel de equipamentos','credora',true,'3.01',null,'4.3.01','3.01.01.01.03');
select cadastrar_conta('3.1.3.02','Execução de obra','credora',true,'3.01',null,'4.3.02','3.01.01.01.04');
select cadastrar_conta('3.1.3.03','Administração de obra / BDI','credora',true,'3.01',null,'4.3.03','3.01.01.01.05');

select cadastrar_conta('3.2','(-) Deduções da receita','devedora',false,'3.01',null,null,null,true);
select cadastrar_conta('3.2.1','(-) Descontos e devoluções','devedora',true,'3.01',null,'4.1.03','3.01.01.02',true,
  'Só desconto comercial de verdade. Captação de empréstimo NÃO entra aqui — foi o erro da planilha, R$ 2.029.000,00');
select cadastrar_conta('3.2.2','(-) Impostos sobre vendas','devedora',false,'3.01','3.1.2.02','4.1.04','3.01.01.03',true);
select cadastrar_conta('3.2.2.01','(-) ISS','devedora',true,'3.01','3.1.2.02.0003','6.4.01','3.12.03',true);
select cadastrar_conta('3.2.2.02','(-) PIS','devedora',true,'3.01','3.1.2.02.0004','6.4.02','3.12.01',true,
  'O Base44 tem PIS e COFINS numa conta só (6.4.02). A conversão precisa ratear: PIS 1,65%%, COFINS 7,6%% (não cumulativo) ou 0,65%% e 3%% (cumulativo)');
select cadastrar_conta('3.2.2.03','(-) COFINS','devedora',true,'3.01','3.1.2.02.0001',null,'3.12.01',true,
  'Ver nota em 3.2.2.02 — a conta 6.4.02 do Base44 alimenta as duas');
select cadastrar_conta('3.3','Outras receitas operacionais','credora',true,'3.01',null,'4.1.05','3.01.02.05');

select cadastrar_conta('4','Custos','devedora',false,'3.01','4');
select cadastrar_conta('4.1','Custo de imóveis vendidos','devedora',true,'3.01',null,null,null,false,
  'Baixa do estoque 1.1.3 no momento da venda — não existia em nenhum dos três planos');
select cadastrar_conta('4.2','Custo de obra','devedora',false,'3.01','1.1.3.01',null,'3.01.02.01');
select cadastrar_conta('4.2.01','Materiais de construção','devedora',true,'3.01','1.1.3.01.0009','5.1.01','3.01.02.01.01');
select cadastrar_conta('4.2.02','Mão de obra direta','devedora',true,'3.01','1.1.3.01.0001','5.1.02','3.01.02.01.02');
select cadastrar_conta('4.2.03','Serviços de terceiros','devedora',true,'3.01','1.1.3.01.0004','5.1.03','3.01.02.01.03');
select cadastrar_conta('4.2.04','Equipamentos e ferramentas','devedora',true,'3.01',null,'5.1.04','3.01.02.01.04');
select cadastrar_conta('4.2.05','Custo de terreno','devedora',true,'3.01',null,'5.1.05');
select cadastrar_conta('4.2.06','Encargos e benefícios de obra','devedora',true,'3.01','1.1.3.01.0002');
select cadastrar_conta('4.3','Custo de mercadoria vendida','devedora',true,'3.01',null,'5.2.01','3.01.02.01.05');
select cadastrar_conta('4.4','Custo de serviços prestados','devedora',true,'3.01','4.2.1.02.0036');

select cadastrar_conta('5','Despesas operacionais','devedora',false,'3.01','4.2');
-- Bloco 3.02 da sua DRE: fica entre o Lucro Bruto e a Margem de Contribuição.
-- É despesa ligada à obra, não à administração — por isso não se mistura com 5.2.
select cadastrar_conta('5.1','Despesas com obras','devedora',false,'3.01',null,null,'3.02');
select cadastrar_conta('5.1.01','Pessoal de obra','devedora',true,'3.01',null,'6.2.02','3.02.02.01');
select cadastrar_conta('5.1.02','Comissões','devedora',true,'3.01',null,'6.2.01','3.02.02.09');
select cadastrar_conta('5.1.03','Aluguel e condomínio de obra','devedora',true,'3.01',null,null,'3.02.02.02');
select cadastrar_conta('5.1.04','Serviços públicos de obra','devedora',true,'3.01',null,null,'3.02.02.03');
select cadastrar_conta('5.1.05','Manutenção de obra','devedora',true,'3.01',null,null,'3.02.02.04');
select cadastrar_conta('5.1.06','Cartório e certidões de obra','devedora',true,'3.01',null,null,'3.02.02.05');
select cadastrar_conta('5.1.07','Segurança e monitoramento de obra','devedora',true,'3.01',null,null,'3.02.02.06');
select cadastrar_conta('5.1.08','Marketing de obra','devedora',true,'3.01',null,'6.1.08','3.02.02.07');
select cadastrar_conta('5.1.09','Outras despesas de obra','devedora',true,'3.01',null,'6.2.09','3.02.02.08');

select cadastrar_conta('5.2','Despesas administrativas','devedora',false,'3.01','4.2.1',null,'3.03.01');
select cadastrar_conta('5.2.01','Pessoal','devedora',true,'3.01','4.2.1.01','6.1.01','3.03.02');
select cadastrar_conta('5.2.02','Execução de obra (administrativa)','devedora',true,'3.01',null,'6.1.02','3.03.03');
select cadastrar_conta('5.2.03','Aluguel e condomínio','devedora',true,'3.01',null,'6.1.03','3.03.04');
select cadastrar_conta('5.2.04','Serviços públicos','devedora',true,'3.01',null,'6.1.04','3.03.05');
select cadastrar_conta('5.2.05','Manutenção e sistemas','devedora',true,'3.01',null,'6.1.05','3.03.06');
select cadastrar_conta('5.2.06','Cartório e certidões','devedora',true,'3.01',null,'6.1.06','3.03.07');
select cadastrar_conta('5.2.07','Segurança e monitoramento','devedora',true,'3.01',null,'6.1.07','3.03.08');
select cadastrar_conta('5.2.08','Viagens','devedora',true,'3.01',null,'6.1.09','3.03.10');
select cadastrar_conta('5.2.09','Material de expediente','devedora',true,'3.01',null,'6.1.10','3.03.11');
select cadastrar_conta('5.2.13','Marketing administrativo','devedora',true,'3.01',null,null,'3.03.09');
select cadastrar_conta('5.2.10','Honorários','devedora',true,'3.01','4.2.1.01.0007','6.1.11','3.03.12');
select cadastrar_conta('5.2.11','Rateio entre empresas','devedora',true,'3.01',null,'6.1.12','3.03.13');
select cadastrar_conta('5.2.12','Outras despesas administrativas','devedora',true,'3.01','4.2.1.02','6.1.13','3.03.14');

select cadastrar_conta('5.3','Despesas não recorrentes','devedora',true,'3.01',null,'6.5.1','3.07');
select cadastrar_conta('5.4','Depreciação e amortização','devedora',false,'3.01',null,null,'3.08');
select cadastrar_conta('5.4.01','Depreciação do imobilizado','devedora',true,'3.01','1.2.4','6.6.1','3.08.02',false,
  'Despesa SEM caixa, contrapartida em 1.2.4. Os R$ 3,39 mi que o Base44 pôs aqui eram parcela de financiamento');
select cadastrar_conta('5.4.02','Amortização de intangível','devedora',true,'3.01');
select cadastrar_conta('5.4.03','Depreciação de direito de uso','devedora',true,'3.01',null,'6.6.2','3.08.01');

select cadastrar_conta('6','Resultado financeiro','credora',false,'3.01','4.2.2',null,'3.09');
select cadastrar_conta('6.1','Receitas financeiras','credora',false,'3.01','4.2.2.01',null,'3.09.01');
select cadastrar_conta('6.1.01','Juros e correção recebidos','credora',true,'3.01',null,'4.2.01','3.09.01.01');
select cadastrar_conta('6.1.02','Multas recebidas','credora',true,'3.01',null,'4.2.02','3.09.01.02');
select cadastrar_conta('6.1.03','Descontos obtidos','credora',true,'3.01','4.2.2.01.0001','4.2.03','3.09.01.03');
select cadastrar_conta('6.1.04','Juros de mútuo recebidos','credora',true,'3.01',null,'4.2.04','3.09.04');
select cadastrar_conta('6.2','Despesas financeiras','devedora',false,'3.01','4.2.2.02',null,'3.09.02');
select cadastrar_conta('6.2.01','Juros e correção pagos','devedora',true,'3.01','4.2.2.02.0004','6.3.01','3.09.02.01',false,
  'Recebe a parte de juros das parcelas de financiamento; o principal vai a 2.1.2.01');
select cadastrar_conta('6.2.02','Multas pagas','devedora',true,'3.01',null,'6.3.02','3.09.02.02');
select cadastrar_conta('6.2.03','Descontos concedidos','devedora',true,'3.01',null,'6.3.03','3.09.02.03');
select cadastrar_conta('6.2.04','Tarifas bancárias','devedora',true,'3.01','4.2.2.02.0001','6.3.04','3.09.02.04');
select cadastrar_conta('6.2.05','Juros de mútuo pagos','devedora',true,'3.01',null,'6.3.05','3.09.05');

select cadastrar_conta('7','Tributos sobre o lucro','devedora',false,'3.01','4.3');
select cadastrar_conta('7.1','IRPJ','devedora',true,'3.01','4.3.1.01','6.4.03','3.12.02',false,
  'O Base44 junta IRPJ e CSLL em 6.4.03. No balancete de 12/2025 a proporção foi 54,2%% IRPJ / 45,8%% CSLL');
select cadastrar_conta('7.2','CSLL','devedora',true,'3.01','4.3.1.02',null,'3.12.02',false,
  'Ver nota em 7.1 — a conta 6.4.03 do Base44 alimenta as duas');
commit;
