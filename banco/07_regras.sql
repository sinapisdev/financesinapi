-- =====================================================================
-- 07 — REGRAS DE PARTIDA
--
-- A contabilidade deixa de ser digitada e passa a ser GERADA. Cada evento
-- financeiro (emitir lançamento, baixar parcela) consulta as regras do seu
-- processo e produz as partidas.
--
-- Corrigiu a regra? Reprocessa e o histórico inteiro se ajusta. É o que
-- torna "perna solta" impossível em vez de apenas corrigível.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Uma conta contábil por conta bancária. Sem isto não há conciliação
-- banco a banco — é a falha nº 6 do diagnóstico (seis bancos, uma conta).
-- ---------------------------------------------------------------------
alter table conta_bancaria add column if not exists conta_nova_id bigint references conta(id);

do $$
declare r record; v_pai bigint; v_id bigint; n int := 0;
begin
  select id into v_pai from conta where codigo = '1.1.1.02';
  -- idempotente: só cria para a conta bancária que ainda não tem conta contábil
  select coalesce(max(split_part(codigo, '.', 5)::int), 0) into n
    from conta where codigo like '1.1.1.02.%';
  for r in select cb.id, cb.apelido, e.codigo as emp
             from conta_bancaria cb join empresa e on e.id = cb.empresa_id
            where cb.conta_nova_id is null
            order by e.codigo, cb.apelido loop
    n := n + 1;
    insert into conta (codigo, descricao, conta_pai_id, nivel, grupo, natureza,
                       aceita_lancamento, codigo_sped, codigo_contador)
    values ('1.1.1.02.' || lpad(n::text, 4, '0'),
            upper(r.emp || ' · ' || r.apelido), v_pai, 5, 1, 'devedora', true,
            '1.01.01', '1.1.1.02')
    returning id into v_id;
    update conta_bancaria set conta_nova_id = v_id where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- As regras, como LINHAS.
-- No Base44 isso eram 35 colunas fixas num registro só, o que obrigava a
-- inventar coluna nova a cada caso — conta_debito_juros, conta_credito_multa,
-- conta_debito_transitoria — e mesmo assim não cobria tudo.
-- ---------------------------------------------------------------------
create table if not exists regra (
  id           bigint generated always as identity primary key,
  processo_id  bigint   not null references processo(id) on delete cascade,
  evento       text     not null check (evento in ('emissao','baixa')),
  ordem        smallint not null,
  lado         char(1)  not null check (lado in ('D','C')),
  -- de qual parte do valor esta partida trata
  componente   text     not null check (componente in
               ('valor_total','principal','juros','multa','desconto','liquido')),
  conta_id     bigint   references conta(id),
  -- ou resolvida em tempo de execução, quando a conta depende do lançamento
  conta_dinamica text   check (conta_dinamica in
               ('banco','conta_lancamento','cliente','fornecedor')),
  condicao     text     check (condicao in ('a_vista','a_prazo')),
  historico    text     not null,
  ativo        boolean  not null default true,
  observacao   text,
  constraint conta_fixa_ou_dinamica check (
    (conta_id is not null and conta_dinamica is null) or
    (conta_id is null     and conta_dinamica is not null)),
  unique (processo_id, evento, ordem)
);
comment on column regra.componente is 'Emissão usa valor_total; baixa decompõe em principal, juros, multa, desconto e liquido';

create or replace function r(
  p_proc text, p_evento text, p_ordem int, p_lado text, p_comp text,
  p_conta text, p_dinamica text default null, p_hist text default '',
  p_obs text default null
) returns void language plpgsql as $$
declare v_conta bigint;
begin
  if p_conta is not null then
    select id into v_conta from conta where codigo = p_conta;
    if v_conta is null then raise exception 'conta % não existe', p_conta; end if;
  end if;
  insert into regra (processo_id, evento, ordem, lado, componente, conta_id,
                     conta_dinamica, historico, observacao)
  select p.id, p_evento, p_ordem, p_lado, p_comp, v_conta, p_dinamica,
         coalesce(nullif(p_hist,''), p.nome), p_obs
    from processo p where p.codigo = p_proc;
end $$;

-- ---------------------------------------------------------------------
-- PADRÃO A · RECEITA A PRAZO
--   emissão: nasce o direito contra o cliente
--   baixa:   o direito vira dinheiro; juros e multa são receita nova,
--            desconto concedido é despesa — nenhum deles muda o principal
-- ---------------------------------------------------------------------
drop function if exists padrao_receita(text, text);
drop function if exists padrao_receita(text, text, text);
create function padrao_receita(
  p_proc text, p_cliente text default '1.1.2.01', p_receita text default null)
returns void language plpgsql as $$
begin
  perform r(p_proc,'emissao',1,'D','valor_total',p_cliente,null,'Valor a receber');
  -- Quando p_receita é nulo, a conta vem do lançamento. Isso só serve se o
  -- Base44 tiver gravado ali uma conta de RESULTADO — e em vendas de imóvel
  -- ele gravou a conta de CLIENTES, a contrapartida patrimonial. O crédito
  -- resolvia para a mesma conta do débito e a receita se anulava.
  if p_receita is null then
    perform r(p_proc,'emissao',2,'C','valor_total',null,'conta_lancamento','Receita reconhecida');
  else
    perform r(p_proc,'emissao',2,'C','valor_total',p_receita,null,'Receita reconhecida');
  end if;
  perform r(p_proc,'baixa',1,'D','liquido',null,'banco','Recebimento');
  perform r(p_proc,'baixa',2,'C','principal',p_cliente,null,'Baixa do valor a receber');
  perform r(p_proc,'baixa',3,'C','juros','6.1.01',null,'Juros recebidos');
  perform r(p_proc,'baixa',4,'C','multa','6.1.02',null,'Multa recebida');
  perform r(p_proc,'baixa',5,'D','desconto','6.2.03',null,'Desconto concedido');
end $$;

-- ---------------------------------------------------------------------
-- PADRÃO B · DESPESA A PRAZO
-- ---------------------------------------------------------------------
create or replace function padrao_despesa(p_proc text, p_forn text default '2.1.1.02')
returns void language plpgsql as $$
begin
  perform r(p_proc,'emissao',1,'D','valor_total',null,'conta_lancamento','Despesa incorrida');
  perform r(p_proc,'emissao',2,'C','valor_total',p_forn,null,'Valor a pagar');
  perform r(p_proc,'baixa',1,'D','principal',p_forn,null,'Baixa do valor a pagar');
  perform r(p_proc,'baixa',2,'D','juros','6.2.01',null,'Juros pagos');
  perform r(p_proc,'baixa',3,'D','multa','6.2.02',null,'Multa paga');
  perform r(p_proc,'baixa',4,'C','desconto','6.1.03',null,'Desconto obtido');
  perform r(p_proc,'baixa',5,'C','liquido',null,'banco','Pagamento');
end $$;

-- ---------------------------------------------------------------------
-- PADRÃO C · CUSTO QUE VIRA ESTOQUE   ← a correção do erro nº 1
-- Material e mão de obra da obra NÃO são despesa do período: ficam no
-- ativo até a unidade ser vendida, e só então saem por 4.1.
-- ---------------------------------------------------------------------
create or replace function padrao_custo_estoque(p_proc text)
returns void language plpgsql as $$
begin
  perform r(p_proc,'emissao',1,'D','valor_total','1.1.3.01',null,'Custo apropriado à obra',
            'Vai ao ESTOQUE, não ao resultado — sai por 4.1 quando a unidade for vendida');
  perform r(p_proc,'emissao',2,'C','valor_total','2.1.1.01',null,'Fornecedor de obra');
  perform r(p_proc,'baixa',1,'D','principal','2.1.1.01',null,'Baixa do fornecedor');
  perform r(p_proc,'baixa',2,'D','juros','6.2.01',null,'Juros pagos');
  perform r(p_proc,'baixa',3,'D','multa','6.2.02',null,'Multa paga');
  perform r(p_proc,'baixa',4,'C','desconto','6.1.03',null,'Desconto obtido');
  perform r(p_proc,'baixa',5,'C','liquido',null,'banco','Pagamento ao fornecedor');
end $$;

commit;

-- =====================================================================
-- OS 25 PROCESSOS
-- Reprocessável: as regras são apagadas e reescritas a cada execução.
-- =====================================================================
begin;
delete from regra;

-- ---- receitas ----
-- Receita com conta FIXA: nestes o Base44 gravou no lançamento a conta de
-- clientes, não a de receita.
select padrao_receita('0001','1.1.2.01','3.1.1');   -- VENDAS DE IMÓVEIS
select padrao_receita('0037','1.1.2.03','3.1.2');   -- VENDA GERAL (produtos)
select padrao_receita('0034','1.1.2.02','3.3');     -- VENDA DE VEÍCULO
-- Aqui a conta do lançamento é de resultado e está correta (4.3.01/02/03)
select padrao_receita('0013','1.1.2.02');           -- OUTRAS RECEITAS (serviço)

-- ---- despesas a prazo ----
select padrao_despesa('0003');   -- COMISSÃO SOBRE VENDA DE IMÓVEIS
select padrao_despesa('0005');   -- DESPESAS COMERCIAIS
select padrao_despesa('0007');   -- DESPESAS FINANCEIRAS
select padrao_despesa('0009');   -- DESPESAS ADMINISTRATIVAS
select padrao_despesa('0019');   -- DESPESAS NÃO RECORRENTES

-- ---- custo de obra vira ESTOQUE (erro nº 1) ----
select padrao_custo_estoque('0011');   -- CUSTOS OBRA

-- ---- impostos sobre vendas: obrigação, depois pagamento ----
select r('0021','emissao',1,'D','valor_total',null,'conta_lancamento','Imposto sobre vendas apurado');
select r('0021','emissao',2,'C','valor_total','2.1.4.01',null,'Imposto a recolher');
select r('0021','baixa',1,'D','principal','2.1.4.01',null,'Recolhimento');
select r('0021','baixa',2,'D','juros','6.2.01',null,'Juros sobre imposto');
select r('0021','baixa',3,'D','multa','6.2.02',null,'Multa sobre imposto');
select r('0021','baixa',4,'C','liquido',null,'banco','Pagamento do imposto');

-- =====================================================================
-- EMPRÉSTIMOS E FINANCIAMENTOS
-- Estes não passam pelo resultado. Captar dinheiro é dívida, pagar
-- parcela é reduzir dívida — só o juro é despesa.
-- =====================================================================

-- 0015 · entrada de empréstimo: dinheiro entra, dívida nasce
select r('0015','baixa',1,'D','liquido',null,'banco','Crédito do empréstimo');
select r('0015','baixa',2,'C','principal','2.1.2.02',null,'Empréstimo a pagar',
         'A planilha lançava isto em Descontos e Devoluções, somando R$ 2.029.000,00 à receita');
select r('0015','baixa',3,'C','juros','6.1.01',null,'Juros a favor');
select r('0015','baixa',4,'D','desconto','6.2.03',null,'Desconto concedido');

-- 0017 · saída de empréstimo: dívida diminui
select r('0017','baixa',1,'D','principal','2.1.2.02',null,'Amortização do empréstimo');
select r('0017','baixa',2,'D','juros','6.2.01',null,'Juros pagos');
select r('0017','baixa',3,'D','multa','6.2.02',null,'Multa paga');
select r('0017','baixa',4,'C','liquido',null,'banco','Pagamento ao banco');

-- 0023 · ERA "DEPRECIAÇÕES E AMORTIZAÇÕES" — é amortização de FINANCIAMENTO.
-- São as parcelas da grua e do crédito Itapema: R$ 3.387.459,68 em 2026 que
-- estavam no resultado e pertencem ao passivo. A depreciação real da empresa
-- inteira é R$ 72.710,62 e tem contrapartida em 1.2.4, sem tocar no caixa.
select r('0023','baixa',1,'D','principal','2.1.2.01',null,'Amortização do financiamento',
         'Até virem os contratos, a parcela inteira entra como principal. Quando a planilha de amortização chegar, a parte de juros vai para 6.2.01 e só ela volta ao resultado');
select r('0023','baixa',2,'D','juros','6.2.01',null,'Juros do financiamento');
select r('0023','baixa',3,'D','multa','6.2.02',null,'Multa');
select r('0023','baixa',4,'C','liquido',null,'banco','Pagamento da parcela');

select r('0023','baixa',5,'C','desconto','6.1.03',null,'Desconto obtido na parcela');

-- 0025 · juros de financiamento pagos isoladamente
select r('0025','baixa',1,'D','principal','6.2.01',null,'Juros de financiamento');
select r('0025','baixa',2,'D','multa','6.2.02',null,'Multa');
select r('0025','baixa',3,'C','liquido',null,'banco','Pagamento dos juros');

select r('0025','baixa',4,'C','desconto','6.1.03',null,'Desconto obtido');

-- 0027 · juros recebidos de empréstimo concedido
select r('0027','baixa',1,'D','liquido',null,'banco','Recebimento de juros');
select r('0027','baixa',2,'C','principal','6.1.01',null,'Juros recebidos');

-- =====================================================================
-- MÚTUO ENTRE EMPRESAS DO GRUPO
-- Dinheiro entre empresas do mesmo grupo não é receita nem despesa de
-- ninguém: é crédito de um lado e dívida do outro.
-- =====================================================================
select r('0030','baixa',1,'D','liquido',null,'banco','Mútuo recebido');
select r('0030','baixa',2,'C','principal','2.1.6.01',null,'Mútuo a pagar ao grupo');

select r('0030','baixa',3,'C','multa','6.1.02',null,'Multa recebida no mútuo');
select r('0030','baixa',4,'D','desconto','6.2.03',null,'Desconto concedido no mútuo');

select r('0029','baixa',1,'D','principal','1.1.6.01',null,'Mútuo concedido ao grupo');
select r('0029','baixa',2,'C','liquido',null,'banco','Repasse ao grupo');

select r('0031','baixa',1,'D','liquido',null,'banco','Juros de mútuo recebidos');
select r('0031','baixa',2,'C','principal','6.1.04',null,'Receita financeira de mútuo');

select r('0032','baixa',1,'D','principal','6.2.05',null,'Despesa financeira de mútuo');
select r('0032','baixa',2,'C','liquido',null,'banco','Juros de mútuo pagos');

-- =====================================================================
-- IMOBILIZADO
-- =====================================================================
-- 0028 · compra de bem à vista: vira ativo, não despesa
select r('0028','emissao',1,'D','valor_total',null,'conta_lancamento','Aquisição de bem');
select r('0028','emissao',2,'C','valor_total','2.1.1.02',null,'A pagar pela aquisição');
select r('0028','baixa',1,'D','principal','2.1.1.02',null,'Baixa do valor a pagar');
select r('0028','baixa',2,'C','liquido',null,'banco','Pagamento do bem');

-- 0036 · compra de cota de capital: investimento
select r('0036','emissao',1,'D','valor_total','1.2.2.02',null,'Cota de capital');
select r('0036','emissao',2,'C','valor_total','2.1.1.02',null,'A pagar pela cota');
select r('0036','baixa',1,'D','principal','2.1.1.02',null,'Baixa do valor a pagar');
select r('0036','baixa',2,'C','liquido',null,'banco','Integralização');

-- 0033 · dação em pagamento: o cliente quita com um veículo
select r('0033','emissao',1,'D','valor_total','1.2.3.02',null,'Veículo recebido em dação');
select r('0033','emissao',2,'C','valor_total','1.1.2.01',null,'Quitação do cliente');

-- 0035 · baixa do bem vendido
select r('0035','emissao',1,'D','valor_total','1.2.4.02',null,'Depreciação acumulada baixada');
select r('0035','emissao',2,'C','valor_total','1.2.3.02',null,'Baixa do veículo');

-- =====================================================================
-- 0038 · CUSTO DE MERCADORIA VENDIDA
-- Na Simonetto a venda é SOB ENCOMENDA: fecha o pedido, compra da fábrica
-- já endereçada ao cliente. A mercadoria nunca passa pelo estoque, então
-- isto é compra a pagar que vai direto a CMV — não baixa de estoque.
-- A conta vem do lançamento e o de-para leva 5.2.01 a 4.3.
-- Quando houver venda de peça que ESTAVA em estoque (mostruário, loja de
-- decoração), a baixa D 4.3 / C 1.1.3.05 nasce do movimento de estoque,
-- não deste processo.
-- =====================================================================
select padrao_despesa('0038');

commit;

-- Conferência: processo cujas baixas usam um componente sem regra gera
-- partida que não fecha. Esta consulta tem de voltar VAZIA.
select p.codigo, p.nome, x.componente as componente_sem_regra
  from processo p
  cross join lateral (values ('juros'),('multa'),('desconto')) as x(componente)
 where exists (
   select 1 from baixa b join parcela pa on pa.id = b.parcela_id
     join lancamento l on l.id = pa.lancamento_id
    where l.processo_id = p.id and b.estornada_em is null and b.estorno_de_id is null
      and l.status = 'ativo'
      and case x.componente when 'juros' then b.juros when 'multa' then b.multa
                            else b.desconto end > 0)
   and exists (select 1 from regra g where g.processo_id = p.id and g.evento = 'baixa')
   and not exists (select 1 from regra g where g.processo_id = p.id
                     and g.evento = 'baixa' and g.componente = x.componente)
 order by p.codigo, x.componente;

-- conferência: todo processo com regra fecha em débito = crédito?
select p.codigo, left(p.nome,34) processo,
       count(*) filter (where g.evento='emissao') emissao,
       count(*) filter (where g.evento='baixa') baixa
  from processo p left join regra g on g.processo_id = p.id
 group by p.id, p.codigo, p.nome
 order by p.codigo;
