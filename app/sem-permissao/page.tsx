import { usuarioLogado } from '@/lib/auth';
import { permissoesDe, AREAS, PERFIS, type Area } from '@/lib/permissoes';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function SemPermissao({ searchParams }: {
  searchParams: Promise<{ area?: string }>;
}) {
  const u = await usuarioLogado();
  if (!u) redirect('/entrar');

  const { area } = await searchParams;
  const perms = await permissoesDe(u.id);
  const bloqueada = AREAS.find((a) => a.id === area);
  const liberadas = AREAS.filter((a) => perms[a.id as Area] !== 'nenhum');

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Acesso</div>
        <h1>{bloqueada ? `Você não tem acesso a ${bloqueada.nome}` : 'Você não tem permissão para esta tela'}</h1>
        <p className="sub">
          Seu perfil é <strong>{PERFIS[u.papel]?.nome ?? u.papel}</strong>.
          {bloqueada && <> Esta tela faz parte de <strong>{bloqueada.nome}</strong> — {bloqueada.detalhe}.</>}
          {' '}Se você precisa dela para trabalhar, peça a quem administra o sistema.
        </p>
      </div>

      {liberadas.length > 0 ? (
        <section className="bloco">
          <h2>O que você pode abrir</h2>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {liberadas.map((a) => (
              <li key={a.id} style={{ marginBottom: 4, fontSize: 13 }}>
                {a.nome} <span className="sub">— {perms[a.id as Area] === 'editar' ? 'ver e editar' : 'só ver'}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="erro">
          Seu acesso ainda não tem nenhuma área liberada. Fale com quem administra o sistema.
        </div>
      )}

      <a className="aplicar" href={liberadas.length ? '/' : '/entrar'}>
        {liberadas.length ? 'Voltar ao início' : 'Voltar à entrada'}
      </a>
    </main>
  );
}
