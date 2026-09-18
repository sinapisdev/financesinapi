-- =====================================================================
-- 03 — LIVRO CONTÁBIL (derivado)
-- Nada aqui é digitado: tudo é GERADO a partir do livro financeiro.
-- Corrigiu a regra? Reprocessa e o histórico inteiro se ajusta.
-- =====================================================================

create table plano_conta (
  id                bigint generated always as identity primary key,
  codigo            text        not null unique,
  descricao         text        not null,
  conta_pai_id      bigint      references plano_conta(id),
  grupo             smallint    not null check (grupo between 1 and 6),
  natureza          text        not null check (natureza in ('devedora','credora')),
  aceita_lancamento boolean     not null,
  ativo             boolean     not null default true,
  observacao        text,
  base44_id         text        unique,
  criado_em         timestamptz not null default now(),
  -- permite a FK composta que bloqueia lançamento em conta sintética
  unique (id, aceita_lancamento)
);
comment on column plano_conta.grupo is '1 Ativo · 2 Passivo · 3 PL · 4 Receitas · 5 Custos · 6 Despesas';

create table processo (
  id          bigint generated always as identity primary key,
  codigo      text        not null unique,
  nome        text        not null,
  tipo        text        not null check (tipo in ('receita','despesa','venda','compra','transferencia','ajuste')),
  -- contas que o processo usa, vindas do Base44. Quando apontam para conta
  -- SINTÉTICA (6.1, 5.1, 4.3...), quem lança escolhe a analítica de fato.
  conta_debito_id   bigint references plano_conta(id),
  conta_credito_id  bigint references plano_conta(id),
  ativo       boolean     not null default true,
  observacao  text,
  base44_id   text        unique,
  criado_em   timestamptz not null default now()
);

alter table lancamento
  add constraint lancamento_processo_fk foreign key (processo_id) references processo(id);

-- só conta analítica pode ser escolhida num lançamento
alter table lancamento add column aceita_lancamento boolean not null default true;
alter table lancamento add constraint lancamento_conta_analitica
  foreign key (conta_id, aceita_lancamento) references plano_conta (id, aceita_lancamento);

-- As regras de contabilização como LINHAS.
-- No Base44 isso são 35 colunas fixas num único registro, o que obriga a
-- inventar coluna nova a cada caso (conta_debito_juros, conta_credito_multa,
-- conta_debito_transitoria...) e ainda assim não cobre tudo.
create table regra_partida (
  id                 bigint generated always as identity primary key,
  processo_id        bigint   not null references processo(id) on delete cascade,
  evento             text     not null check (evento in ('emissao','baixa')),
  ordem              smallint not null,
  lado               char(1)  not null check (lado in ('D','C')),
  -- de qual parte do valor esta partida trata
  componente         text     not null check (componente in
                     ('valor_total','principal','juros','multa','desconto','liquido')),
  -- conta fixa OU resolvida em tempo de execução
  conta_id           bigint   references plano_conta(id),
  conta_dinamica     text     check (conta_dinamica in ('conta_bancaria','pessoa_cliente','pessoa_fornecedor')),
  condicao           text     check (condicao in ('a_vista','a_prazo')),
  historico_template text     not null,
  ativo              boolean  not null default true,
  constraint conta_fixa_ou_dinamica check (
    (conta_id is not null and conta_dinamica is null) or
    (conta_id is null     and conta_dinamica is not null)),
  unique (processo_id, evento, ordem)
);

-- Cada conta bancária tem sua própria conta contábil: conciliação banco a banco.
alter table conta_bancaria
  add column conta_contabil_id bigint references plano_conta(id);

-- ---------------------------------------------------------------------
-- Livro razão
-- ---------------------------------------------------------------------

create table lancamento_contabil (
  id            bigint generated always as identity primary key,
  empresa_id    bigint      not null references empresa(id),
  processo_id   bigint      references processo(id),
  data          date        not null,
  historico     text        not null,
  origem_tipo   text        not null check (origem_tipo in ('lancamento','baixa','transferencia','manual')),
  origem_id     bigint,
  estorno_de_id bigint      references lancamento_contabil(id),
  gerado_em     timestamptz not null default now(),
  gerado_por    text
);
-- Idempotência: reprocessar não duplica.
create unique index lancamento_contabil_origem_uk
  on lancamento_contabil (origem_tipo, origem_id)
  where estorno_de_id is null and origem_tipo <> 'manual';

create table partida (
  id                     bigint generated always as identity primary key,
  lancamento_contabil_id bigint      not null
                         references lancamento_contabil(id) on delete cascade,
  ordem                  smallint    not null,
  lado                   char(1)     not null check (lado in ('D','C')),
  conta_id               bigint      not null,
  valor                  numeric(15,2) not null check (valor > 0),
  centro_custo_id        bigint      references centro_custo(id),
  pessoa_id              bigint      references pessoa(id),
  historico              text,
  -- literal true + FK composta = o banco recusa partida em conta sintética
  aceita_lancamento      boolean     not null default true check (aceita_lancamento),
  foreign key (conta_id, aceita_lancamento) references plano_conta (id, aceita_lancamento),
  unique (lancamento_contabil_id, ordem)
);

-- =====================================================================
-- A TRAVA
-- Verificada no COMMIT, não a cada linha — as pernas podem ser inseridas
-- em qualquer ordem, mas a transação inteira é recusada se não fechar.
-- É isto que torna "perna solta" impossível, em vez de apenas corrigível.
-- =====================================================================
create or replace function valida_partida_dobrada() returns trigger
language plpgsql as $$
declare
  v_id      bigint;
  v_debito  numeric(15,2);
  v_credito numeric(15,2);
  v_linhas  integer;
begin
  -- A mesma função serve às duas tabelas; o nome da chave muda em cada uma.
  if TG_TABLE_NAME = 'lancamento_contabil' then
    v_id := case when TG_OP = 'DELETE' then OLD.id else NEW.id end;
  else
    v_id := case when TG_OP = 'DELETE' then OLD.lancamento_contabil_id
                 else NEW.lancamento_contabil_id end;
  end if;

  -- cabeçalho apagado no meio da transação: nada a validar
  if not exists (select 1 from lancamento_contabil where id = v_id) then
    return null;
  end if;

  select coalesce(sum(valor) filter (where lado = 'D'), 0),
         coalesce(sum(valor) filter (where lado = 'C'), 0),
         count(*)
    into v_debito, v_credito, v_linhas
    from partida where lancamento_contabil_id = v_id;

  if v_linhas = 0 then
    raise exception 'Lançamento contábil % não tem partidas', v_id
      using errcode = 'check_violation';
  end if;

  if v_debito <> v_credito then
    raise exception
      'Partida dobrada não fecha no lançamento %: débitos % ≠ créditos % (diferença %)',
      v_id, v_debito, v_credito, v_debito - v_credito
      using errcode = 'check_violation',
            hint = 'Toda partida precisa da contrapartida na mesma transação.';
  end if;
  return null;
end $$;

create constraint trigger partidas_precisam_fechar
  after insert or update or delete on partida
  deferrable initially deferred
  for each row execute function valida_partida_dobrada();

-- Um lançamento contábil criado sem nenhuma partida também é recusado.
create constraint trigger lancamento_contabil_precisa_de_partidas
  after insert on lancamento_contabil
  deferrable initially deferred
  for each row execute function valida_partida_dobrada();

-- ---------------------------------------------------------------------
-- Razão e balancete
-- ---------------------------------------------------------------------
create view razao as
  select p.conta_id, pc.codigo as conta, pc.descricao, pc.natureza,
         lc.empresa_id, lc.data, lc.historico, p.lado, p.valor,
         case when p.lado = 'D' then p.valor else -p.valor end as valor_com_sinal,
         p.centro_custo_id, p.pessoa_id, lc.id as lancamento_contabil_id, lc.origem_tipo, lc.origem_id
    from partida p
    join lancamento_contabil lc on lc.id = p.lancamento_contabil_id
    join plano_conta pc         on pc.id = p.conta_id;

create view balancete as
  select conta_id, conta, descricao, natureza, empresa_id,
         sum(valor) filter (where lado = 'D') as total_debito,
         sum(valor) filter (where lado = 'C') as total_credito,
         sum(valor_com_sinal)                 as saldo_devedor,
         count(*)                             as movimentos
    from razao
   group by conta_id, conta, descricao, natureza, empresa_id;

create index partida_lancamento_idx on partida (lancamento_contabil_id);
create index partida_conta_idx      on partida (conta_id);
create index lc_empresa_data_idx    on lancamento_contabil (empresa_id, data);
create index plano_conta_pai_idx    on plano_conta (conta_pai_id);
