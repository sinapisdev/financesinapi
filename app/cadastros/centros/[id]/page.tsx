import { q, brl } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import { notFound } from 'next/navigation';
import Formulario from '../Formulario';

export const dynamic = 'force-dynamic';

export default async function EditarCentro({ params }: { params: Promise<{ id: string }> }) {
  await exigirEmpresa();
  const { id } = await params;
  const [centro] = await q<any>(`
    select cc.*, cc.data_inicio_prevista::text as data_inicio_prevista,
           cc.data_fim_prevista::text as data_fim_prevista,
           (select count(*) from lancamento l where l.centro_custo_id = cc.id and l.status='ativo')::int as lancamentos,
           (select coalesce(sum(l.valor_total), 0) from lancamento l
             where l.centro_custo_id = cc.id and l.status='ativo' and l.tipo='despesa')::float8 as gasto
      from centro_custo cc where cc.id = $1`, [Number(id)]);
  if (!centro) notFound();

  const empresas = await q(`select id, razao_social as nome from empresa where ativo order by codigo`);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Cadastros</div>
        <h1>{centro.nome}</h1>
        <p className="sub">
          {centro.lancamentos} lançamento(s)
          {centro.gasto > 0 && ` · ${brl(centro.gasto)} de despesa acumulada`}
        </p>
      </div>
      <Formulario centro={centro} empresas={empresas as any} proximoCodigo={centro.codigo} />
    </main>
  );
}
