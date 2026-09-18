import { usuarioLogado } from '@/lib/auth';
import { redirect } from 'next/navigation';
import FormEntrar from './FormEntrar';

export const dynamic = 'force-dynamic';

export default async function Entrar() {
  if (await usuarioLogado()) redirect('/');
  return (
    <main className="tela-entrar">
      <div className="caixa-entrar">
        <div className="marca-entrar">
          <b>Silvereng</b>
          <span>Financeiro</span>
        </div>
        <FormEntrar />
      </div>
      <p className="rodape-entrar">Grupo Silvereng · acesso restrito</p>
    </main>
  );
}
