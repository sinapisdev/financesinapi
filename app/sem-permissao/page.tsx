import { usuarioLogado } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SemPermissao() {
  const u = await usuarioLogado();
  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Acesso</div>
        <h1>Você não tem permissão para esta tela</h1>
        <p className="sub">
          Seu acesso é de <strong>{u?.papel ?? 'visitante'}</strong>. Fale com um administrador
          se precisar de mais permissão.
        </p>
      </div>
      <a className="aplicar" href="/painel">Voltar ao painel</a>
    </main>
  );
}
