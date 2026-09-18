import { q } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import Lista from './Lista';

export const dynamic = 'force-dynamic';

export default async function Empresas() {
  await exigirEmpresa();

  const [empresas, ramos] = await Promise.all([
    q(`select e.id, e.codigo, e.cnpj, e.razao_social, e.nome_fantasia, e.tipo, e.ramo, e.ativo,
              r.nome as ramo_nome,
              (select count(*) from centro_custo c where c.empresa_id = e.id)::int as centros,
              (select count(*) from lancamento l
                where l.empresa_id = e.id and l.status = 'ativo')::int as lancamentos
         from empresa e join ramo r on r.codigo = e.ramo
        order by e.codigo`),
    q(`select codigo, nome from ramo order by ordem`),
  ]);
  const proximo = Math.max(0, ...empresas.map((e: any) => e.codigo)) + 1;

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Cadastros</div>
        <h1>Empresas</h1>
        <p className="sub">
          {empresas.length} empresas · cada uma com o seu caixa, os seus centros de custo
          e a sua DRE
        </p>
      </div>
      <Lista empresas={empresas as any} ramos={ramos as any} proximoCodigo={proximo} />
    </main>
  );
}
