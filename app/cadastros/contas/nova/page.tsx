import { q } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import Formulario from '../Formulario';

export const dynamic = 'force-dynamic';

export default async function NovaConta() {
  const ctx = await exigirEmpresa();
  const [empresas, centros, contasContabeis] = await Promise.all([
    q(`select id, razao_social as nome from empresa where ativo
        and ($1::bigint is null or id = $1) order by codigo`, [ctx.id]),
    q(`select id, nome, empresa_id from centro_custo order by tipo, nome`),
    q(`select id, codigo, descricao from plano_conta
        where aceita_lancamento and codigo like '1.1.1%' order by codigo`),
  ]);
  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Cadastros</div>
        <h1>Nova conta bancária</h1>
        <p className="sub">Toda baixa exige uma conta — é o que liga o sistema ao extrato do banco.</p>
      </div>
      <Formulario empresas={empresas as any} centros={centros as any} contasContabeis={contasContabeis as any} />
    </main>
  );
}
