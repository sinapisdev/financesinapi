-- =====================================================================
-- 11 — PERMISSÕES POR ÁREA, ESCOPO POR EMPRESA E CONVITES
--
-- Antes: três papéis fixos (admin/financeiro/leitura) e uma única regra,
-- "pode escrever ou não". Não dava para dizer "o financeiro não vê a
-- contabilidade", que é o caso real do grupo.
--
-- Agora: o papel vira PERFIL, que só semeia valores padrão. O que vale de
-- verdade é a linha em usuario_permissao — assim o admin ajusta uma área
-- de uma pessoa sem inventar um perfil novo para cada exceção.
-- =====================================================================

-- ------------------------------------------------------------- PERFIS
alter table usuario drop constraint if exists usuario_papel_check;
alter table usuario add constraint usuario_papel_check
  check (papel in ('admin','financeiro','contabil','obra','leitura','personalizado'));

comment on column usuario.papel is
  'Perfil base: semeia as permissões na hora de criar. O que vale é usuario_permissao.';

-- -------------------------------------------------------- PERMISSÕES
-- Uma linha por área que o usuário enxerga. Área ausente = sem acesso,
-- para que uma área nova do sistema nasça fechada em vez de aberta.
create table usuario_permissao (
  usuario_id  bigint not null references usuario(id) on delete cascade,
  area        text   not null,
  nivel       text   not null check (nivel in ('ver','editar')),
  primary key (usuario_id, area)
);
comment on table usuario_permissao is
  'Permissão efetiva. Sem linha para a área = sem acesso (padrão fechado).';

-- ---------------------------------------------------------- EMPRESAS
-- usuario_empresa já existe desde o 04_acesso.sql, e continua com a mesma
-- regra: nenhuma linha = enxerga todas as empresas.

-- ---------------------------------------------------------- CONVITES
-- O admin não define senha de ninguém: gera um convite, a pessoa escolhe a
-- própria senha. Ninguém além dela conhece a senha, em momento algum.
create table convite (
  token       text        primary key,
  email       text        not null,
  nome        text        not null,
  papel       text        not null,
  permissoes  jsonb       not null default '{}'::jsonb,   -- {area: nivel}
  empresas    bigint[]    not null default '{}',          -- vazio = todas
  criado_por  bigint      references usuario(id) on delete set null,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  usado_em    timestamptz,
  usuario_id  bigint      references usuario(id) on delete set null,
  cancelado_em timestamptz
);
create index convite_email_idx on convite (lower(email));
create index convite_aberto_idx on convite (expira_em) where usado_em is null;

comment on table convite is
  'Convite de acesso. O token vai no link; expira, e vale uma vez só.';

-- ------------------------------------------- QUEM JÁ EXISTE MANTÉM TUDO
-- Sem isto, o admin atual perderia o acesso na primeira checagem por área.
insert into usuario_permissao (usuario_id, area, nivel)
select u.id, a.area, 'editar'
  from usuario u
 cross join (values ('painel'),('movimento'),('contas'),('estoque'),
                    ('cadastros'),('contabilidade'),('relatorios'),('administracao')) as a(area)
 where u.papel = 'admin'
on conflict do nothing;

insert into usuario_permissao (usuario_id, area, nivel)
select u.id, a.area, a.nivel
  from usuario u
 cross join (values ('painel','editar'),('movimento','editar'),('contas','editar'),
                    ('estoque','editar'),('cadastros','editar'),('relatorios','ver')) as a(area, nivel)
 where u.papel = 'financeiro'
on conflict do nothing;

insert into usuario_permissao (usuario_id, area, nivel)
select u.id, a.area, 'ver'
  from usuario u
 cross join (values ('painel'),('movimento'),('contas'),('estoque'),
                    ('cadastros'),('relatorios')) as a(area)
 where u.papel = 'leitura'
on conflict do nothing;
