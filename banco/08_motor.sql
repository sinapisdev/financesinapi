-- =====================================================================
-- 08 — MOTOR CONTÁBIL
--
-- Gera o razão a partir do livro financeiro, aplicando as regras de 07.
-- Roda EM PARALELO: nada do financeiro é alterado, e as tabelas antigas
-- (lancamento_contabil, partida, ligadas ao plano antigo) ficam intactas.
--
-- Reprocessável: apagar e gerar de novo devolve exatamente o mesmo razão.
-- =====================================================================

begin;

create table if not exists livro (
  id            bigint generated always as identity primary key,
  empresa_id    bigint      not null references empresa(id),
  processo_id   bigint      references processo(id),
  data          date        not null,
  historico     text        not null,
  origem_tipo   text        not null check (origem_tipo in ('lancamento','baixa','transferencia','manual')),
  origem_id     bigint,
  gerado_em     timestamptz not null default now()
);
create unique index if not exists livro_origem_uk
  on livro (origem_tipo, origem_id) where origem_tipo <> 'manual';

create table if not exists livro_partida (
  id                bigint generated always as identity primary key,
  livro_id          bigint        not null references livro(id) on delete cascade,
  ordem             smallint      not null,
  lado              char(1)       not null check (lado in ('D','C')),
  conta_id          bigint        not null,
  valor             numeric(15,2) not null check (valor > 0),
  centro_custo_id   bigint        references centro_custo(id),
  pessoa_id         bigint        references pessoa(id),
  historico         text,
  -- literal true + FK composta: o banco recusa partida em conta sintética
  aceita_lancamento boolean       not null default true check (aceita_lancamento),
  foreign key (conta_id, aceita_lancamento) references conta (id, aceita_lancamento),
  unique (livro_id, ordem)
);
create index if not exists razao_partida_conta_idx on livro_partida (conta_id);
create index if not exists livro_data_idx on livro (data, empresa_id);

-- ---------------------------------------------------------------------
-- A TRAVA — verificada no COMMIT, não a cada linha.
-- As pernas podem ser inseridas em qualquer ordem, mas a transação
-- inteira é recusada se não fechar. É isto que torna perna solta
-- impossível, em vez de apenas corrigível.
-- ---------------------------------------------------------------------
create or replace function valida_livro() returns trigger language plpgsql as $$
declare
  v_id bigint; v_d numeric(15,2); v_c numeric(15,2); v_n int;
begin
  -- A mesma função serve às duas tabelas; o nome da chave muda em cada uma.
  -- Precisa ser IF e não CASE: o PL/pgSQL compila os dois ramos do CASE, e
  -- OLD.livro_id não existe quando o gatilho dispara sobre `livro`.
  if TG_TABLE_NAME = 'livro' then
    v_id := case when TG_OP = 'DELETE' then OLD.id else NEW.id end;
  else
    v_id := case when TG_OP = 'DELETE' then OLD.livro_id else NEW.livro_id end;
  end if;
  if not exists (select 1 from livro where id = v_id) then return null; end if;

  select count(*), coalesce(sum(valor) filter (where lado='D'),0),
                   coalesce(sum(valor) filter (where lado='C'),0)
    into v_n, v_d, v_c from livro_partida where livro_id = v_id;

  if v_n = 0 then
    raise exception 'Lançamento contábil % não tem partidas', v_id;
  end if;
  if v_d <> v_c then
    raise exception 'Partida dobrada não fecha no lançamento %: débitos % ≠ créditos % (diferença %)',
      v_id, v_d, v_c, v_d - v_c;
  end if;
  return null;
end $$;

drop trigger if exists livro_fecha on livro;
create constraint trigger livro_fecha after insert or update on livro
  deferrable initially deferred for each row execute function valida_livro();
drop trigger if exists razao_partida_fecha on livro_partida;
create constraint trigger razao_partida_fecha after insert or update or delete on livro_partida
  deferrable initially deferred for each row execute function valida_livro();

commit;

-- =====================================================================
-- O MOTOR
-- =====================================================================
begin;

/* Resolve a conta quando a regra não fixa uma.
   - banco            → a conta contábil da conta bancária da baixa
   - conta_lancamento → a analítica escolhida no lançamento, traduzida pelo
                        de-para (conta.codigo_base44 = plano_conta.codigo) */
create or replace function resolver_conta(
  p_dinamica text, p_lancamento_id bigint, p_baixa_id bigint
) returns bigint language plpgsql stable as $$
declare v bigint;
begin
  if p_dinamica = 'banco' then
    select cb.conta_nova_id into v
      from baixa b join conta_bancaria cb on cb.id = b.conta_bancaria_id
     where b.id = p_baixa_id;
  elsif p_dinamica = 'conta_lancamento' then
    select c.id into v
      from lancamento l
      join plano_conta pc on pc.id = l.conta_id
      join conta c on c.codigo_base44 = pc.codigo
     where l.id = p_lancamento_id
     order by c.codigo limit 1;
  end if;
  return v;
end $$;

drop function if exists gerar_livro(date, date);
create function gerar_livro(p_de date, p_ate date)
returns table (etapa text, gerados int, pulados int, referencia text)
language plpgsql as $$
declare
  reg record; rg record; v_livro bigint; v_valor numeric(15,2); v_conta bigint;
  v_ordem int; v_ok boolean;
  n_lanc int := 0; n_lanc_pulo int := 0; n_bx int := 0; n_bx_pulo int := 0;
begin
  create table if not exists livro_pulado (
    origem_tipo text, origem_id bigint, motivo text);
  delete from livro_pulado;

  -- ---------------- EMISSÃO ----------------
  for reg in
    select l.id, l.empresa_id, l.processo_id, l.data_competencia, l.descricao,
           l.valor_total, l.centro_custo_id, l.pessoa_id, l.conta_id
      from lancamento l
     where l.status = 'ativo'
       and l.data_competencia between p_de and p_ate
       and exists (select 1 from regra g where g.processo_id = l.processo_id
                     and g.evento = 'emissao' and g.ativo)
     order by l.data_competencia, l.id
  loop
    v_ordem := 0; v_ok := true;
    insert into livro (empresa_id, processo_id, data, historico, origem_tipo, origem_id)
    values (reg.empresa_id, reg.processo_id, reg.data_competencia, reg.descricao,
            'lancamento', reg.id)
    on conflict do nothing returning id into v_livro;
    if v_livro is null then continue; end if;

    for rg in select * from regra g where g.processo_id = reg.processo_id
                and g.evento = 'emissao' and g.ativo order by g.ordem loop
      v_valor := reg.valor_total;
      if v_valor is null or v_valor = 0 then continue; end if;
      v_conta := coalesce(rg.conta_id, resolver_conta(rg.conta_dinamica, reg.id, null));
      if v_conta is null then
        v_ok := false;
        insert into livro_pulado values ('lancamento', reg.id,
          'conta dinâmica "' || rg.conta_dinamica || '" não resolveu');
        exit;
      end if;
      v_ordem := v_ordem + 1;
      insert into livro_partida (livro_id, ordem, lado, conta_id, valor,
                                 centro_custo_id, pessoa_id, historico)
      values (v_livro, v_ordem, rg.lado, v_conta, v_valor,
              reg.centro_custo_id, reg.pessoa_id, rg.historico);
    end loop;

    -- Força a trava agora, dentro de um bloco que sabe se recuperar: um
    -- lançamento torto vira linha de relatório em vez de derrubar a geração.
    if v_ok then
      begin
        set constraints all immediate;
        set constraints all deferred;
        n_lanc := n_lanc + 1;
      exception when others then
        insert into livro_pulado values ('lancamento', reg.id, SQLERRM);
        n_lanc := n_lanc; n_lanc_pulo := n_lanc_pulo + 1;
        v_ok := false;
      end;
    end if;
    if not v_ok then
      delete from livro where id = v_livro;
      if not found then null; end if;
    end if;
  end loop;

  -- ---------------- BAIXA ----------------
  for reg in
    select b.id, b.data_liquidacao, b.valor_principal, b.juros, b.multa,
           b.desconto, b.valor_liquido, l.id as lanc_id, l.empresa_id,
           l.processo_id, l.descricao, l.centro_custo_id, p.pessoa_id
      from baixa b
      join parcela p on p.id = b.parcela_id
      join lancamento l on l.id = p.lancamento_id
     where b.estornada_em is null and b.estorno_de_id is null
       and l.status = 'ativo'
       and b.data_liquidacao between p_de and p_ate
       and exists (select 1 from regra g where g.processo_id = l.processo_id
                     and g.evento = 'baixa' and g.ativo)
     order by b.data_liquidacao, b.id
  loop
    v_ordem := 0; v_ok := true;
    insert into livro (empresa_id, processo_id, data, historico, origem_tipo, origem_id)
    values (reg.empresa_id, reg.processo_id, reg.data_liquidacao, reg.descricao,
            'baixa', reg.id)
    on conflict do nothing returning id into v_livro;
    if v_livro is null then continue; end if;

    for rg in select * from regra g where g.processo_id = reg.processo_id
                and g.evento = 'baixa' and g.ativo order by g.ordem loop
      v_valor := case rg.componente
        when 'principal' then reg.valor_principal
        when 'juros'     then reg.juros
        when 'multa'     then reg.multa
        when 'desconto'  then reg.desconto
        when 'liquido'   then reg.valor_liquido
        else reg.valor_principal end;
      if v_valor is null or v_valor = 0 then continue; end if;
      v_conta := coalesce(rg.conta_id, resolver_conta(rg.conta_dinamica, reg.lanc_id, reg.id));
      if v_conta is null then
        v_ok := false;
        insert into livro_pulado values ('baixa', reg.id,
          'conta dinâmica "' || rg.conta_dinamica || '" não resolveu');
        exit;
      end if;
      v_ordem := v_ordem + 1;
      insert into livro_partida (livro_id, ordem, lado, conta_id, valor,
                                 centro_custo_id, pessoa_id, historico)
      values (v_livro, v_ordem, rg.lado, v_conta, v_valor,
              reg.centro_custo_id, reg.pessoa_id, rg.historico);
    end loop;

    if v_ok then
      begin
        set constraints all immediate;
        set constraints all deferred;
        n_bx := n_bx + 1;
      exception when others then
        insert into livro_pulado values ('baixa', reg.id, SQLERRM);
        n_bx_pulo := n_bx_pulo + 1;
        v_ok := false;
      end;
    end if;
    if not v_ok then delete from livro where id = v_livro; end if;
  end loop;

  return query
    select 'emissão'::text, n_lanc, n_lanc_pulo, 'lançamentos'::text
    union all select 'baixa'::text, n_bx, n_bx_pulo, 'baixas'::text;
end $$;

commit;
