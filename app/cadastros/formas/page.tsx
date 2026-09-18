import { q } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import Lista from './Lista';

export const dynamic = 'force-dynamic';

export default async function Formas() {
  await exigirEmpresa();
  const formas = await q(`
    select f.id, f.codigo, f.nome, f.ativo,
           (select count(*) from baixa b where b.forma_pagamento_id = f.id)::int as usos
      from forma_pagamento f order by f.codigo`);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Cadastros</div>
        <h1>Formas de pagamento</h1>
        <p className="sub">
          Como o dinheiro entra ou sai — usado na baixa. {formas.length} cadastradas.
        </p>
      </div>
      <Lista formas={formas as any} />
    </main>
  );
}
