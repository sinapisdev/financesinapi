import { q, brl, dataBR } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';

export const dynamic = 'force-dynamic';
type Params = { [k: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

const TIPO_ROTULO: Record<string, string> = {
  obra: 'Obra', projeto: 'Projeto', administrativo: 'Administrativo',
  incorporadora: 'Incorporadora', outro: 'Outro',
};
const STATUS_ROTULO: Record<string, string> = {
  planejada: 'planejada', em_andamento: 'em andamento', concluida: 'concluída', cancelada: 'cancelada',
};

export default async function Centros({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await exigirEmpresa('cadastros');
  const sp = await searchParams;
  const salvo = str(sp.salvo);

  const linhas = await q(`
    select cc.id, cc.codigo, cc.nome, cc.tipo, cc.status, cc.cidade, cc.uf,
           cc.qtd_unidades, cc.vgv_estimado::float8 as vgv, cc.custo_estimado::float8 as custo,
           cc.data_fim_prevista::text as fim, e.razao_social as empresa,
           (select count(*) from lancamento l where l.centro_custo_id = cc.id and l.status='ativo')::int as lancamentos,
           (select coalesce(sum(l.valor_total), 0) from lancamento l
             where l.centro_custo_id = cc.id and l.status='ativo' and l.tipo='despesa')::float8 as gasto
      from centro_custo cc join empresa e on e.id = cc.empresa_id
     where ($1::bigint is null or cc.empresa_id = $1)
     order by cc.tipo, cc.nome`, [ctx.id]);

  return (
    <main>
      <div className="cabecalho-pagina linha">
        <div>
          <div className="eyebrow">Cadastros</div>
          <h1>Centros de custo</h1>
          <p className="sub">
            {ctx.todas ? 'Todas as empresas' : nomeCurto(ctx.nome)} · {linhas.length} centros ·
            {' '}obras, projetos e áreas onde o dinheiro é alocado
          </p>
        </div>
        <a className="aplicar" href="/cadastros/centros/novo">Novo centro</a>
      </div>

      {salvo && <div className="sucesso">Centro de custo salvo.</div>}

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">Cód.</th><th>Nome</th><th>Tipo</th><th>Situação</th>
              <th className="oculta-mobile">Cidade</th>
              <th className="num oculta-mobile">Unid.</th>
              <th className="num oculta-mobile">VGV estimado</th>
              <th className="num">Gasto até hoje</th>
              <th className="num">Lanç.</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((c: any) => (
              <tr key={c.id} className={String(c.id) === salvo ? 'destaque' : ''}>
                <td className="num tabular sub">{c.codigo}</td>
                <td>
                  <a className="desc-link" href={`/cadastros/centros/${c.id}`}>
                    <div className="desc">{c.nome}</div>
                  </a>
                  {ctx.todas && <div className="sub">{nomeCurto(c.empresa)}</div>}
                </td>
                <td><span className="tag tag-transf">{TIPO_ROTULO[c.tipo] ?? c.tipo}</span></td>
                <td>
                  <span className={`tag ${c.status === 'em_andamento' ? 'tag-entrada'
                    : c.status === 'concluida' ? 'tag-transf'
                    : c.status === 'cancelada' ? 'tag-saida' : 'tag-alerta'}`}>
                    {STATUS_ROTULO[c.status] ?? c.status}
                  </span>
                  {c.fim && <div className="sub">até {dataBR(c.fim)}</div>}
                </td>
                <td className="sub oculta-mobile">{c.cidade ? `${c.cidade}${c.uf ? '/' + c.uf : ''}` : '—'}</td>
                <td className="num tabular sub oculta-mobile">{c.qtd_unidades || '—'}</td>
                <td className="num tabular sub oculta-mobile">{c.vgv ? brl(c.vgv) : '—'}</td>
                <td className="num tabular v-saida">{c.gasto > 0 ? brl(c.gasto) : '—'}</td>
                <td className="num tabular sub">{c.lancamentos || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
