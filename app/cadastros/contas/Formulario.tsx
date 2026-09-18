'use client';

import { useActionState, useState } from 'react';
import { salvarConta, type Resultado } from './acoes';

type Opcao = { id: number; nome: string; empresa_id?: number };

export default function Formulario({ conta, empresas, centros, contasContabeis }: {
  conta?: any; empresas: Opcao[]; centros: Opcao[]; contasContabeis: { id: number; codigo: string; descricao: string }[];
}) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarConta, {});
  const [tipo, setTipo] = useState(conta?.tipo ?? 'corrente');
  const [empresaId, setEmpresaId] = useState(String(conta?.empresa_id ?? empresas[0]?.id ?? ''));
  const ehCaixa = tipo === 'caixa_fisico';

  return (
    <form action={acao}>
      {conta?.id && <input type="hidden" name="id" value={conta.id} />}
      {estado.erro && <div className="erro">{estado.erro}</div>}

      <section className="bloco">
        <h2>Conta</h2>
        <div className="grade">
          <div className="campo c4">
            <label htmlFor="apelido">Apelido</label>
            <input id="apelido" name="apelido" className="maiusculas" required
                   defaultValue={conta?.apelido ?? ''} placeholder="SICOOB OBRAS" />
          </div>
          <div className="campo c5">
            <label htmlFor="instituicao">Instituição</label>
            <input id="instituicao" name="instituicao" className="maiusculas" required
                   defaultValue={conta?.instituicao ?? ''} placeholder="BANCO COOPERATIVO SICOOB" />
          </div>
          <div className="campo c3">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="corrente">Conta corrente</option>
              <option value="poupanca">Poupança</option>
              <option value="aplicacao">Aplicação</option>
              <option value="caixa_fisico">Caixa físico</option>
            </select>
          </div>

          <div className="campo c2">
            <label htmlFor="codigo_bacen">Cód. banco</label>
            <input id="codigo_bacen" name="codigo_bacen" defaultValue={conta?.codigo_bacen ?? ''}
                   placeholder="756" disabled={ehCaixa} />
          </div>
          <div className="campo c2">
            <label htmlFor="agencia">Agência</label>
            <input id="agencia" name="agencia" defaultValue={conta?.agencia ?? ''}
                   required={!ehCaixa} disabled={ehCaixa} />
          </div>
          <div className="campo c3">
            <label htmlFor="numero_conta">Conta</label>
            <input id="numero_conta" name="numero_conta" defaultValue={conta?.numero_conta ?? ''}
                   required={!ehCaixa} disabled={ehCaixa} />
          </div>
          <div className="campo c5">
            <label htmlFor="empresa_id">Empresa</label>
            <select id="empresa_id" name="empresa_id" value={empresaId}
                    onChange={(e) => setEmpresaId(e.target.value)} required>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        </div>
        {ehCaixa && (
          <p className="dica" style={{ marginTop: 10 }}>
            Caixa físico não tem agência nem conta — serve para dinheiro em espécie.
          </p>
        )}
      </section>

      <section className="bloco">
        <h2>Vínculos e saldo</h2>
        <div className="grade">
          <div className="campo c5">
            <label htmlFor="centro_custo_id">Centro de custo dedicado</label>
            <select id="centro_custo_id" name="centro_custo_id" defaultValue={conta?.centro_custo_id ?? ''}>
              <option value="">— nenhum</option>
              {centros.filter(c => !c.empresa_id || String(c.empresa_id) === empresaId)
                      .map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="campo c7">
            <label htmlFor="conta_contabil_id">Conta contábil</label>
            <select id="conta_contabil_id" name="conta_contabil_id" defaultValue={conta?.conta_contabil_id ?? ''}>
              <option value="">— nenhuma</option>
              {contasContabeis.map(c => (
                <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}</option>
              ))}
            </select>
          </div>
          <div className="campo c3">
            <label htmlFor="saldo_inicial">Saldo inicial</label>
            <input id="saldo_inicial" name="saldo_inicial" inputMode="decimal"
                   defaultValue={conta?.saldo_inicial ?? '0'} />
          </div>
          <div className="campo c3">
            <label htmlFor="data_saldo_inicial">Data do saldo</label>
            <input id="data_saldo_inicial" type="date" name="data_saldo_inicial"
                   defaultValue={conta?.data_saldo_inicial ?? ''} />
          </div>
          <div className="campo c3">
            <label htmlFor="ativo">Situação</label>
            <select id="ativo" name="ativo" defaultValue={conta?.ativo === false ? 'off' : 'on'}>
              <option value="on">Ativa</option>
              <option value="off">Inativa</option>
            </select>
          </div>
        </div>
        <p className="dica" style={{ marginTop: 12 }}>
          Hoje todas as contas apontam para <strong>1.1.1.02</strong>, que é a única conta de caixa
          usada no histórico. Na reestruturação contábil, cada banco pode ganhar a sua.
        </p>
      </section>

      <div className="acoes">
        <a className="btn-secundario" href="/cadastros/contas">Cancelar</a>
        <button className="aplicar" type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : conta?.id ? 'Salvar alterações' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
