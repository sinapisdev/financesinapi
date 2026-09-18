-- =====================================================================
-- 05 — ESTOQUE E RAMO DE NEGÓCIO
-- Migração: altera o que já existe, não recria. Pode rodar sobre o banco
-- carregado (roda em ordem, 01→05, num banco novo também).
--
-- O sistema deixa de ser "o ERP da construtora" e passa a atender qualquer
-- negócio do grupo. Três realidades diferentes de estoque convivem aqui:
--   · imóvel      — peça única, rastreada por identidade e situação
--   · mercadoria  — fungível, rastreada por saldo
--   · sob encomenda — nunca estoca (a Simoneto vende e só então compra)
-- Um modelo que só soubesse contar quantidade não caberia nas outras duas.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- RAMO DE ATIVIDADE
-- `tipo` continua sendo estrutura societária (SPE, holding) — é isso que
-- importa para consolidação e apuração. Ramo é o que a empresa FAZ, e são
-- dois eixos independentes: uma operacional pode ser varejo ou serviços.
-- Enfiar 'varejo' em `tipo` misturaria as duas coisas e quebraria quem lê
-- `tipo = 'spe'` para decidir contabilização.
-- ---------------------------------------------------------------------
create table ramo (
  codigo    text primary key,
  nome      text not null,
  ordem     smallint not null
);
insert into ramo (codigo, nome, ordem) values
  ('construcao',    'Construção civil',       1),
  ('incorporacao',  'Incorporação (SPE)',     2),
  ('imobiliaria',   'Compra e venda de imóveis', 3),
  ('varejo',        'Comércio / varejo',      4),
  ('servicos',      'Serviços',               5),
  ('financeiro',    'Serviços financeiros',   6),
  ('agro',          'Agropecuária',           7),
  ('holding',       'Holding / patrimonial',  8),
  ('outro',         'Outro',                  9);

alter table empresa add column ramo text references ramo(codigo);
comment on column empresa.tipo is 'Estrutura societária: SPE = sociedade de propósito específico (uma por empreendimento)';
comment on column empresa.ramo is 'Atividade da empresa. Define quais processos e grupos de item aparecem.';

-- DOMUS LTDA é a SIMONETTO GUARAPUAVA, loja de móveis — não dá para adivinhar
-- pela razão social. A prova está nos lançamentos dela: "PEDIDO 560101" em
-- 5.2.01 CMV e mensalidade do PROMOB, software de projeto de móveis.
update empresa set ramo = case
  when tipo = 'spe' then 'incorporacao'
  when razao_social ilike '%CONSTRUTORA%' then 'construcao'
  when nome_fantasia ilike '%SIMONETTO%' then 'varejo'
  else 'outro' end;
alter table empresa alter column ramo set not null;
alter table empresa alter column ramo set default 'outro';

-- ---------------------------------------------------------------------
-- PROCESSO × RAMO
-- Os 25 processos valiam para todas as empresas. "VENDA GERAL" e "CMV" já
-- existiam sem uso — são de varejo e não fazem sentido numa SPE, assim como
-- "CUSTOS OBRA" não faz sentido numa loja.
-- SEM LINHA AQUI = processo universal. Assim nada do que já funciona muda:
-- só restringe quem for explicitamente restrito.
-- ---------------------------------------------------------------------
create table processo_ramo (
  processo_id bigint not null references processo(id) on delete cascade,
  ramo        text   not null references ramo(codigo),
  primary key (processo_id, ramo)
);

insert into processo_ramo (processo_id, ramo)
select p.id, r.ramo from processo p
  join (values
    ('0001', 'construcao'),('0001','incorporacao'),('0001','imobiliaria'),
    ('0003', 'construcao'),('0003','incorporacao'),('0003','imobiliaria'),
    ('0011', 'construcao'),('0011','incorporacao'),
    ('0037', 'varejo'),('0037','servicos'),('0037','agro'),
    ('0038', 'varejo'),('0038','agro')
  ) as r(codigo, ramo) on r.codigo = p.codigo;

-- ---------------------------------------------------------------------
-- GRUPO DE ITEM
-- É aqui que estoque encosta na contabilidade: o grupo carrega as contas, e
-- não o item. Trocar a conta de estoque de "imóveis prontos" é uma linha, não
-- uma varredura. Também é o que permite o mesmo sistema atender ramos com
-- planos diferentes — cada grupo aponta para as suas contas.
-- ---------------------------------------------------------------------
create table item_grupo (
  id                bigint generated always as identity primary key,
  codigo            text        not null unique,
  nome              text        not null,
  tipo              text        not null default 'produto'
                    check (tipo in ('imovel','produto','servico','outro')),
  -- unidade   : peça única; o saldo vem da SITUAÇÃO (1 enquanto não vendida)
  -- quantidade: fungível;   o saldo vem dos MOVIMENTOS
  -- nenhum    : não estoca (serviço, venda sob encomenda)
  controle          text        not null default 'quantidade'
                    check (controle in ('unidade','quantidade','nenhum')),
  conta_estoque_id  bigint      references plano_conta(id),
  conta_receita_id  bigint      references plano_conta(id),
  conta_custo_id    bigint      references plano_conta(id),
  ativo             boolean     not null default true,
  observacao        text,
  criado_em         timestamptz not null default now()
);
comment on table item_grupo is 'Classe de item; carrega as contas contábeis de estoque, receita e custo.';

-- Grupos semeados a partir das contas QUE JÁ EXISTEM no plano. Onde o plano
-- ainda não tem conta (mercadoria de revenda, receita de serviço), o campo
-- fica NULO de propósito e a tela sinaliza a pendência — mexer no plano de
-- contas ficou para a reestruturação contábil.
insert into item_grupo (codigo, nome, tipo, controle,
                        conta_estoque_id, conta_receita_id, conta_custo_id, observacao)
select g.codigo, g.nome, g.tipo, g.controle,
       (select id from plano_conta where codigo = g.c_est),
       (select id from plano_conta where codigo = g.c_rec),
       (select id from plano_conta where codigo = g.c_cus),
       g.obs
from (values
  ('IMOV-PRONTO', 'IMÓVEIS CONCLUÍDOS PARA VENDA', 'imovel',  'unidade',
   '1.1.3.02', '4.1.01', '5.2.01', null),
  ('IMOV-OBRA',   'IMÓVEIS EM CONSTRUÇÃO',         'imovel',  'unidade',
   '1.2.1.01', '4.1.01', '5.2.01',
   'O custo da obra deveria acumular aqui em vez de ir para resultado — ver diagnóstico contábil.'),
  ('TERRENO',     'TERRENOS',                      'imovel',  'unidade',
   '1.2.1.02', '4.1.01', '5.1.05', null),
  ('MAT-CONSTR',  'MATERIAIS DE CONSTRUÇÃO',       'produto', 'quantidade',
   '1.1.3.01', null,     '5.1.01', null),
  ('MERCADORIA',  'MERCADORIAS PARA REVENDA',      'produto', 'quantidade',
   null,       '4.1.02', '5.2.01',
   'Falta conta de estoque de mercadorias no plano (só existe 1.1.3.01, de materiais de construção).'),
  ('MOSTRUARIO',  'MOSTRUÁRIO / SHOWROOM',         'produto', 'unidade',
   null,       '4.1.02', '5.2.01',
   'Peça exposta; sai do mostruário quando vendida. Falta conta de estoque própria no plano.'),
  ('SOB-ENCOMENDA','VENDA SOB ENCOMENDA',          'produto', 'nenhum',
   null,       '4.1.02', '5.2.01',
   'Não estoca: compra-se da fábrica já para o cliente. Entra direto em CMV.'),
  ('SERVICO',     'SERVIÇOS',                      'servico', 'nenhum',
   null,       null,     null,
   'Falta conta de receita de serviços no plano.')
) as g(codigo, nome, tipo, controle, c_est, c_rec, c_cus, obs);

-- Mesma regra do processo: SEM LINHA = grupo universal. Um grupo pode servir a
-- vários ramos (imóvel serve construtora, incorporadora e imobiliária), e é por
-- isso que isto é tabela e não coluna.
create table item_grupo_ramo (
  grupo_id bigint not null references item_grupo(id) on delete cascade,
  ramo     text   not null references ramo(codigo),
  primary key (grupo_id, ramo)
);

insert into item_grupo_ramo (grupo_id, ramo)
select g.id, r.ramo from item_grupo g
  join (values
    ('IMOV-PRONTO','construcao'),('IMOV-PRONTO','incorporacao'),('IMOV-PRONTO','imobiliaria'),
    ('IMOV-OBRA',  'construcao'),('IMOV-OBRA',  'incorporacao'),('IMOV-OBRA',  'imobiliaria'),
    ('TERRENO',    'construcao'),('TERRENO',    'incorporacao'),('TERRENO',    'imobiliaria'),
    ('MAT-CONSTR', 'construcao'),('MAT-CONSTR', 'incorporacao'),
    ('MERCADORIA', 'varejo'),('MERCADORIA','agro'),
    ('MOSTRUARIO', 'varejo'),
    ('SOB-ENCOMENDA','varejo')
  ) as r(codigo, ramo) on r.codigo = g.codigo;

-- ---------------------------------------------------------------------
-- ITEM  (era `imovel`)
-- Renomear preserva as 5 linhas e a FK de lancamento. "Imóvel" era o caso
-- particular; item é o geral — o que a empresa tem para vender.
-- ---------------------------------------------------------------------
alter table imovel rename to item;
alter table lancamento rename column imovel_id to item_id;
alter index imovel_centro_idx rename to item_centro_idx;

alter table item rename column valor_tabela to preco_venda;
alter table item
  add column empresa_id   bigint  references empresa(id),
  add column grupo_id     bigint  references item_grupo(id),
  add column codigo       text,
  add column descricao    text,
  add column unidade      text    not null default 'UN',
  add column quantidade   numeric(15,4) not null default 0,   -- mantido por trigger
  add column quantidade_minima numeric(15,4),
  add column custo_unitario numeric(15,4) not null default 0, -- mantido por trigger
  add column localizacao  text,
  -- Loja de decoração compra com EAN do fornecedor. É diferente do código
  -- interno: o EAN vem na caixa e é o que o leitor lê na entrada da nota.
  add column codigo_barras text,
  add column pessoa_id    bigint  references pessoa(id),
  add column data_entrada date,
  add column data_saida   date,
  add column observacao   text,
  add column ativo        boolean not null default true;
comment on column item.identificacao is 'Rótulo principal: "APTO 101" ou "SOFÁ RETRÁTIL 3 LUGARES"';
comment on column item.pessoa_id is 'Para quem está reservado ou a quem foi vendido';
comment on column item.quantidade is 'Saldo. Vem da situação (controle=unidade) ou dos movimentos (quantidade).';

alter table item drop constraint imovel_centro_custo_id_identificacao_key;
create unique index item_codigo_uk on item (empresa_id, codigo) where codigo is not null;
create unique index item_ean_uk on item (empresa_id, codigo_barras) where codigo_barras is not null;
create index item_grupo_idx   on item (grupo_id);
create index item_empresa_idx on item (empresa_id);

-- situação: as de imóvel continuam valendo; sob encomenda e baixa são novas
alter table item drop constraint imovel_status_check;
alter table item add constraint item_status_check check (status in
  ('disponivel','reservado','vendido','permutado','cancelado','sob_encomenda','baixado'));

-- as 5 linhas que vieram do Base44 ganham empresa e grupo
update item i set
  empresa_id = cc.empresa_id,
  grupo_id   = (select id from item_grupo where codigo =
                 case when i.identificacao ilike 'TERRENO%' then 'TERRENO' else 'IMOV-OBRA' end)
  from centro_custo cc where cc.id = i.centro_custo_id;
update item set
  empresa_id = (select id from empresa where codigo = 1),
  grupo_id   = (select id from item_grupo where codigo = 'TERRENO')
  where empresa_id is null;
alter table item alter column empresa_id set not null;
alter table item alter column grupo_id   set not null;

-- ---------------------------------------------------------------------
-- MOVIMENTO DE ESTOQUE
-- Sem isto, estoque é uma lista — não dá para provar saldo nem custo.
-- `lancamento_id` é o que amarra a compra do material à entrada da peça: é
-- por aqui que o custo de obra vai virar estoque na reestruturação contábil.
-- ---------------------------------------------------------------------
create table movimento_estoque (
  id              bigint generated always as identity primary key,
  item_id         bigint      not null references item(id) on delete restrict,
  tipo            text        not null check (tipo in
                  ('entrada','saida','ajuste_entrada','ajuste_saida')),
  data            date        not null,
  quantidade      numeric(15,4) not null check (quantidade > 0),
  valor_unitario  numeric(15,4) not null default 0 check (valor_unitario >= 0),
  valor_total     numeric(15,2) generated always as
                  (round(quantidade * valor_unitario, 2)) stored,
  lancamento_id   bigint      references lancamento(id),
  centro_custo_id bigint      references centro_custo(id),
  pessoa_id       bigint      references pessoa(id),
  documento       text,
  historico       text        not null
                  constraint movimento_historico_precisa_dizer_algo
                  check (length(trim(historico)) >= 3),
  estornado_em    timestamptz,
  criado_por      text,
  criado_em       timestamptz not null default now()
);
create index movimento_item_idx on movimento_estoque (item_id, data);
create index movimento_lanc_idx on movimento_estoque (lancamento_id);

-- ---------------------------------------------------------------------
-- Saldo e custo são DERIVADOS: o banco recalcula, ninguém digita.
-- Recalcular do zero em vez de somar/subtrair incrementalmente — assim
-- estorno, edição e exclusão caem no mesmo caminho e não há como o saldo
-- divergir do que os movimentos dizem.
-- ---------------------------------------------------------------------
create or replace function recalcula_item(p_item bigint) returns void
language plpgsql as $$
declare
  v_controle text;
  v_status   text;
  v_qtd      numeric(15,4);
  v_custo    numeric(15,4);
begin
  select g.controle, i.status into v_controle, v_status
    from item i join item_grupo g on g.id = i.grupo_id where i.id = p_item;
  if not found then return; end if;

  select coalesce(sum(case when tipo in ('entrada','ajuste_entrada')
                           then quantidade else -quantidade end), 0),
         -- custo médio das ENTRADAS. Não é PEPS: é o que dá para sustentar
         -- sem controlar lote, e não muda quando se vende.
         coalesce((select sum(quantidade * valor_unitario) / nullif(sum(quantidade), 0)
                     from movimento_estoque
                    where item_id = p_item and estornado_em is null
                      and tipo in ('entrada','ajuste_entrada')), 0)
    into v_qtd, v_custo
    from movimento_estoque where item_id = p_item and estornado_em is null;

  if v_controle = 'unidade' then
    -- peça única: existir ou não existir é questão de situação, não de soma
    v_qtd := case when v_status in ('disponivel','reservado','sob_encomenda') then 1 else 0 end;
    -- e o custo é tudo o que entrou nela (a obra inteira, no caso do imóvel)
    select coalesce(sum(case when tipo in ('entrada','ajuste_entrada')
                             then valor_total else -valor_total end), 0)
      into v_custo from movimento_estoque
     where item_id = p_item and estornado_em is null;
  elsif v_controle = 'nenhum' then
    v_qtd := 0;
  end if;

  update item set quantidade = v_qtd, custo_unitario = v_custo, atualizado_em = now()
   where id = p_item;

  if v_controle = 'quantidade' and v_qtd < 0 then
    raise exception 'Saldo insuficiente em "%": faltam % % para este movimento.',
      (select identificacao from item where id = p_item),
      trim(to_char(-v_qtd, 'FM999999990.####')),
      (select unidade from item where id = p_item)
      using hint = 'Registre a entrada antes da saída, ou reveja a quantidade.';
  end if;
end $$;

create or replace function movimento_recalcula() returns trigger
language plpgsql as $$
begin
  if TG_OP <> 'INSERT' and OLD.item_id is distinct from
     (case when TG_OP = 'DELETE' then null else NEW.item_id end) then
    perform recalcula_item(OLD.item_id);
  end if;
  perform recalcula_item(case when TG_OP = 'DELETE' then OLD.item_id else NEW.item_id end);
  return null;
end $$;

create trigger movimento_estoque_saldo
  after insert or update or delete on movimento_estoque
  for each row execute function movimento_recalcula();

-- mudar a situação de uma peça única muda o saldo dela
create or replace function item_status_recalcula() returns trigger
language plpgsql as $$
begin
  if NEW.status is distinct from OLD.status or NEW.grupo_id is distinct from OLD.grupo_id then
    perform recalcula_item(NEW.id);
  end if;
  return null;
end $$;

create trigger item_saldo_por_status
  after update on item
  for each row execute function item_status_recalcula();

-- Os "imóveis" da loja de móveis não são estoque: são os projetos de móveis de
-- cada cliente, que já existem como centro de custo. Vieram da entidade Imoveis
-- do Base44, nenhum lançamento aponta para eles. Ficam inativos, nunca apagados.
update item set ativo = false,
       observacao = 'VEIO DA ENTIDADE IMOVEIS DO BASE44 MAS NAO E ESTOQUE: '
                 || 'E O PROJETO DE MOVEIS DO CLIENTE, QUE JA EXISTE COMO CENTRO DE CUSTO'
 where empresa_id in (select id from empresa where ramo = 'varejo');

-- alinha as linhas que já existiam
do $$ declare r record; begin
  for r in select id from item loop perform recalcula_item(r.id); end loop;
end $$;

commit;
