import Formulario from '../../Formulario';
import { opcoesItem } from '../../dados';
import { q } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EditarItem({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigirEmpresa();
  const { id } = await params;
  const [item] = await q(
    `select i.*, i.preco_venda::float8 as preco_venda,
            i.quantidade_minima::float8 as quantidade_minima,
            i.area_privativa::float8 as area_privativa,
            i.data_entrada::text as data_entrada, i.data_saida::text as data_saida
       from item i where i.id = $1`, [Number(id)]);
  if (!item) notFound();
  const opcoes = await opcoesItem(ctx);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Estoque</div>
        <h1>{item.identificacao}</h1>
        <p className="sub">Alterando o cadastro do item. O saldo continua vindo dos movimentos.</p>
      </div>
      <Formulario item={item} {...opcoes} />
    </main>
  );
}
