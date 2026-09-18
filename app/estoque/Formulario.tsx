'use client';

import { useActionState, useState } from 'react';
import { salvarItem, type Resultado } from './acoes';

export type Grupo = {
  id: number; codigo: string; nome: string; tipo: string;
  controle: 'unidade' | 'quantidade' | 'nenhum';
  conta_estoque: string | null; conta_receita: string | null; conta_custo: string | null;
  observacao: string | null;
};

export default function Formulario({ item, grupos, empresas, centros, pessoas }: {
  item?: any;
  grupos: Grupo[];
  empresas: { id: number; nome: string }[];
  centros: { id: number; nome: string; empresa_id: number }[];
  pessoas: { id: number; nome: string }[];
}) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarItem, {});
  const [grupoId, setGrupoId] = useState<number>(item?.grupo_id ?? grupos[0]?.id ?? 0);
  const [empresaId, setEmpresaId] = useState<number>(item?.empresa_id ?? empresas[0]?.id ?? 0);

  const grupo = grupos.find((g) => g.id === Number(grupoId));
  const controle = grupo?.controle ?? 'quantidade';
  const ehImovel = grupo?.tipo === 'imovel';
  const novo = !item?.id;

  return (
    <form action={acao}>
      {item?.id && <input type="hidden" name="id" value={item.id} />}
      {estado.erro && <div className="erro">{estado.erro}</div>}

      <section className="bloco">
        <h2>Identificação</h2>
        <div className="grade">
          <div className="campo c4">
            <label htmlFor="empresa_id">Empresa</label>
            <select id="empresa_id" name="empresa_id" required value={empresaId}
                    onChange={(e) => setEmpresaId(Number(e.target.value))}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="campo c4">
            <label htmlFor="grupo_id">Grupo</label>
            <select id="grupo_id" name="grupo_id" required value={grupoId}
                    onChange={(e) => setGrupoId(Number(e.target.value))}>
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
          <div className="campo c3">
            <label htmlFor="codigo">Código / SKU</label>
            <input id="codigo" name="codigo" className="maiusculas"
                   defaultValue={item?.codigo ?? ''} placeholder="Opcional" />
          </div>
          <div className="campo c3">
            <label htmlFor="codigo_barras">Código de barras</label>
            <input id="codigo_barras" name="codigo_barras" className="maiusculas"
                   defaultValue={item?.codigo_barras ?? ''} placeholder="EAN do fornecedor" />
          </div>

          <div className="campo c12">
            <label htmlFor="identificacao">Identificação</label>
            <input id="identificacao" name="identificacao" className="maiusculas" required
                   minLength={3} defaultValue={item?.identificacao ?? ''}
                   placeholder={ehImovel ? 'APARTAMENTO 101 - BLOCO A' : 'SOFÁ RETRÁTIL 3 LUGARES'} />
          </div>
          <div className="campo c12">
            <label htmlFor="descricao">Descrição</label>
            <input id="descricao" name="descricao" className="maiusculas"
                   defaultValue={item?.descricao ?? ''}
                   placeholder="Detalhe que ajude a reconhecer o item (opcional)" />
          </div>
        </div>

        {grupo && (
          <div className="dica">
            {controle === 'unidade' && 'Peça única: o saldo vem da situação — existe enquanto não for vendida.'}
            {controle === 'quantidade' && 'Item contado: o saldo vem das entradas e saídas registradas.'}
            {controle === 'nenhum' && 'Não estoca: usado para serviço e venda sob encomenda. Vai direto para custo.'}
            {grupo.conta_estoque
              ? ` Estoque em ${grupo.conta_estoque}.`
              : controle !== 'nenhum' && ' Este grupo ainda não tem conta de estoque no plano de contas.'}
            {grupo.conta_receita && ` Venda em ${grupo.conta_receita}.`}
          </div>
        )}
      </section>

      <section className="bloco">
        <h2>{controle === 'nenhum' ? 'Preço' : 'Estoque e preço'}</h2>
        <div className="grade">
          {controle === 'quantidade' && (
            <>
              <div className="campo c2">
                <label htmlFor="unidade">Unidade</label>
                <input id="unidade" name="unidade" className="maiusculas"
                       defaultValue={item?.unidade ?? 'UN'} placeholder="UN, M², CX" />
              </div>
              <div className="campo c3">
                <label htmlFor="quantidade_minima">Estoque mínimo</label>
                <input id="quantidade_minima" name="quantidade_minima" inputMode="decimal"
                       defaultValue={item?.quantidade_minima ?? ''} placeholder="0" />
              </div>
            </>
          )}
          <div className="campo c3">
            <label htmlFor="preco_venda">Preço de venda</label>
            <input id="preco_venda" name="preco_venda" inputMode="decimal"
                   defaultValue={item?.preco_venda ?? ''} placeholder="0,00" />
          </div>
          <div className="campo c4">
            <label htmlFor="localizacao">Localização</label>
            <input id="localizacao" name="localizacao" className="maiusculas"
                   defaultValue={item?.localizacao ?? ''}
                   placeholder={ehImovel ? 'ENDEREÇO OU TORRE' : 'SHOWROOM, DEPÓSITO'} />
          </div>

          {novo && controle !== 'nenhum' && (
            <>
              <div className="campo c12">
                <div className="dica">
                  O saldo inicial entra como movimento de entrada, com data de hoje — assim
                  o item já nasce com histórico e o saldo continua sendo o que os movimentos dizem.
                </div>
              </div>
              {controle === 'quantidade' && (
                <div className="campo c3">
                  <label htmlFor="quantidade_inicial">Quantidade inicial</label>
                  <input id="quantidade_inicial" name="quantidade_inicial" inputMode="decimal"
                         placeholder="0" />
                </div>
              )}
              <div className="campo c3">
                <label htmlFor="custo_inicial">
                  {controle === 'unidade' ? 'Custo do item' : 'Custo unitário'}
                </label>
                <input id="custo_inicial" name="custo_inicial" inputMode="decimal" placeholder="0,00" />
              </div>
            </>
          )}
        </div>
      </section>

      {ehImovel && (
        <section className="bloco">
          <h2>Dados do imóvel</h2>
          <div className="grade">
            <div className="campo c3">
              <label htmlFor="bloco">Bloco / torre</label>
              <input id="bloco" name="bloco" className="maiusculas" defaultValue={item?.bloco ?? ''} />
            </div>
            <div className="campo c2">
              <label htmlFor="andar">Andar</label>
              <input id="andar" name="andar" type="number" defaultValue={item?.andar ?? ''} />
            </div>
            <div className="campo c3">
              <label htmlFor="area_privativa">Área privativa (m²)</label>
              <input id="area_privativa" name="area_privativa" inputMode="decimal"
                     defaultValue={item?.area_privativa ?? ''} placeholder="0,00" />
            </div>
          </div>
        </section>
      )}

      <section className="bloco">
        <h2>Situação e vínculos</h2>
        <div className="grade">
          <div className="campo c3">
            <label htmlFor="status">Situação</label>
            <select id="status" name="status" defaultValue={item?.status ?? 'disponivel'}>
              <option value="disponivel">Disponível</option>
              <option value="reservado">Reservado</option>
              <option value="sob_encomenda">Sob encomenda</option>
              <option value="vendido">Vendido</option>
              <option value="permutado">Permutado</option>
              <option value="baixado">Baixado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="campo c4">
            <label htmlFor="centro_custo_id">Centro de custo</label>
            <select id="centro_custo_id" name="centro_custo_id"
                    defaultValue={item?.centro_custo_id ?? ''}>
              <option value="">Nenhum</option>
              {centros.filter((c) => c.empresa_id === Number(empresaId))
                      .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="campo c5">
            <label htmlFor="pessoa_id">Reservado / vendido para</label>
            <select id="pessoa_id" name="pessoa_id" defaultValue={item?.pessoa_id ?? ''}>
              <option value="">Ninguém</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div className="campo c3">
            <label htmlFor="data_entrada">Entrada</label>
            <input id="data_entrada" type="date" name="data_entrada"
                   defaultValue={item?.data_entrada ?? ''} />
          </div>
          <div className="campo c3">
            <label htmlFor="data_saida">Saída</label>
            <input id="data_saida" type="date" name="data_saida"
                   defaultValue={item?.data_saida ?? ''} />
          </div>
          <div className="campo c6">
            <label htmlFor="observacao">Observação</label>
            <input id="observacao" name="observacao" className="maiusculas"
                   defaultValue={item?.observacao ?? ''} />
          </div>

          <div className="campo c12">
            <label className="opcional">
              <input type="checkbox" name="ativo" defaultChecked={item ? item.ativo : true} />
              Item ativo
            </label>
          </div>
        </div>
      </section>

      <div className="acoes">
        <a className="btn-secundario" href={item?.id ? `/estoque/${item.id}` : '/estoque'}>Cancelar</a>
        <button className="aplicar" type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : item?.id ? 'Salvar alterações' : 'Cadastrar item'}
        </button>
      </div>
    </form>
  );
}
