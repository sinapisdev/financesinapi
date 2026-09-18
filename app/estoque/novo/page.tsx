import Formulario from '../Formulario';
import { opcoesItem } from '../dados';
import { exigirEmpresa } from '@/lib/empresa';

export const dynamic = 'force-dynamic';

export default async function NovoItem() {
  const ctx = await exigirEmpresa();
  const opcoes = await opcoesItem(ctx);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Estoque</div>
        <h1>Novo item</h1>
        <p className="sub">
          Imóvel, mercadoria, peça de mostruário ou serviço — o grupo define como o item
          é controlado e em que contas ele entra.
        </p>
      </div>
      <Formulario {...opcoes} />
    </main>
  );
}
