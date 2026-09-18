-- =====================================================================
-- TESTES — cada caso reproduz um erro real encontrado no Base44
-- e verifica se o banco novo o recusa.
-- =====================================================================
-- ==================================================================
-- GUARDA: estes testes criam massa própria e usam ids fixos. Rodar
-- contra um banco com dados migrados insere lixo em registros reais.
-- Use `bash testes/banco.sh`, que cria um banco descartável.
-- ==================================================================
\set ON_ERROR_STOP on
do $guarda$
begin
  if exists (select 1 from lancamento limit 1) then
    raise exception E'ABORTADO: este banco já tem lançamentos.\nEstes testes só rodam em banco vazio — use: bash testes/banco.sh';
  end if;
end $guarda$;

\set ON_ERROR_STOP off
\pset pager off

-- massa mínima
insert into empresa (codigo, cnpj, razao_social, tipo) values
  (1, '00000000000191', 'Construtora Silvereng Ltda', 'operacional');
insert into plano_conta (codigo, descricao, grupo, natureza, aceita_lancamento) values
  ('1',        'ATIVO',                      1, 'devedora', false),
  ('1.1.1.02', 'BANCO SICOOB - ADMINISTRATIVO', 1, 'devedora', true),
  ('1.1.2.01', 'CLIENTES A RECEBER',         1, 'devedora', true),
  ('4.1.01',   'VENDA DE IMÓVEIS',           4, 'credora',  true),
  ('4.2.01',   'JUROS RECEBIDOS',            4, 'credora',  true),
  ('6.3.03',   'DESCONTOS CONCEDIDOS',       6, 'devedora', true);
insert into conta_bancaria (empresa_id, apelido, instituicao, agencia, numero_conta, conta_contabil_id)
  values (1, 'Sicoob Administrativo', 'BANCO SICOOB', '3031', '847674',
          (select id from plano_conta where codigo='1.1.1.02'));
insert into processo (codigo, nome, tipo) values ('0001','VENDA DE IMÓVEIS','venda');

create or replace function testar(rotulo text, sql_texto text, espera_falha boolean)
returns void language plpgsql as $$
begin
  begin
    execute sql_texto;
    -- constraints DEFERRED só disparam no commit; forçamos aqui para que
    -- a falha aconteça dentro deste bloco e possa ser capturada.
    set constraints all immediate;
    set constraints all deferred;
    if espera_falha then raise notice '  FALHOU  % — deveria ter sido recusado, mas passou', rotulo;
    else                 raise notice '  ok      %', rotulo;
    end if;
  exception when others then
    if espera_falha then raise notice '  ok      % — recusado: %', rotulo, left(SQLERRM, 76);
    else                 raise notice '  FALHOU  % — recusou indevidamente: %', rotulo, left(SQLERRM, 60);
    end if;
  end;
end $$;

\echo ''
\echo '=== LIVRO CONTÁBIL ==='

-- 1. partida que fecha: tem de passar
select testar('partida equilibrada (1000 D / 1000 C)', $$
  with lc as (
    insert into lancamento_contabil (empresa_id, data, historico, origem_tipo, origem_id)
    values (1, '2026-01-10', 'Venda à vista', 'manual', null) returning id)
  insert into partida (lancamento_contabil_id, ordem, lado, conta_id, valor)
  select lc.id, x.ordem, x.lado,
         (select id from plano_conta where codigo = x.cod), x.valor
    from lc, (values (1,'D','1.1.1.02',1000.00), (2,'C','4.1.01',1000.00))
              as x(ordem, lado, cod, valor);
$$, false);

-- 2. PERNA SOLTA — o erro recorrente do Base44
select testar('perna solta (débito sem contrapartida)', $$
  with lc as (
    insert into lancamento_contabil (empresa_id, data, historico, origem_tipo, origem_id)
    values (1, '2026-01-10', 'Estorno com perna solta', 'manual', null) returning id)
  insert into partida (lancamento_contabil_id, ordem, lado, conta_id, valor)
  select lc.id, 1, 'D', (select id from plano_conta where codigo='1.1.1.02'), 3000.00 from lc;
$$, true);

-- 3. débito duplicado — o caso exato dos R$ 3.000 da Silvereng
select testar('débito duplicado (2x3000 D contra 1x3000 C)', $$
  with lc as (
    insert into lancamento_contabil (empresa_id, data, historico, origem_tipo, origem_id)
    values (1, '2026-05-30', 'ESTORNO à vista', 'manual', null) returning id)
  insert into partida (lancamento_contabil_id, ordem, lado, conta_id, valor)
  select lc.id, x.ordem, x.lado, (select id from plano_conta where codigo = x.cod), x.valor
    from lc, (values (1,'D','1.1.1.02',3000.00),(2,'D','1.1.1.02',3000.00),(3,'C','6.3.03',3000.00))
              as x(ordem, lado, cod, valor);
$$, true);

-- 4. lançamento em conta sintética
select testar('partida em conta sintética (grupo 1)', $$
  with lc as (
    insert into lancamento_contabil (empresa_id, data, historico, origem_tipo, origem_id)
    values (1, '2026-01-10', 'Lançamento em sintética', 'manual', null) returning id)
  insert into partida (lancamento_contabil_id, ordem, lado, conta_id, valor)
  select lc.id, x.ordem, x.lado, (select id from plano_conta where codigo = x.cod), x.valor
    from lc, (values (1,'D','1',500.00),(2,'C','4.1.01',500.00)) as x(ordem, lado, cod, valor);
$$, true);

-- 5. lançamento contábil sem nenhuma partida
select testar('lançamento contábil sem partidas', $$
  insert into lancamento_contabil (empresa_id, data, historico, origem_tipo, origem_id)
  values (1, '2026-01-10', 'Cabeçalho órfão', 'manual', null);
$$, true);

-- 6. baixa com juros: caixa recebe o líquido e tudo fecha
select testar('baixa com juros (900 principal + 100 juros)', $$
  with lc as (
    insert into lancamento_contabil (empresa_id, data, historico, origem_tipo, origem_id)
    values (1, '2026-02-15', 'Baixa com juros', 'manual', null) returning id)
  insert into partida (lancamento_contabil_id, ordem, lado, conta_id, valor)
  select lc.id, x.ordem, x.lado, (select id from plano_conta where codigo = x.cod), x.valor
    from lc, (values (1,'D','1.1.1.02',1000.00),
                     (2,'C','1.1.2.01', 900.00),
                     (3,'C','4.2.01',   100.00)) as x(ordem, lado, cod, valor);
$$, false);

-- 7. o erro do Base44: juros recebido que não entra no caixa
select testar('juros que não chega ao caixa (o erro real)', $$
  with lc as (
    insert into lancamento_contabil (empresa_id, data, historico, origem_tipo, origem_id)
    values (1, '2026-02-15', 'Baixa esquecendo o juros', 'manual', null) returning id)
  insert into partida (lancamento_contabil_id, ordem, lado, conta_id, valor)
  select lc.id, x.ordem, x.lado, (select id from plano_conta where codigo = x.cod), x.valor
    from lc, (values (1,'D','1.1.1.02', 900.00),
                     (2,'C','1.1.2.01', 900.00),
                     (3,'C','4.2.01',   100.00)) as x(ordem, lado, cod, valor);
$$, true);

\echo ''
\echo '=== LIVRO FINANCEIRO ==='

insert into pessoa (nome_razao_social, eh_cliente) values ('CLIENTE TESTE', true);
insert into lancamento (numero, empresa_id, processo_id, tipo, pessoa_id, data_competencia, valor_total, descricao)
  values ('LAN-TESTE-1', 1, 1, 'receita', 1, '2026-01-05', 10000.00, 'Venda de imóvel');

select testar('parcelas que somam o lançamento (4 x 2500)', $$
  insert into parcela (lancamento_id, numero, tipo, pessoa_id, data_vencimento, valor_original)
  select 1, n, 'receber', 1, date '2026-02-05' + (n * interval '1 month'), 2500.00
    from generate_series(1,4) n;
$$, false);

select testar('parcelas que NÃO somam o lançamento', $$
  insert into lancamento (numero, empresa_id, processo_id, tipo, pessoa_id, data_competencia, valor_total, descricao)
    values ('LAN-TESTE-2', 1, 1, 'receita', 1, '2026-01-05', 10000.00, 'Venda torta');
  insert into parcela (lancamento_id, numero, tipo, pessoa_id, data_vencimento, valor_original)
    values (currval(pg_get_serial_sequence('lancamento','id')), 1, 'receber', 1, '2026-02-05', 7000.00);
$$, true);

select testar('desconto maior que o valor da parcela', $$
  insert into baixa (parcela_id, conta_bancaria_id, data_liquidacao, valor_principal, desconto)
  values (1, 1, '2026-02-05', 2500.00, 3000.00);
$$, true);

\echo ''
\echo '=== valor_liquido é calculado pelo banco ==='
insert into baixa (parcela_id, conta_bancaria_id, data_liquidacao, valor_principal, juros, multa, desconto)
  values (1, 1, '2026-02-10', 2500.00, 52.55, 0, 100.00);
select valor_principal as principal, juros, desconto, valor_liquido as "líquido (calculado)"
  from baixa where parcela_id = 1;

\echo ''
\echo '=== status da parcela é mantido pelo banco ==='
select numero, valor_original, valor_baixado, status from parcela where lancamento_id = 1 order by numero;

\echo ''
\echo '=== ESTOQUE ==='

-- massa: um grupo contado e um grupo de peça única
insert into item_grupo (codigo, nome, tipo, controle) values
  ('T-QTD', 'TESTE POR QUANTIDADE', 'produto', 'quantidade'),
  ('T-UNI', 'TESTE PECA UNICA',     'produto', 'unidade');
insert into item (empresa_id, grupo_id, identificacao, unidade)
  values (1, (select id from item_grupo where codigo='T-QTD'), 'CIMENTO CP II', 'SC');
insert into item (empresa_id, grupo_id, identificacao)
  values (1, (select id from item_grupo where codigo='T-UNI'), 'SOFA MOSTRUARIO');

select testar('entrada de 50 SC a 38,90', $$
  insert into movimento_estoque (item_id, tipo, data, quantidade, valor_unitario, historico)
  values ((select id from item where identificacao='CIMENTO CP II'),
          'entrada', '2026-01-10', 50, 38.90, 'COMPRA NF 1234');
$$, false);

-- o erro que isto impede: dar baixa de mais do que existe e o saldo virar
-- negativo sem ninguém perceber
select testar('saída maior que o saldo (80 de 50)', $$
  insert into movimento_estoque (item_id, tipo, data, quantidade, historico)
  values ((select id from item where identificacao='CIMENTO CP II'),
          'saida', '2026-01-11', 80, 'CONSUMO ALEM DO SALDO');
$$, true);

select testar('movimento sem histórico', $$
  insert into movimento_estoque (item_id, tipo, data, quantidade, historico)
  values ((select id from item where identificacao='CIMENTO CP II'), 'saida', '2026-01-11', 1, ' ');
$$, true);

\echo ''
\echo '=== saldo e custo médio são calculados pelo banco ==='
insert into movimento_estoque (item_id, tipo, data, quantidade, valor_unitario, historico)
  values ((select id from item where identificacao='CIMENTO CP II'),
          'saida', '2026-01-12', 20, 38.90, 'CONSUMO NA OBRA');
select identificacao, quantidade as saldo, custo_unitario as "custo médio",
       (quantidade * custo_unitario) as "valor em estoque"
  from item where identificacao = 'CIMENTO CP II';

\echo ''
\echo '=== estorno devolve o saldo ==='
update movimento_estoque set estornado_em = now()
 where item_id = (select id from item where identificacao='CIMENTO CP II')
   and tipo = 'saida';
select identificacao, quantidade as "saldo após estorno" from item where identificacao = 'CIMENTO CP II';

\echo ''
\echo '=== peça única: vender zera o saldo, o custo fica ==='
insert into movimento_estoque (item_id, tipo, data, quantidade, valor_unitario, historico)
  values ((select id from item where identificacao='SOFA MOSTRUARIO'),
          'entrada', '2026-01-10', 1, 5200.00, 'AQUISICAO DA PECA DE MOSTRUARIO');
select identificacao, status, quantidade as saldo, custo_unitario as custo
  from item where identificacao = 'SOFA MOSTRUARIO';
update item set status = 'vendido' where identificacao = 'SOFA MOSTRUARIO';
select identificacao, status, quantidade as saldo, custo_unitario as "custo (vira CMV)"
  from item where identificacao = 'SOFA MOSTRUARIO';
