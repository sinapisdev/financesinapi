import { conviteValido } from './acoes';
import FormConvite from './FormConvite';
import { PERFIS, AREAS, type Mapa } from '@/lib/areas';

export const dynamic = 'force-dynamic';

export default async function Convite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await conviteValido(token);

  if (!c) {
    return (
      <main className="tela-entrar">
        <div className="caixa-entrar">
          <div className="marca-entrar"><b>Silvereng</b><span>Financeiro</span></div>
          <div className="erro" style={{ marginBottom: 16 }}>
            Este convite não vale mais — ou já foi usado, ou venceu, ou foi cancelado.
          </div>
          <p className="sub">Peça um link novo a quem administra o sistema.</p>
          <a className="aplicar" href="/entrar" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
            Ir para a entrada
          </a>
        </div>
      </main>
    );
  }

  const areas = (c.permissoes ?? {}) as Partial<Mapa>;
  const liberadas = AREAS.filter((a) => areas[a.id] && areas[a.id] !== 'nenhum');

  return (
    <main className="tela-entrar">
      <div className="caixa-entrar">
        <div className="marca-entrar"><b>Silvereng</b><span>Financeiro</span></div>

        <p className="sub" style={{ marginBottom: 4 }}>Bem-vindo(a),</p>
        <h2 style={{ margin: '0 0 2px', fontSize: 20 }}>{c.nome}</h2>
        <p className="sub" style={{ marginBottom: 16 }}>{c.email}</p>

        <div className="resumo-convite">
          <div className="sub">Seu acesso: <strong>{PERFIS[c.papel]?.nome ?? c.papel}</strong></div>
          <ul>
            {liberadas.map((a) => (
              <li key={a.id}>
                {a.nome} <span className="sub">— {areas[a.id] === 'editar' ? 'ver e editar' : 'só ver'}</span>
              </li>
            ))}
          </ul>
        </div>

        <FormConvite token={token} email={c.email} />
      </div>
      <p className="rodape-entrar">Grupo Silvereng · acesso restrito</p>
    </main>
  );
}
