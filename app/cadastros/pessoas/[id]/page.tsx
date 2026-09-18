import { q, brl } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import { notFound } from 'next/navigation';
import Formulario from '../Formulario';

export const dynamic = 'force-dynamic';

export default async function EditarPessoa({ params }: { params: Promise<{ id: string }> }) {
  await exigirEmpresa('cadastros');
  const { id } = await params;
  const [pessoa] = await q<any>(`
    select p.*,
           (select count(*) from lancamento l where l.pessoa_id = p.id and l.status='ativo')::int as lancamentos,
           (select coalesce(sum(pa.valor_original - pa.valor_baixado), 0)
              from parcela pa where pa.pessoa_id = p.id and pa.status in ('aberta','parcial'))::float8 as em_aberto
      from pessoa p where p.id = $1`, [Number(id)]);
  if (!pessoa) notFound();

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Cadastros</div>
        <h1>{pessoa.nome_razao_social}</h1>
        <p className="sub">
          {pessoa.lancamentos} lançamento(s)
          {pessoa.em_aberto > 0 && ` · ${brl(pessoa.em_aberto)} em aberto`}
          {!pessoa.ativo && ' · cadastro inativo'}
        </p>
      </div>
      {pessoa.lancamentos > 0 && (
        <div className="aviso">
          Este cadastro tem <strong>{pessoa.lancamentos} lançamento(s)</strong>. Mudar o nome altera
          como eles aparecem em todo o histórico — o vínculo é por cadastro, não por cópia do nome.
        </div>
      )}
      <Formulario pessoa={pessoa} />
    </main>
  );
}
