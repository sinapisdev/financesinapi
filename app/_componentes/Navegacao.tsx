'use client';
import { usePathname } from 'next/navigation';
import { atende, type Area, type Mapa, type Nivel } from '@/lib/areas';

const Icone = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const ICONES = {
  painel:      'M3 11h5v6H3zM8 5h5v12H8zM13 8h4v9h-4z',
  lancamentos: 'M6 3h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h4M8 10h4M8 13h2',
  extrato:     'M3 5h14M3 10h14M3 15h9M16 13v4M14 15h4',
  transferir:  'M4 7h10M11 4l3 3-3 3M16 13H6M9 10l-3 3 3 3',
  fluxo:       'M3 14l4-5 3 3 4-6 3 4M3 17h14',
  dre:         'M5 3h10v14H5zM8 7h4M8 10h4M8 13h2',
  pessoas:     'M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 16c0-2.5 2.2-4 5-4s5 1.5 5 4M13 5.5a2 2 0 1 1 0 4M14 16c0-2 .6-3.2-1-4',
  centros:     'M3 17V8l7-5 7 5v9M8 17v-5h4v5',
  contas:      'M3 7h14v9H3zM3 7l7-4 7 4M6 12h3',
  formas:      'M2 6h16v9H2zM2 9h16M5 12h3',
  acessos:     'M10 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM4 17c0-3 2.7-5 6-5s6 2 6 5',
  receber:     'M10 14V4M10 4 6 8M10 4l4 4M3 16h14',
  pagar:       'M10 4v10M10 14l-4-4M10 14l4-4M3 17h14',
  estoque:     'M3 6.5 10 3l7 3.5v7L10 17l-7-3.5zM3 6.5 10 10l7-3.5M10 10v7',
  grupos:      'M3 4h6v6H3zM11 4h6v6h-6zM3 12h6v5H3zM11 12h6v5h-6z',
  entrada:     'M10 3v9M10 12l-3.5-3.5M10 12l3.5-3.5M3 15h14v2H3z',
  empresas:    'M3 17V6l6-3v14M9 17h8V9l-8-3M12 9.5h2M12 12.5h2',
} as const;

// Cada item declara a área e o nível que ele exige. O menu mostra só o que a
// pessoa consegue abrir — link para tela que dá "sem permissão" é ruído.
const SECOES: {
  titulo: string;
  itens: { href: string; texto: string; icone: string; area: Area; nivel?: Nivel }[];
}[] = [
  { titulo: 'Visão', itens: [
    { href: '/painel', texto: 'Painel', icone: ICONES.painel, area: 'painel' },
  ]},
  { titulo: 'Movimento', itens: [
    { href: '/lancamentos', texto: 'Lançamentos', icone: ICONES.lancamentos, area: 'movimento' },
    { href: '/extrato',     texto: 'Extrato',     icone: ICONES.extrato, area: 'movimento' },
    { href: '/transferencias', texto: 'Transferências', icone: ICONES.transferir, area: 'movimento' },
  ]},
  { titulo: 'Contas', itens: [
    { href: '/receber', texto: 'A receber', icone: ICONES.receber, area: 'contas' },
    { href: '/pagar',   texto: 'A pagar',   icone: ICONES.pagar, area: 'contas' },
  ]},
  { titulo: 'Estoque', itens: [
    { href: '/estoque', texto: 'Itens', icone: ICONES.estoque, area: 'estoque' },
    { href: '/estoque/entrada', texto: 'Entrada de nota', icone: ICONES.entrada, area: 'estoque', nivel: 'editar' },
    { href: '/cadastros/grupos', texto: 'Grupos de item', icone: ICONES.grupos, area: 'estoque' },
  ]},
  { titulo: 'Cadastros', itens: [
    { href: '/cadastros/pessoas', texto: 'Clientes e fornec.', icone: ICONES.pessoas, area: 'cadastros' },
    { href: '/cadastros/centros', texto: 'Centros de custo',  icone: ICONES.centros, area: 'cadastros' },
    { href: '/cadastros/contas',  texto: 'Contas bancárias',  icone: ICONES.contas, area: 'cadastros' },
    { href: '/cadastros/formas',  texto: 'Formas de pagto',   icone: ICONES.formas, area: 'cadastros' },
    { href: '/cadastros/empresas', texto: 'Empresas',         icone: ICONES.empresas, area: 'administracao' },
  ]},
  { titulo: 'Administração', itens: [
    { href: '/cadastros/usuarios', texto: 'Acessos', icone: ICONES.acessos, area: 'administracao', nivel: 'editar' },
  ]},
  { titulo: 'Relatórios', itens: [
    { href: '/relatorios/fluxo', texto: 'Fluxo de caixa', icone: ICONES.fluxo, area: 'relatorios' },
    { href: '/relatorios/dre',   texto: 'DRE contábil',   icone: ICONES.dre, area: 'contabilidade' },
    { href: '/relatorios/dre-gerencial', texto: 'DRE gerencial', icone: ICONES.dre, area: 'relatorios' },
  ]},
];

export default function Navegacao({ perms }: { perms: Mapa }) {
  const rota = usePathname();
  const ativo = (href: string) => rota === href || rota.startsWith(href + '/');

  // seção sem nenhum item liberado some junto com o título
  const secoes = SECOES
    .map((s) => ({ ...s, itens: s.itens.filter((i) => atende(perms[i.area], i.nivel ?? 'ver')) }))
    .filter((s) => s.itens.length > 0);

  return (
    <nav>
      {secoes.map((secao) => (
        <div key={secao.titulo}>
          <div className="grupo-nav">{secao.titulo}</div>
          {secao.itens.map((item) => (
            <a key={item.href} href={item.href}
               className={ativo(item.href) ? 'ativo' : ''}
               aria-current={ativo(item.href) ? 'page' : undefined}>
              <Icone d={item.icone} />
              {item.texto}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
