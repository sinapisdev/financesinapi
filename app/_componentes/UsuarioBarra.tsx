'use client';

import { sair } from '@/app/entrar/acoes';

const PAPEL = { admin: 'Administrador', financeiro: 'Financeiro', leitura: 'Somente leitura' } as const;

export default function UsuarioBarra({ nome, papel }: { nome: string; papel: keyof typeof PAPEL }) {
  const inicial = nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return (
    <div className="usuario-barra">
      <span className="ub-inicial" aria-hidden="true">{inicial}</span>
      <span className="ub-dados">
        <strong title={nome}>{nome}</strong>
        <span>{PAPEL[papel] ?? papel}</span>
      </span>
      <form action={sair}>
        <button className="ub-sair" type="submit" title="Sair" aria-label="Sair">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6M10.5 11 14 8l-3.5-3M14 8H6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
