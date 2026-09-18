import { q } from '@/lib/db';
import type { Contexto } from '@/lib/empresa';
import { nomeCurto } from '@/lib/empresa';

/** Opções do formulário de item. Os grupos vêm filtrados pelo ramo da empresa
 *  ativa: numa SPE não faz sentido oferecer "mercadorias para revenda". */
export async function opcoesItem(ctx: Contexto) {
  const [grupos, empresas, centros, pessoas] = await Promise.all([
    q(`select g.id, g.codigo, g.nome, g.tipo, g.controle, g.observacao,
              ce.codigo || ' ' || ce.descricao as conta_estoque,
              cr.codigo || ' ' || cr.descricao as conta_receita,
              cc.codigo || ' ' || cc.descricao as conta_custo
         from item_grupo g
         left join plano_conta ce on ce.id = g.conta_estoque_id
         left join plano_conta cr on cr.id = g.conta_receita_id
         left join plano_conta cc on cc.id = g.conta_custo_id
        where g.ativo
          and (not exists (select 1 from item_grupo_ramo gr where gr.grupo_id = g.id)
               or exists (select 1 from item_grupo_ramo gr join empresa e on e.ramo = gr.ramo
                           where gr.grupo_id = g.id and e.ativo
                             and ($1::bigint is null or e.id = $1)))
        order by g.tipo, g.nome`, [ctx.id]),
    q(`select id, razao_social from empresa
        where ativo and ($1::bigint is null or id = $1) order by codigo`, [ctx.id]),
    q(`select id, nome, empresa_id from centro_custo
        where status <> 'cancelada' and ($1::bigint is null or empresa_id = $1)
        order by nome`, [ctx.id]),
    q(`select id, nome_razao_social from pessoa where ativo order by nome_razao_social limit 2000`),
  ]);
  return {
    grupos: grupos as any,
    empresas: empresas.map((e: any) => ({ id: e.id, nome: nomeCurto(e.razao_social) })),
    centros: centros as any,
    pessoas: pessoas.map((p: any) => ({ id: p.id, nome: p.nome_razao_social })),
  };
}
