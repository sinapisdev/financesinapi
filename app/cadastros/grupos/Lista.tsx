'use client';

import { useActionState, useState } from 'react';
import { salvarGrupo, type Resultado } from './acoes';

type Conta = { id: number; codigo: string; descricao: string };
type Ramo = { codigo: string; nome: string };

const TIPO_ROTULO: Record<string, string> = {
  imovel: 'Imóvel', produto: 'Produto', servico: 'Serviço', outro: 'Outro',
};
const CONTROLE_ROTULO: Record<string, string> = {
  unidade: 'peça única', quantidade: 'por quantidade', nenhum: 'não estoca',
};

function Campos({ grupo, contas, ramos }: { grupo?: any; contas: Conta[]; ramos: Ramo[] }) {
  const opcoes = (atual: number | null) => (
    <>
      <option value="">— sem conta —</option>
      {contas.map((c) => (
        <option key={c.id} value={c.id}>{c.codigo} · {c.descricao}</option>
      ))}
    </>
  );
  return (
    <div className="grade">
      <div className="campo c2">
        <label>Código</label>
        <input name="codigo" className="maiusculas" required defaultValue={grupo?.codigo ?? ''}
               placeholder="MERCADORIA" />
      </div>
      <div className="campo c5">
        <label>Nome</label>
        <input name="nome" className="maiusculas" required minLength={3}
               defaultValue={grupo?.nome ?? ''} placeholder="MERCADORIAS PARA REVENDA" />
      </div>
      <div className="campo c2">
        <label>Tipo</label>
        <select name="tipo" defaultValue={grupo?.tipo ?? 'produto'}>
          {Object.entries(TIPO_ROTULO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>
      <div className="campo c3">
        <label>Como controla o saldo</label>
        <select name="controle" defaultValue={grupo?.controle ?? 'quantidade'}>
          <option value="quantidade">Por quantidade</option>
          <option value="unidade">Peça única</option>
          <option value="nenhum">Não estoca</option>
        </select>
      </div>

      <div className="campo c12">
        <label>Ramos que usam este grupo</label>
        <div className="papeis envolve">
          {ramos.map((r) => (
            <label key={r.codigo}>
              <input type="checkbox" name="ramos" value={r.codigo}
                     defaultChecked={(grupo?.ramos ?? []).includes(r.codigo)} />
              {r.nome}
            </label>
          ))}
        </div>
        <span className="dica">Nenhum marcado = o grupo serve a qualquer negócio.</span>
      </div>

      <div className="campo c12">
        <label>Observação</label>
        <input name="observacao" defaultValue={grupo?.observacao ?? ''} />
      </div>

      <div className="campo c4">
        <label>Conta de estoque (ativo)</label>
        <select name="conta_estoque_id" defaultValue={grupo?.conta_estoque_id ?? ''}>
          {opcoes(grupo?.conta_estoque_id)}
        </select>
      </div>
      <div className="campo c4">
        <label>Conta de receita (venda)</label>
        <select name="conta_receita_id" defaultValue={grupo?.conta_receita_id ?? ''}>
          {opcoes(grupo?.conta_receita_id)}
        </select>
      </div>
      <div className="campo c4">
        <label>Conta de custo (CMV)</label>
        <select name="conta_custo_id" defaultValue={grupo?.conta_custo_id ?? ''}>
          {opcoes(grupo?.conta_custo_id)}
        </select>
      </div>

      <div className="campo c12">
        <label className="opcional">
          <input type="checkbox" name="ativo" defaultChecked={grupo ? grupo.ativo : true} />
          Grupo ativo
        </label>
      </div>
    </div>
  );
}

function Linha({ grupo, contas, ramos }: { grupo: any; contas: Conta[]; ramos: Ramo[] }) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarGrupo, {});
  if (estado.ok && editando) setEditando(false);

  if (editando) {
    return (
      <tr>
        <td colSpan={7}>
          <form action={acao}>
            <input type="hidden" name="id" value={grupo.id} />
            {estado.erro && <div className="erro">{estado.erro}</div>}
            <Campos grupo={grupo} contas={contas} ramos={ramos} />
            <div className="acoes">
              <button type="button" className="btn-secundario"
                      onClick={() => setEditando(false)}>Cancelar</button>
              <button className="aplicar" disabled={enviando}>
                {enviando ? 'Salvando…' : 'Salvar grupo'}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  const faltaConta = grupo.controle !== 'nenhum' && !grupo.conta_estoque;
  return (
    <tr style={!grupo.ativo ? { opacity: .55 } : undefined}>
      <td className="tabular sub">{grupo.codigo}</td>
      <td>
        <div className="desc-linha">
          <span className="desc">{grupo.nome}</span>
          <button type="button" className="botao-lapis" onClick={() => setEditando(true)}
                  title="Editar grupo" aria-label="Editar grupo">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5 13l-2.5.5L3 11z" />
            </svg>
          </button>
        </div>
        {grupo.observacao && <div className="sub">{grupo.observacao}</div>}
      </td>
      <td><span className="tag tag-transf">{TIPO_ROTULO[grupo.tipo] ?? grupo.tipo}</span></td>
      <td className="sub">{grupo.ramos_nome ?? 'todos os ramos'}</td>
      <td className="sub">{CONTROLE_ROTULO[grupo.controle]}</td>
      <td className="sub">
        {faltaConta
          ? <span className="v-saida"><span className="ponto-sem-descricao" /> falta conta de estoque</span>
          : <>
              {grupo.conta_estoque && <div>{grupo.conta_estoque}</div>}
              {grupo.conta_receita && <div className="sub">venda: {grupo.conta_receita}</div>}
              {grupo.conta_custo && <div className="sub">custo: {grupo.conta_custo}</div>}
            </>}
      </td>
      <td className="num tabular sub">{grupo.itens || '—'}</td>
    </tr>
  );
}

export default function Lista({ grupos, contas, ramos }: {
  grupos: any[]; contas: Conta[]; ramos: Ramo[];
}) {
  const [criando, setCriando] = useState(false);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarGrupo, {});
  if (estado.ok && criando) setCriando(false);

  return (
    <>
      <section className="bloco">
        <div className="bloco-acao">
          <h2>Novo grupo</h2>
          {!criando && (
            <button className="btn-secundario" onClick={() => setCriando(true)}>Adicionar grupo</button>
          )}
        </div>
        {criando && (
          <form action={acao}>
            {estado.erro && <div className="erro">{estado.erro}</div>}
            <Campos contas={contas} ramos={ramos} />
            <div className="acoes">
              <button type="button" className="btn-secundario"
                      onClick={() => setCriando(false)}>Cancelar</button>
              <button className="aplicar" disabled={enviando}>
                {enviando ? 'Salvando…' : 'Criar grupo'}
              </button>
            </div>
          </form>
        )}
        {!criando && (
          <div className="dica">
            O grupo é o que liga estoque e contabilidade: ele diz em que conta o item fica
            parado no ativo, em que conta a venda entra e em que conta o custo sai.
            Um negócio novo entra criando os grupos dele — não mexendo nos itens.
          </div>
        )}
      </section>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th><th>Nome</th><th>Tipo</th><th>Ramo</th>
              <th>Controle</th><th>Contas contábeis</th><th className="num">Itens</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => <Linha key={g.id} grupo={g} contas={contas} ramos={ramos} />)}
          </tbody>
        </table>
      </div>
    </>
  );
}
