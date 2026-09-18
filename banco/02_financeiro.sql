-- =====================================================================
-- 02 — LIVRO FINANCEIRO (fonte de verdade)
-- Estes dados vêm do Base44 e batem com o extrato bancário.
-- A contabilidade é derivada daqui, nunca o contrário.
-- =====================================================================

-- numeração própria do sistema novo, independente do Base44
create sequence lancamento_numero_seq;

create table lancamento (
  id               bigint generated always as identity primary key,
  numero           text        not null unique,
  empresa_id       bigint      not null references empresa(id),
  centro_custo_id  bigint      references centro_custo(id),
  processo_id      bigint,                      -- FK criada em 03_contabil
  -- conta analítica escolhida por quem lança (a natureza real da despesa ou
  -- receita). O processo indica o grupo; aqui fica a conta de verdade.
  conta_id         bigint,                      -- FK criada em 03_contabil
  tipo             text        not null check (tipo in ('receita','despesa')),
  pessoa_id        bigint      references pessoa(id),
  vendedor_id      bigint      references pessoa(id),
  imovel_id        bigint      references imovel(id),
  data_competencia date        not null,
  valor_total      numeric(15,2) not null check (valor_total > 0),
  -- Descrição é obrigatória e precisa dizer alguma coisa: o banco recusa
  -- vazio ou texto de uma/duas letras, por qualquer caminho.
  descricao        text        not null
                   constraint descricao_precisa_dizer_algo
                   check (length(trim(descricao)) >= 3),
  -- true quando a descrição não foi escrita por ninguém: o Base44 deixou em
  -- branco e usamos o nome da contraparte. A interface marca com um ponto
  -- bordô, para irem sendo corrigidas aos poucos.
  descricao_automatica boolean not null default false,
  observacao       text,
  a_vista          boolean     not null default false,
  -- Venda a prazo com financiamento próprio: as parcelas somam mais que o
  -- valor do imóvel, e a diferença é juros. Não é erro, é o negócio.
  juros_embutidos  numeric(15,2) not null default 0 check (juros_embutidos >= 0),
  requer_revisao   boolean     not null default false,
  motivo_revisao   text,
  status           text        not null default 'ativo'
                   check (status in ('ativo','cancelado')),
  base44_id        text        unique,
  base44_numero    text,
  criado_por       text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- Contas a receber e a pagar são o mesmo objeto visto de dois lados.
create table parcela (
  id                bigint generated always as identity primary key,
  lancamento_id     bigint      not null references lancamento(id) on delete restrict,
  numero            integer     not null check (numero > 0),
  tipo              text        not null check (tipo in ('receber','pagar')),
  pessoa_id         bigint      references pessoa(id),
  data_vencimento   date        not null,
  valor_original    numeric(15,2) not null check (valor_original > 0),
  valor_baixado     numeric(15,2) not null default 0,   -- mantido por trigger
  documento         text,
  categoria         text,                                -- entrada, balao, chaves, parcela
  status            text        not null default 'aberta'
                    check (status in ('aberta','parcial','liquidada','cancelada')),
  autorizada_em     timestamptz,
  autorizada_por    text,
  base44_id         text        unique,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  unique (lancamento_id, numero, tipo)
);

-- A baixa é o momento em que o dinheiro se move de verdade.
-- valor_liquido é COLUNA GERADA: a aritmética de juros e desconto passa a ser
-- responsabilidade do banco. É impossível gravar um líquido que não confere
-- com os componentes — a falha que hoje deixa R$ 176 mil fora do caixa.
create table baixa (
  id                 bigint generated always as identity primary key,
  parcela_id         bigint      not null references parcela(id) on delete restrict,
  conta_bancaria_id  bigint      not null references conta_bancaria(id),
  forma_pagamento_id bigint      references forma_pagamento(id),
  data_liquidacao    date        not null,
  valor_principal    numeric(15,2) not null check (valor_principal > 0),
  juros              numeric(15,2) not null default 0 check (juros    >= 0),
  multa              numeric(15,2) not null default 0 check (multa    >= 0),
  desconto           numeric(15,2) not null default 0 check (desconto >= 0),
  valor_liquido      numeric(15,2) generated always as
                     (valor_principal + juros + multa - desconto) stored,
  observacao         text,
  estorno_de_id      bigint      references baixa(id),
  -- estorno não apaga: a baixa fica no histórico e deixa de contar
  estornada_em       timestamptz,
  estornada_por      text,
  motivo_estorno     text,
  base44_id          text        unique,
  criado_por         text,
  criado_em          timestamptz not null default now(),
  constraint desconto_nao_supera_o_valor check (desconto <= valor_principal + juros + multa)
);
comment on column baixa.conta_bancaria_id is
  'Obrigatório. No Base44 não existe — por isso conciliar banco a banco é impossível lá.';

-- Transferência entre contas: não é receita nem despesa, só muda de bolso.
create table transferencia (
  id                bigint generated always as identity primary key,
  empresa_id        bigint      not null references empresa(id),
  conta_origem_id   bigint      not null references conta_bancaria(id),
  conta_destino_id  bigint      not null references conta_bancaria(id),
  data_movimento    date        not null,
  valor             numeric(15,2) not null check (valor > 0),
  descricao         text,
  -- O Base44 não registra de qual conta saiu nem em qual entrou. As
  -- transferências migradas ficam com as duas pontas na conta guarda-chuva e
  -- marcadas aqui, em vez de inventarmos um destino plausível.
  contas_identificadas boolean not null default true,
  base44_id         text        unique,
  criado_por        text,
  criado_em         timestamptz not null default now(),
  constraint contas_diferentes check (
    not contas_identificadas or conta_origem_id <> conta_destino_id)
);

-- ---------------------------------------------------------------------
-- Coerência entre lançamento e parcelas
-- ---------------------------------------------------------------------

-- A soma das parcelas tem de fechar com o valor do lançamento.
-- DEFERRABLE: a verificação roda no commit, então dá para inserir o
-- lançamento e suas parcelas na mesma transação, em qualquer ordem.
create or replace function valida_soma_parcelas() returns trigger
language plpgsql as $$
declare
  v_lancamento_id bigint;
  v_total   numeric(15,2);
  v_parcelas numeric(15,2);
  v_status  text;
  v_juros   numeric(15,2);
begin
  v_lancamento_id := case when TG_OP = 'DELETE' then OLD.lancamento_id else NEW.lancamento_id end;

  select valor_total, status, juros_embutidos into v_total, v_status, v_juros
    from lancamento where id = v_lancamento_id;
  if not found or v_status = 'cancelado' then return null; end if;

  select coalesce(sum(valor_original), 0) into v_parcelas
    from parcela where lancamento_id = v_lancamento_id and status <> 'cancelada';

  -- parcelas = valor do lançamento + juros do financiamento próprio
  if v_parcelas <> v_total + v_juros then
    raise exception 'Parcelas do lançamento % somam % mas o esperado é % (valor % + juros embutidos %)',
      v_lancamento_id, v_parcelas, v_total + v_juros, v_total, v_juros
      using errcode = 'check_violation';
  end if;
  return null;
end $$;

create constraint trigger parcelas_fecham_com_lancamento
  after insert or update or delete on parcela
  deferrable initially deferred
  for each row execute function valida_soma_parcelas();

-- valor_baixado e status da parcela são mantidos pelo banco, não pela aplicação.
create or replace function atualiza_saldo_parcela() returns trigger
language plpgsql as $$
declare
  v_parcela_id bigint;
  v_baixado numeric(15,2);
  v_original numeric(15,2);
begin
  v_parcela_id := case when TG_OP = 'DELETE' then OLD.parcela_id else NEW.parcela_id end;

  -- só o PRINCIPAL amortiza a parcela. Juros e multa são acréscimos e
  -- desconto é redução do que entra no caixa — nenhum deles muda o quanto
  -- da dívida foi quitado. Somá-los aqui faria o saldo ficar negativo.
  select coalesce(sum(valor_principal), 0)
    into v_baixado from baixa
   where parcela_id = v_parcela_id and estornada_em is null;
  select valor_original into v_original from parcela where id = v_parcela_id;

  update parcela set
    valor_baixado = v_baixado,
    status = case
               when status = 'cancelada'        then 'cancelada'
               when v_baixado <= 0              then 'aberta'
               when v_baixado < v_original      then 'parcial'
               else 'liquidada'
             end,
    atualizado_em = now()
  where id = v_parcela_id;
  return null;
end $$;

create trigger baixa_atualiza_parcela
  after insert or update or delete on baixa
  for each row execute function atualiza_saldo_parcela();

-- ---------------------------------------------------------------------
-- Visão unificada do caixa: é o que se compara com o extrato bancário.
-- ---------------------------------------------------------------------
create view movimento_caixa as
  select b.id                                                as origem_id,
         'baixa'::text                                       as origem,
         b.data_liquidacao                                   as data,
         b.conta_bancaria_id,
         l.empresa_id,
         l.centro_custo_id,
         case when p.tipo = 'receber' then 'entrada' else 'saida' end as sentido,
         case when p.tipo = 'receber' then b.valor_liquido else -b.valor_liquido end as valor_com_sinal,
         b.valor_liquido,
         l.id                                                as lancamento_id,
         p.pessoa_id,
         coalesce(nullif(b.observacao, ''), l.descricao)      as descricao
    from baixa b
    join parcela p    on p.id = b.parcela_id
    join lancamento l on l.id = p.lancamento_id
   where b.estornada_em is null
  -- Sem filtro por status do lançamento: se houve baixa, o dinheiro se moveu
  -- e está no extrato. Cancelar o lançamento depois não desfaz o movimento —
  -- para desfazer é preciso estornar a baixa.
  union all
  select t.id, 'transferencia', t.data_movimento, t.conta_origem_id, t.empresa_id, null,
         'saida', -t.valor, t.valor, null, null, coalesce(t.descricao,'Transferência')
    from transferencia t
  union all
  select t.id, 'transferencia', t.data_movimento, t.conta_destino_id, t.empresa_id, null,
         'entrada', t.valor, t.valor, null, null, coalesce(t.descricao,'Transferência')
    from transferencia t;

create index lancamento_empresa_data_idx on lancamento (empresa_id, data_competencia);
create index lancamento_centro_idx       on lancamento (centro_custo_id);
create index parcela_lancamento_idx      on parcela (lancamento_id);
create index parcela_vencimento_idx      on parcela (data_vencimento) where status in ('aberta','parcial');
create index baixa_parcela_idx           on baixa (parcela_id);
create index baixa_conta_data_idx        on baixa (conta_bancaria_id, data_liquidacao);
