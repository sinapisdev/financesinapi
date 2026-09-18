import './globals.css';
import type { Metadata } from 'next';
import Navegacao from './_componentes/Navegacao';
import UsuarioBarra from './_componentes/UsuarioBarra';
import { empresaAtiva, nomeCurto } from '@/lib/empresa';
import { usuarioLogado } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Financeiro · Grupo Silvereng',
  description: 'Sistema financeiro e contábil do Grupo Silvereng',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioLogado();
  const ctx = usuario ? await empresaAtiva() : null;
  // sem usuário (login, troca de senha) ou sem empresa: só o conteúdo
  const comBarra = !!usuario && !!ctx;

  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" />
      </head>
      <body>
        {!comBarra ? (
          <div className="conteudo">{children}</div>
        ) : (
          <div className="app">
            <aside className="sidebar">
              <div className="logo">
                <b>Silvereng</b>
                <span>Financeiro</span>
              </div>

              <a className="seletor-empresa" href="/empresa">
                <span className="se-rotulo">{ctx!.todas ? 'Visão' : 'Empresa'}</span>
                <strong>{ctx!.todas ? 'Todas as empresas' : nomeCurto(ctx!.nome)}</strong>
                <span className="se-trocar">trocar</span>
              </a>

              <Navegacao />
              <UsuarioBarra nome={usuario!.nome} papel={usuario!.papel} />
            </aside>
            <div className="conteudo">{children}</div>
          </div>
        )}
      </body>
    </html>
  );
}
