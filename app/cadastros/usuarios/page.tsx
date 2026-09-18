import { q } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import { exigirPapel } from '@/lib/auth';
import Gerenciar from './Gerenciar';

export const dynamic = 'force-dynamic';

export default async function Usuarios() {
  await exigirEmpresa();
  const eu = await exigirPapel(['admin']);

  const usuarios = await q(`
    select id, email, nome, papel, ativo, precisa_trocar_senha,
           to_char(ultimo_acesso, 'DD/MM/YYYY HH24:MI') as ultimo_acesso
      from usuario order by ativo desc, nome`);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Administração</div>
        <h1>Acessos</h1>
        <p className="sub">
          {usuarios.length} acesso(s). Senha nova é sempre temporária — quem recebe troca no
          primeiro login, e ninguém além da pessoa conhece a definitiva.
        </p>
      </div>
      <Gerenciar usuarios={usuarios as any} souEu={eu.id} />
    </main>
  );
}
