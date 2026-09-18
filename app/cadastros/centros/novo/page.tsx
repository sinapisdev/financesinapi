import { q } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import Formulario from '../Formulario';

export const dynamic = 'force-dynamic';

export default async function NovoCentro() {
  const ctx = await exigirEmpresa();
  const [empresas, [prox]] = await Promise.all([
    q(`select id, razao_social as nome from empresa where ativo
        and ($1::bigint is null or id = $1) order by codigo`, [ctx.id]),
    q(`select coalesce(max(codigo), 0) + 1 as proximo from centro_custo`),
  ]);
  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Cadastros</div>
        <h1>Novo centro de custo</h1>
        <p className="sub">Obra, projeto ou área administrativa — é por aqui que a despesa é alocada.</p>
      </div>
      <Formulario empresas={empresas as any} proximoCodigo={prox.proximo} />
    </main>
  );
}
