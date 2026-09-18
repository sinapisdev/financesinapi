import { usuarioLogado } from '@/lib/auth';
import { redirect } from 'next/navigation';
import FormTrocar from './FormTrocar';

export const dynamic = 'force-dynamic';

export default async function TrocarSenha() {
  const u = await usuarioLogado();
  if (!u) redirect('/entrar');
  return (
    <main className="tela-entrar">
      <div className="caixa-entrar">
        <div className="marca-entrar">
          <b>Silvereng</b>
          <span>Financeiro</span>
        </div>
        <h1 style={{ fontSize: 18, color: 'var(--navy)', marginBottom: 6 }}>
          {u.precisa_trocar_senha ? 'Defina sua senha' : 'Trocar senha'}
        </h1>
        <p className="sub" style={{ marginBottom: 18, fontSize: 13, color: 'var(--aco)' }}>
          {u.precisa_trocar_senha
            ? 'Este é seu primeiro acesso. Escolha uma senha antes de continuar.'
            : `Conectado como ${u.email}.`}
        </p>
        <FormTrocar />
      </div>
    </main>
  );
}
