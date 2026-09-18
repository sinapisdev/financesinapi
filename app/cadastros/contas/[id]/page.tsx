import { q, brl } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import { notFound } from 'next/navigation';
import Formulario from '../Formulario';

export const dynamic = 'force-dynamic';

export default async function EditarConta({ params }: { params: Promise<{ id: string }> }) {
  await exigirEmpresa('cadastros');
  const { id } = await params;
  const [conta] = await q<any>(`
    select cb.*, cb.data_saldo_inicial::text as data_saldo_inicial,
           coalesce((select sum(mc.valor_com_sinal) from movimento_caixa mc
                      where mc.conta_bancaria_id = cb.id), 0)::float8 as saldo,
           (select count(*) from movimento_caixa mc where mc.conta_bancaria_id = cb.id)::int as movimentos
      from conta_bancaria cb where cb.id = $1`, [Number(id)]);
  if (!conta) notFound();

  const [empresas, centros, contasContabeis] = await Promise.all([
    q(`select id, razao_social as nome from empresa where ativo order by codigo`),
    q(`select id, nome, empresa_id from centro_custo order by tipo, nome`),
    q(`select id, codigo, descricao from plano_conta
        where aceita_lancamento and codigo like '1.1.1%' order by codigo`),
  ]);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Cadastros</div>
        <h1>{conta.apelido}</h1>
        <p className="sub">{conta.movimentos} movimento(s) · saldo {brl(conta.saldo)}</p>
      </div>
      {conta.movimentos > 0 && (
        <div className="aviso">
          Esta conta tem <strong>{conta.movimentos} movimento(s)</strong>. Mudar a empresa
          levaria esses movimentos junto — confira antes.
        </div>
      )}
      <Formulario conta={conta} empresas={empresas as any} centros={centros as any}
                  contasContabeis={contasContabeis as any} />
    </main>
  );
}
