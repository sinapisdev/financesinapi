-- =====================================================================
-- 01 — CADASTROS
-- Toda tabela carrega base44_id: rastreia cada linha até o registro de
-- origem e torna a carga repetível sem duplicar nada.
-- =====================================================================

create table empresa (
  id              bigint generated always as identity primary key,
  codigo          integer      not null unique,
  cnpj            varchar(14)  unique,
  razao_social    text         not null,
  nome_fantasia   text,
  tipo            text         not null default 'operacional'
                  check (tipo in ('operacional','spe','holding')),
  ativo           boolean      not null default true,
  base44_id       text         unique,
  criado_em       timestamptz  not null default now(),
  atualizado_em   timestamptz  not null default now()
);
comment on column empresa.tipo is 'SPE = sociedade de propósito específico (uma por empreendimento)';

-- Centro de custo, não "obra": além dos empreendimentos, agrupa
-- ADMINISTRATIVO, INCORPORADORA e os projetos de engenharia.
create table centro_custo (
  id                     bigint generated always as identity primary key,
  codigo                 integer     not null unique,
  empresa_id             bigint      not null references empresa(id),
  nome                   text        not null,
  tipo                   text        not null default 'obra'
                         check (tipo in ('obra','administrativo','incorporadora','projeto','outro')),
  tipo_imovel            text,
  cidade                 text,
  uf                     varchar(2),
  status                 text        not null default 'planejada'
                         check (status in ('planejada','em_andamento','concluida','cancelada')),
  qtd_unidades           integer,
  vgv_estimado           numeric(15,2),
  custo_estimado         numeric(15,2),
  data_inicio_prevista   date,
  data_fim_prevista      date,
  base44_id              text        unique,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

-- Cliente, fornecedor e vendedor viram papéis da mesma pessoa.
-- No Base44 são três cadastros separados, então a mesma pessoa aparece
-- duplicada quando compra e presta serviço.
create table pessoa (
  id                 bigint generated always as identity primary key,
  codigo             integer,
  tipo_pessoa        char(2)     not null default 'PJ' check (tipo_pessoa in ('PF','PJ')),
  nome_razao_social  text        not null,
  nome_fantasia      text,
  cpf_cnpj           varchar(14),
  rg_ie              text,
  email              text,
  telefone           text,
  endereco           text,
  numero             text,
  complemento        text,
  bairro             text,
  cidade             text,
  uf                 varchar(2),
  cep                varchar(8),
  eh_cliente         boolean     not null default false,
  eh_fornecedor      boolean     not null default false,
  eh_vendedor        boolean     not null default false,
  juros_percentual   numeric(6,3) not null default 0,
  multa_percentual   numeric(6,3) not null default 0,
  dias_tolerancia    integer      not null default 0,
  percentual_comissao numeric(6,3),
  ativo              boolean     not null default true,
  base44_id          text        unique,
  base44_origem      text        check (base44_origem in ('Clientes','Fornecedores','Vendedores')),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  constraint pessoa_tem_algum_papel check (eh_cliente or eh_fornecedor or eh_vendedor)
);
-- CPF/CNPJ único quando informado; o Base44 obriga preencher e por isso
-- existe "FORNECEDORES DIVERSOS" genérico, que não pode colidir.
create unique index pessoa_cpf_cnpj_unico on pessoa (cpf_cnpj) where cpf_cnpj is not null;

-- Isto não existe no Base44: lá as 6 contas do Sicoob estão cadastradas
-- mas nenhum movimento aponta para elas, o que impede conciliação.
create table conta_bancaria (
  id                bigint generated always as identity primary key,
  empresa_id        bigint      not null references empresa(id),
  apelido           text        not null,
  instituicao       text        not null,
  codigo_bacen      varchar(5),
  agencia           text,
  numero_conta      text,
  tipo              text        not null default 'corrente'
                    check (tipo in ('corrente','poupanca','aplicacao','caixa_fisico')),
  centro_custo_id   bigint      references centro_custo(id),
  saldo_inicial     numeric(15,2) not null default 0,
  data_saldo_inicial date,
  ativo             boolean     not null default true,
  base44_id         text        unique,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  unique (empresa_id, agencia, numero_conta)
);
comment on column conta_bancaria.centro_custo_id is 'Conta dedicada a um centro de custo, quando houver';

create table imovel (
  id             bigint generated always as identity primary key,
  centro_custo_id bigint     references centro_custo(id),
  identificacao  text        not null,
  bloco          text,
  andar          integer,
  area_privativa numeric(10,2),
  valor_tabela   numeric(15,2),
  status         text        not null default 'disponivel'
                 check (status in ('disponivel','reservado','vendido','permutado','cancelado')),
  base44_id      text        unique,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (centro_custo_id, identificacao)
);

create table forma_pagamento (
  id         bigint generated always as identity primary key,
  codigo     integer not null unique,
  nome       text    not null,
  ativo      boolean not null default true,
  base44_id  text    unique
);

create index centro_custo_empresa_idx on centro_custo (empresa_id);
create index conta_bancaria_emp_idx  on conta_bancaria (empresa_id);
create index imovel_centro_idx       on imovel (centro_custo_id);
create index pessoa_nome_idx         on pessoa using gin (to_tsvector('portuguese', nome_razao_social));
