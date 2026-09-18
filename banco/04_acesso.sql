-- =====================================================================
-- 04 — ACESSO
-- Senha com scrypt (nativo do Node, sem dependência): salt próprio por
-- usuário e comparação em tempo constante. O Base44 guardava SHA-256 puro,
-- que é rápido demais para senha — por isso nenhuma senha foi migrada.
-- =====================================================================

create table usuario (
  id             bigint generated always as identity primary key,
  email          text        not null unique,
  nome           text        not null,
  senha_hash     text        not null,          -- scrypt: salt:hash em hex
  papel          text        not null default 'financeiro'
                 check (papel in ('admin','financeiro','leitura')),
  precisa_trocar_senha boolean not null default true,
  ativo          boolean     not null default true,
  ultimo_acesso  timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on column usuario.papel is
  'admin: tudo, inclusive usuários · financeiro: lança, baixa, edita · leitura: só consulta';

-- Empresas que o usuário enxerga. Sem nenhuma linha = enxerga todas.
-- É o que permite dar acesso ao contador externo só de uma SPE.
create table usuario_empresa (
  usuario_id  bigint not null references usuario(id) on delete cascade,
  empresa_id  bigint not null references empresa(id) on delete cascade,
  primary key (usuario_id, empresa_id)
);

-- Sessão em tabela, não JWT: dá para revogar na hora, ver quem está logado
-- e encerrar acesso de alguém que saiu da empresa.
create table sessao (
  token       text        primary key,
  usuario_id  bigint      not null references usuario(id) on delete cascade,
  expira_em   timestamptz not null,
  criado_em   timestamptz not null default now(),
  visto_em    timestamptz not null default now(),
  agente      text
);
create index sessao_usuario_idx on sessao (usuario_id);
create index sessao_expira_idx  on sessao (expira_em);

-- Trilha de acesso: quem entrou, de onde, e quando falhou
create table acesso_log (
  id          bigint generated always as identity primary key,
  email       text        not null,
  sucesso     boolean     not null,
  motivo      text,
  agente      text,
  quando      timestamptz not null default now()
);
create index acesso_log_email_idx on acesso_log (email, quando desc);
