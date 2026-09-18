'use client';

import { useActionState, useState } from 'react';
import { entradaEmLote, type Resultado } from '../acoes';

type ItemConhecido = {
  id: number; identificacao: string; codigo: string | null;
  codigo_barras: string | null; grupo_id: number; preco_venda: number | null;
};
type Grupo = { id: number; nome: string; controle: string };
type Linha = { chave: number; ean: string; nome: string; grupoId: number;
               quantidade: string; custo: string; preco: string };

const dec = (v: string) => Number(String(v).replace(/\./g, '').replace(',', '.')) || 0;
/** Devolve o número no formato que o campo espera de volta: 139 vira "139,00". */
const paraCampo = (v: number | null) =>
  v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FormEntrada({ empresas, grupos, centros, pessoas, itens, hoje }: {
  empresas: { id: number; nome: string }[];
  grupos: Grupo[];
  centros: { id: number; nome: string }[];
  pessoas: { id: number; nome: string }[];
  itens: ItemConhecido[];
  hoje: string;
}) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(entradaEmLote, {});
  const grupoPadraoInicial = grupos.find((g) => g.controle === 'quantidade')?.id ?? grupos[0]?.id ?? 0;
  const [grupoPadrao, setGrupoPadrao] = useState(grupoPadraoInicial);
  const nova = (chave: number, grupoId: number): Linha =>
    ({ chave, ean: '', nome: '', grupoId, quantidade: '', custo: '', preco: '' });
  const [linhas, setLinhas] = useState<Linha[]>(
    [0, 1, 2, 3, 4].map((i) => nova(i, grupoPadraoInicial)));
  const [proxima, setProxima] = useState(5);

  const mudar = (chave: number, campo: keyof Linha, valor: string | number) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));

  /** Achou o item? Preenche o resto da linha — é o que faz o leitor de código
   *  de barras valer a pena: bipa, e nome, grupo e preço já vêm. */
  const casar = (chave: number, texto: string, porEan: boolean) => {
    const t = texto.trim().toUpperCase();
    if (!t) return;
    const achado = itens.find((i) => porEan
      ? i.codigo_barras === t
      : i.identificacao.toUpperCase() === t || (i.codigo ?? '').toUpperCase() === t);
    if (!achado) return;
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? {
      ...l,
      nome: achado.identificacao,
      ean: achado.codigo_barras ?? l.ean,
      grupoId: achado.grupo_id,
      preco: l.preco || paraCampo(achado.preco_venda),
    } : l)));
  };

  const preenchidas = linhas.filter((l) => l.nome.trim() && dec(l.quantidade) > 0);
  const total = preenchidas.reduce((s, l) => s + dec(l.quantidade) * dec(l.custo), 0);
  const novos = preenchidas.filter((l) => !itens.some((i) =>
    i.identificacao.toUpperCase() === l.nome.trim().toUpperCase() ||
    (l.ean.trim() && i.codigo_barras === l.ean.trim().toUpperCase()))).length;

  return (
    <form action={acao}>
      {estado.erro && <div className="erro">{estado.erro}</div>}

      <section className="bloco">
        <h2>Nota</h2>
        <div className="grade">
          <div className="campo c3">
            <label htmlFor="empresa_id">Empresa</label>
            <select id="empresa_id" name="empresa_id" required>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="campo c2">
            <label htmlFor="data">Data</label>
            <input id="data" name="data" type="date" required defaultValue={hoje} />
          </div>
          <div className="campo c2">
            <label htmlFor="documento">Documento</label>
            <input id="documento" name="documento" className="maiusculas" placeholder="NF 1234" />
          </div>
          <div className="campo c5">
            <label htmlFor="pessoa_id">Fornecedor</label>
            <select id="pessoa_id" name="pessoa_id">
              <option value="">Nenhum</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div className="campo c4">
            <label htmlFor="centro_custo_id">Centro de custo</label>
            <select id="centro_custo_id" name="centro_custo_id">
              <option value="">Nenhum</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="campo c4">
            <label htmlFor="grupo_padrao">Grupo das linhas novas</label>
            <select id="grupo_padrao" value={grupoPadrao}
                    onChange={(e) => {
                      const g = Number(e.target.value);
                      setGrupoPadrao(g);
                      setLinhas((ls) => ls.map((l) => (l.nome ? l : { ...l, grupoId: g })));
                    }}>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          <div className="campo c4">
            <label htmlFor="lancamento_id">Lançamento da compra</label>
            <input id="lancamento_id" name="lancamento_id" type="number"
                   placeholder="id do lançamento (opcional)" />
          </div>
        </div>
        <div className="dica">
          O item que já existe é reconhecido pelo código de barras, pelo código ou pelo nome
          exato — e recebe a entrada. O que não existe é cadastrado junto com a entrada.
        </div>
      </section>

      <datalist id="itens-conhecidos">
        {itens.map((i) => <option key={i.id} value={i.identificacao} />)}
      </datalist>

      <section className="bloco">
        <div className="bloco-acao">
          <h2>Itens da nota</h2>
          <button type="button" className="btn-secundario"
                  onClick={() => { setLinhas((ls) => [...ls, nova(proxima, grupoPadrao)]);
                                   setProxima((n) => n + 1); }}>
            Adicionar linha
          </button>
        </div>

        <div className="tabela-wrap">
          <table className="tabela-form">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Cód. barras</th>
                <th>Item</th>
                <th style={{ width: 180 }}>Grupo</th>
                <th className="num" style={{ width: 86 }}>Qtd.</th>
                <th className="num" style={{ width: 110 }}>Custo unit.</th>
                <th className="num" style={{ width: 110 }}>Preço venda</th>
                <th className="num" style={{ width: 104 }}>Total</th>
                <th style={{ width: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const totalLinha = dec(l.quantidade) * dec(l.custo);
                return (
                  <tr key={l.chave}>
                    <td>
                      <input name="linha_ean" className="maiusculas" value={l.ean}
                             onChange={(e) => mudar(l.chave, 'ean', e.target.value)}
                             onBlur={(e) => casar(l.chave, e.target.value, true)}
                             placeholder="EAN" />
                    </td>
                    <td>
                      <input name="linha_item" className="maiusculas" value={l.nome}
                             list="itens-conhecidos"
                             onChange={(e) => mudar(l.chave, 'nome', e.target.value)}
                             onBlur={(e) => casar(l.chave, e.target.value, false)}
                             placeholder="VASO CERÂMICA BRANCO 30CM" />
                    </td>
                    <td>
                      <select name="linha_grupo" value={l.grupoId}
                              onChange={(e) => mudar(l.chave, 'grupoId', Number(e.target.value))}>
                        {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                      </select>
                    </td>
                    <td>
                      <input name="linha_quantidade" inputMode="decimal" className="num"
                             value={l.quantidade}
                             onChange={(e) => mudar(l.chave, 'quantidade', e.target.value)}
                             placeholder="0" />
                    </td>
                    <td>
                      <input name="linha_custo" inputMode="decimal" className="num" value={l.custo}
                             onChange={(e) => mudar(l.chave, 'custo', e.target.value)}
                             placeholder="0,00" />
                    </td>
                    <td>
                      <input name="linha_preco" inputMode="decimal" className="num" value={l.preco}
                             onChange={(e) => mudar(l.chave, 'preco', e.target.value)}
                             placeholder="0,00" />
                    </td>
                    <td className="num tabular sub">{totalLinha > 0 ? brl(totalLinha) : '—'}</td>
                    <td>
                      {linhas.length > 1 && (
                        <button type="button" className="link-acao" title="Remover linha"
                                aria-label="Remover linha"
                                onClick={() => setLinhas((ls) =>
                                  ls.filter((x) => x.chave !== l.chave))}>×</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="acoes">
        <span className="dica" style={{ marginRight: 'auto' }}>
          {preenchidas.length === 0
            ? 'Preencha ao menos uma linha com item e quantidade.'
            : `${preenchidas.length} ${preenchidas.length === 1 ? 'linha' : 'linhas'}` +
              `${novos > 0 ? `, ${novos} ${novos === 1 ? 'item novo' : 'itens novos'}` : ''}` +
              ` · total ${brl(total)}`}
        </span>
        <a className="btn-secundario" href="/estoque">Cancelar</a>
        <button className="aplicar" type="submit"
                disabled={enviando || preenchidas.length === 0}>
          {enviando ? 'Dando entrada…' : 'Dar entrada'}
        </button>
      </div>
    </form>
  );
}
