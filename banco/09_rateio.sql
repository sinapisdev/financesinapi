-- =====================================================================
-- 09 — RATEIO DE CONTAS AGRUPADAS
--
-- O Base44 junta numa conta só o que o plano novo separa: PIS com COFINS,
-- IRPJ com CSLL. Em vez de esconder isso numa regra de partida, o rateio
-- fica explícito aqui — dá para ver, conferir e mudar o percentual sem
-- tocar no motor.
-- =====================================================================

begin;

create table if not exists rateio_conta (
  id          bigint generated always as identity primary key,
  conta_origem_id  bigint not null references conta(id),
  conta_destino_id bigint not null references conta(id),
  percentual  numeric(9,6) not null check (percentual > 0 and percentual <= 100),
  fundamento  text not null,
  ativo       boolean not null default true
);
comment on table rateio_conta is 'Divide o saldo de uma conta em duas ou mais, quando a origem agrupa o que o plano separa';

delete from rateio_conta;

-- PIS e COFINS — regime CUMULATIVO: PIS 0,65% e COFINS 3,0% sobre a receita.
-- A proporção entre eles é fixa: 0,65/3,65 e 3,00/3,65.
insert into rateio_conta (conta_origem_id, conta_destino_id, percentual, fundamento)
select (select id from conta where codigo='3.2.2.02'),
       (select id from conta where codigo=d.cod), d.pct, d.fund
from (values
  ('3.2.2.02', 0.65/3.65*100, 'PIS cumulativo 0,65% — proporção 0,65/3,65'),
  ('3.2.2.03', 3.00/3.65*100, 'COFINS cumulativo 3,0% — proporção 3,00/3,65')
) as d(cod, pct, fund);

-- IRPJ e CSLL — proporção observada no balancete de 12/2025:
-- provisão IRPJ R$ 13.798,21 e CSLL R$ 11.666,89, total R$ 25.465,10.
insert into rateio_conta (conta_origem_id, conta_destino_id, percentual, fundamento)
select (select id from conta where codigo='7.1'),
       (select id from conta where codigo=d.cod), d.pct, d.fund
from (values
  ('7.1', 13798.21/25465.10*100, 'IRPJ — proporção do balancete de 12/2025'),
  ('7.2', 11666.89/25465.10*100, 'CSLL — proporção do balancete de 12/2025')
) as d(cod, pct, fund);

-- ---------------------------------------------------------------------
-- Aplica o rateio sobre o livro já gerado.
-- A partida original é reaproveitada para a primeira fatia e as demais
-- entram como linhas novas. A sobra de arredondamento vai para a última,
-- de modo que a soma das partes volte exatamente ao valor de origem — sem
-- isso a partida dobrada deixaria de fechar por um centavo.
-- ---------------------------------------------------------------------
create or replace function aplicar_rateio()
returns table (conta_origem text, fatias int, partidas_afetadas int)
language plpgsql as $$
declare
  o   record;   -- conta agrupada a dividir
  pt  record;   -- cada partida daquela conta
  ft  record;   -- cada fatia do rateio
  v_restante numeric(15,2);
  v_parte    numeric(15,2);
  v_ordem    int;
  v_i        int;
  v_n        int;
  v_afetadas int;
begin
  for o in
    select rc.conta_origem_id as id, c.codigo,
           count(*) as n_fatias
      from rateio_conta rc join conta c on c.id = rc.conta_origem_id
     where rc.ativo group by rc.conta_origem_id, c.codigo
  loop
    v_afetadas := 0;

    for pt in
      select p.* from livro_partida p where p.conta_id = o.id
    loop
      v_restante := pt.valor;
      v_i := 0;
      v_n := o.n_fatias;
      select coalesce(max(ordem), 0) into v_ordem
        from livro_partida where livro_id = pt.livro_id;

      for ft in
        select rc.conta_destino_id, rc.percentual
          from rateio_conta rc
         where rc.conta_origem_id = o.id and rc.ativo
         order by rc.percentual desc
      loop
        v_i := v_i + 1;
        if v_i = v_n then
          v_parte := v_restante;                 -- a última leva a sobra
        else
          v_parte := round(pt.valor * ft.percentual / 100, 2);
          v_restante := v_restante - v_parte;
        end if;
        if v_parte = 0 then continue; end if;

        if v_i = 1 then
          update livro_partida
             set conta_id = ft.conta_destino_id, valor = v_parte
           where id = pt.id;
        else
          v_ordem := v_ordem + 1;
          insert into livro_partida (livro_id, ordem, lado, conta_id, valor,
                                     centro_custo_id, pessoa_id, historico)
          values (pt.livro_id, v_ordem, pt.lado, ft.conta_destino_id, v_parte,
                  pt.centro_custo_id, pt.pessoa_id, pt.historico);
        end if;
      end loop;
      v_afetadas := v_afetadas + 1;
    end loop;

    conta_origem := o.codigo; fatias := o.n_fatias; partidas_afetadas := v_afetadas;
    return next;
  end loop;
end $$;

commit;
