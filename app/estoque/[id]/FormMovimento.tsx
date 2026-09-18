'use client';

import { useActionState, useState } from 'react';
import { registrarMovimento, type Resultado } from '../acoes';

export default function FormMovimento({ itemId, controle, unidade, centros, pessoas, hoje }: {
  itemId: number;
  controle: 'unidade' | 'quantidade' | 'nenhum';
  unidade: string;
  centros: { id: number; nome: string }[];
  pessoas: { id: number; nome: string }[];
  hoje: string;
}) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(registrarMovimento, {});
  const [tipo, setTipo] = useState('entrada');
  const unico = controle === 'unidade';

  return (
    <form action={acao} className="bloco">
      <h2>Registrar movimento</h2>
      {estado.erro && <div className="erro">{estado.erro}</div>}
      <input type="hidden" name="item_id" value={itemId} />
      {unico && <input type="hidden" name="quantidade" value="1" />}

      <div className="grade">
        <div className="campo c3">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
            <option value="ajuste_entrada">Ajuste — aumentar</option>
            <option value="ajuste_saida">Ajuste — reduzir</option>
          </select>
        </div>
        <div className="campo c2">
          <label htmlFor="data">Data</label>
          <input id="data" name="data" type="date" required defaultValue={hoje} />
        </div>
        {!unico && (
          <div className="campo c2">
            <label htmlFor="quantidade">Quantidade ({unidade})</label>
            <input id="quantidade" name="quantidade" inputMode="decimal" required placeholder="0" />
          </div>
        )}
        <div className="campo c3">
          <label htmlFor="valor_unitario">
            {unico ? 'Valor' : 'Valor unitário'}
          </label>
          <input id="valor_unitario" name="valor_unitario" inputMode="decimal" placeholder="0,00" />
        </div>
        <div className="campo c2">
          <label htmlFor="documento">Documento</label>
          <input id="documento" name="documento" className="maiusculas" placeholder="NF, contrato" />
        </div>

        <div className="campo c12">
          <label htmlFor="historico">Histórico</label>
          <input id="historico" name="historico" className="maiusculas" required minLength={3}
                 placeholder={tipo.startsWith('ajuste')
                   ? 'POR QUE O SALDO ESTAVA ERRADO'
                   : tipo === 'entrada' ? 'COMPRA DE MATERIAL — NF 1234' : 'VENDA PARA CLIENTE X'} />
        </div>

        <div className="campo c4">
          <label htmlFor="centro_custo_id">Centro de custo</label>
          <select id="centro_custo_id" name="centro_custo_id">
            <option value="">Nenhum</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="campo c5">
          <label htmlFor="pessoa_id">Contraparte</label>
          <select id="pessoa_id" name="pessoa_id">
            <option value="">Nenhuma</option>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="campo c3">
          <label htmlFor="lancamento_id">Lançamento nº</label>
          <input id="lancamento_id" name="lancamento_id" type="number"
                 placeholder="id do lançamento" />
        </div>

      </div>

      <div className="acoes">
        <span className="dica" style={{ marginRight: 'auto' }}>
          {tipo.endsWith('saida')
            ? 'Sem valor informado, a saída sai pelo custo atual do item.'
            : 'O valor informado entra no custo médio do item.'}
        </span>
        <button className="aplicar" type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar movimento'}
        </button>
      </div>
    </form>
  );
}
