// Áreas e perfis — só dados, sem acesso a banco. Fica separado de
// lib/permissoes.ts porque componentes de cliente (menu, barra do usuário)
// precisam destes nomes, e não podem importar o driver do Postgres.

export type Nivel = 'nenhum' | 'ver' | 'editar';

export const AREAS = [
  { id: 'painel',        nome: 'Painel',        detalhe: 'números consolidados da empresa' },
  { id: 'movimento',     nome: 'Movimento',     detalhe: 'lançamentos, extrato, transferências' },
  { id: 'contas',        nome: 'Contas',        detalhe: 'a pagar, a receber e baixas' },
  { id: 'estoque',       nome: 'Estoque',       detalhe: 'itens, entrada de nota, grupos' },
  { id: 'cadastros',     nome: 'Cadastros',     detalhe: 'pessoas, centros, contas, formas' },
  { id: 'contabilidade', nome: 'Contabilidade', detalhe: 'DRE contábil e partidas' },
  { id: 'relatorios',    nome: 'Relatórios',    detalhe: 'fluxo de caixa e DRE gerencial' },
  { id: 'administracao', nome: 'Administração', detalhe: 'acessos, convites e empresas' },
] as const;

export type Area = (typeof AREAS)[number]['id'];
export type Mapa = Record<Area, Nivel>;

export const EH_AREA = (v: string): v is Area => AREAS.some((a) => a.id === v);
export const nomeArea = (area: Area) => AREAS.find((a) => a.id === area)?.nome ?? area;

export const mapaVazio = (): Mapa =>
  Object.fromEntries(AREAS.map((a) => [a.id, 'nenhum'])) as Mapa;

/** Perfis prontos. São só um ponto de partida: o admin ajusta por área depois. */
export const PERFIS: Record<string, { nome: string; explica: string; areas: Partial<Mapa> }> = {
  admin: {
    nome: 'Administrador',
    explica: 'Tudo, inclusive criar acessos e empresas.',
    areas: Object.fromEntries(AREAS.map((a) => [a.id, 'editar'])) as Partial<Mapa>,
  },
  financeiro: {
    nome: 'Financeiro',
    explica: 'Lança, baixa e concilia. Não entra na contabilidade nem nos acessos.',
    areas: { painel: 'editar', movimento: 'editar', contas: 'editar',
             estoque: 'ver', cadastros: 'editar', relatorios: 'ver' },
  },
  contabil: {
    nome: 'Contábil',
    explica: 'Fecha a contabilidade e vê o financeiro sem poder alterar.',
    areas: { painel: 'ver', movimento: 'ver', contas: 'ver',
             cadastros: 'ver', contabilidade: 'editar', relatorios: 'ver' },
  },
  obra: {
    nome: 'Obra / Suprimentos',
    explica: 'Cuida do estoque e das notas de entrada; consulta o resto.',
    areas: { painel: 'ver', movimento: 'ver', contas: 'ver',
             estoque: 'editar', cadastros: 'ver' },
  },
  leitura: {
    nome: 'Somente leitura',
    explica: 'Consulta tudo do financeiro, não altera nada.',
    areas: { painel: 'ver', movimento: 'ver', contas: 'ver',
             estoque: 'ver', cadastros: 'ver', relatorios: 'ver' },
  },
  personalizado: {
    nome: 'Personalizado',
    explica: 'Sem padrão: as áreas são escolhidas uma a uma.',
    areas: {},
  },
};

/** Mapa completo de um perfil, com as áreas não citadas fechadas. */
export const areasDoPerfil = (papel: string): Mapa =>
  ({ ...mapaVazio(), ...(PERFIS[papel]?.areas ?? {}) });

const ORDEM: Record<Nivel, number> = { nenhum: 0, ver: 1, editar: 2 };
export const atende = (tem: Nivel, exigido: Nivel) => ORDEM[tem] >= ORDEM[exigido];
