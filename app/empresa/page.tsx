import { q, brl } from '@/lib/db';
import { empresaAtiva, nomeCurto } from '@/lib/empresa';
import { escolherEmpresa } from './acoes';
import { exigirUsuario } from '@/lib/auth';
import { empresasDe } from '@/lib/permissoes';

export const dynamic = 'force-dynamic';

export default async function EscolherEmpresa({ searchParams }: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const eu = await exigirUsuario();
  const { destino } = await searchParams;
  const atual = await empresaAtiva();

  // Escopo do usuário. Lista vazia = vê todas; com restrição, o consolidado
  // sai da tela, porque somaria empresas que a pessoa não pode enxergar.
  const permitidas = await empresasDe(eu.id);
  const podeConsolidado = permitidas.length === 0;

  // Cada total em sua própria subconsulta: juntar lançamentos e movimentos na
  // mesma query multiplica as linhas de um pelo outro e infla os dois.
  const empresas = await q(`
    select e.id, e.codigo, e.razao_social, e.tipo,
           (select count(*) from lancamento l
             where l.empresa_id = e.id and l.status = 'ativo')::int as lancamentos,
           (select coalesce(sum(mc.valor_com_sinal), 0) from movimento_caixa mc
             where mc.empresa_id = e.id)::float8 as caixa,
           (select coalesce(sum(p.valor_original - p.valor_baixado), 0)
              from parcela p join lancamento l2 on l2.id = p.lancamento_id
             where l2.empresa_id = e.id and p.tipo = 'receber'
               and p.status in ('aberta','parcial'))::float8 as a_receber
      from empresa e
     where e.ativo and ($1::bigint[] = '{}' or e.id = any($1))
     order by e.codigo`, [permitidas]);

  const totalCaixa = empresas.reduce((s: number, e: any) => s + e.caixa, 0);
  const totalReceber = empresas.reduce((s: number, e: any) => s + e.a_receber, 0);
  const totalLanc = empresas.reduce((s: number, e: any) => s + e.lancamentos, 0);

  return (
    <main className="tela-escolha">
      <div className="cabecalho-pagina" style={{ textAlign: 'center', marginBottom: 28 }}>
        <div className="eyebrow">Grupo Silvereng</div>
        <h1>Em qual empresa você vai trabalhar?</h1>
        <p className="sub" style={{ margin: '6px auto 0' }}>
          A escolha vale para todas as telas. Dá para trocar a qualquer momento pela barra lateral.
        </p>
      </div>

      <form action={escolherEmpresa} className="lista-empresas">
        <input type="hidden" name="destino" value={destino || '/painel'} />

        {empresas.map((e: any) => (
          <button key={e.id} type="submit" name="empresa" value={e.id}
                  className={`cartao-empresa ${atual?.id === e.id ? 'atual' : ''}`}>
            <div className="ce-topo">
              <span className={`tag ${e.tipo === 'spe' ? 'tag-transf' : 'tag-entrada'}`}>
                {e.tipo === 'spe' ? 'SPE' : 'operacional'}
              </span>
              {atual?.id === e.id && <span className="ce-atual">atual</span>}
            </div>
            <strong>{nomeCurto(e.razao_social)}</strong>
            <span className="ce-razao">{e.razao_social}</span>
            <div className="ce-numeros">
              <span>{e.lancamentos} lançamentos</span>
              <span className={e.caixa >= 0 ? 'v-entrada' : 'v-saida'}>{brl(e.caixa)}</span>
            </div>
            <div className="ce-numeros" style={{ marginTop: 0, paddingTop: 6, borderTop: 0 }}>
              <span>a receber em aberto</span>
              <span style={{ fontWeight: 600, color: 'var(--aco)' }}>{brl(e.a_receber)}</span>
            </div>
          </button>
        ))}

        {podeConsolidado && <button type="submit" name="empresa" value="todas"
                className={`cartao-empresa consolidado ${atual?.todas ? 'atual' : ''}`}>
          <div className="ce-topo">
            <span className="tag tag-alerta">consolidado</span>
            {atual?.todas && <span className="ce-atual">atual</span>}
          </div>
          <strong>Todas as empresas</strong>
          <span className="ce-razao">Visão somada do grupo — use para conferir o todo, não para lançar</span>
          <div className="ce-numeros">
            <span>{totalLanc} lançamentos · {brl(totalReceber)} a receber</span>
            <span className={totalCaixa >= 0 ? 'v-entrada' : 'v-saida'}>{brl(totalCaixa)}</span>
          </div>
        </button>}
      </form>
    </main>
  );
}
