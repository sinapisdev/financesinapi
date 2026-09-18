'use client';

import { useActionState, useState } from 'react';
import { salvarEmpresa, type Resultado } from './acoes';

type Ramo = { codigo: string; nome: string };

const TIPO_ROTULO: Record<string, string> = {
  operacional: 'Operacional', spe: 'SPE', holding: 'Holding',
};
const cnpjBR = (v: string | null) =>
  v ? v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—';

function Campos({ empresa, ramos, proximoCodigo }: {
  empresa?: any; ramos: Ramo[]; proximoCodigo: number;
}) {
  return (
    <div className="grade">
      <div className="campo c2">
        <label>Código</label>
        <input name="codigo" type="number" min={1} required
               defaultValue={empresa?.codigo ?? proximoCodigo} />
      </div>
      <div className="campo c7">
        <label>Razão social</label>
        <input name="razao_social" className="maiusculas" required minLength={3}
               defaultValue={empresa?.razao_social ?? ''} />
      </div>
      <div className="campo c3">
        <label>CNPJ</label>
        <input name="cnpj" inputMode="numeric" defaultValue={empresa?.cnpj ?? ''}
               placeholder="Somente números" />
      </div>

      <div className="campo c4">
        <label>Nome fantasia</label>
        <input name="nome_fantasia" className="maiusculas"
               defaultValue={empresa?.nome_fantasia ?? ''} />
      </div>
      <div className="campo c3">
        <label>Tipo societário</label>
        <select name="tipo" defaultValue={empresa?.tipo ?? 'operacional'}>
          <option value="operacional">Operacional</option>
          <option value="spe">SPE — propósito específico</option>
          <option value="holding">Holding</option>
        </select>
      </div>
      <div className="campo c4">
        <label>Ramo de atividade</label>
        <select name="ramo" defaultValue={empresa?.ramo ?? 'outro'}>
          {ramos.map((r) => <option key={r.codigo} value={r.codigo}>{r.nome}</option>)}
        </select>
      </div>

      <div className="campo c12">
        <label className="opcional">
          <input type="checkbox" name="ativo" defaultChecked={empresa ? empresa.ativo : true} />
          Empresa ativa
        </label>
      </div>
    </div>
  );
}

function Linha({ empresa, ramos }: { empresa: any; ramos: Ramo[] }) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarEmpresa, {});
  if (estado.ok && editando) setEditando(false);

  if (editando) {
    return (
      <tr>
        <td colSpan={7}>
          <form action={acao}>
            <input type="hidden" name="id" value={empresa.id} />
            {estado.erro && <div className="erro">{estado.erro}</div>}
            <Campos empresa={empresa} ramos={ramos} proximoCodigo={empresa.codigo} />
            <div className="acoes">
              <button type="button" className="btn-secundario"
                      onClick={() => setEditando(false)}>Cancelar</button>
              <button className="aplicar" disabled={enviando}>
                {enviando ? 'Salvando…' : 'Salvar empresa'}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr style={!empresa.ativo ? { opacity: .55 } : undefined}>
      <td className="num tabular sub">{empresa.codigo}</td>
      <td>
        <div className="desc-linha">
          <span className="desc">{empresa.razao_social}</span>
          <button type="button" className="botao-lapis" onClick={() => setEditando(true)}
                  title="Editar empresa" aria-label="Editar empresa">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5 13l-2.5.5L3 11z" />
            </svg>
          </button>
        </div>
        {empresa.nome_fantasia && <div className="sub">{empresa.nome_fantasia}</div>}
      </td>
      <td className="tabular sub">{cnpjBR(empresa.cnpj)}</td>
      <td><span className="tag tag-transf">{TIPO_ROTULO[empresa.tipo] ?? empresa.tipo}</span></td>
      <td><span className="tag tag-balao">{empresa.ramo_nome}</span></td>
      <td className="num tabular sub">{empresa.centros || '—'}</td>
      <td className="num tabular sub">{empresa.lancamentos || '—'}</td>
    </tr>
  );
}

export default function Lista({ empresas, ramos, proximoCodigo }: {
  empresas: any[]; ramos: Ramo[]; proximoCodigo: number;
}) {
  const [criando, setCriando] = useState(false);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarEmpresa, {});
  if (estado.ok && criando) setCriando(false);

  return (
    <>
      <section className="bloco">
        <div className="bloco-acao">
          <h2>Nova empresa</h2>
          {!criando && (
            <button className="btn-secundario" onClick={() => setCriando(true)}>Adicionar empresa</button>
          )}
        </div>
        {criando ? (
          <form action={acao}>
            {estado.erro && <div className="erro">{estado.erro}</div>}
            <Campos ramos={ramos} proximoCodigo={proximoCodigo} />
            <div className="acoes">
              <button type="button" className="btn-secundario"
                      onClick={() => setCriando(false)}>Cancelar</button>
              <button className="aplicar" disabled={enviando}>
                {enviando ? 'Salvando…' : 'Criar empresa'}
              </button>
            </div>
          </form>
        ) : (
          <div className="dica">
            <strong>Tipo societário</strong> é a estrutura: SPE, holding, operacional — é o que
            importa para consolidar e apurar. <strong>Ramo</strong> é o que a empresa faz, e é o
            que decide quais processos e grupos de item aparecem para ela. São dois eixos
            separados de propósito: uma operacional pode ser varejo, serviços ou financeiro.
          </div>
        )}
      </section>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th className="num">Cód.</th><th>Razão social</th><th>CNPJ</th>
              <th>Tipo</th><th>Ramo</th>
              <th className="num">Centros</th><th className="num">Lanç.</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => <Linha key={e.id} empresa={e} ramos={ramos} />)}
          </tbody>
        </table>
      </div>
    </>
  );
}
