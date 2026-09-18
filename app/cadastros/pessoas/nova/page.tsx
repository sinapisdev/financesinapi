import { exigirEmpresa } from '@/lib/empresa';
import Formulario from '../Formulario';

export const dynamic = 'force-dynamic';

export default async function NovaPessoa() {
  await exigirEmpresa('cadastros');
  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Cadastros</div>
        <h1>Novo cadastro</h1>
        <p className="sub">
          Uma pessoa pode ser cliente, fornecedor e vendedor ao mesmo tempo — é um cadastro só,
          com os papéis que ela exerce.
        </p>
      </div>
      <Formulario />
    </main>
  );
}
