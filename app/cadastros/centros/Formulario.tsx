'use client';

import { useActionState } from 'react';
import { salvarCentro, type Resultado } from './acoes';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI',
             'PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function Formulario({ centro, empresas, proximoCodigo }: {
  centro?: any; empresas: { id: number; nome: string }[]; proximoCodigo: number;
}) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarCentro, {});
  return (
    <form action={acao}>
      {centro?.id && <input type="hidden" name="id" value={centro.id} />}
      {estado.erro && <div className="erro">{estado.erro}</div>}

      <section className="bloco">
        <h2>Centro de custo</h2>
        <div className="grade">
          <div className="campo c2">
            <label htmlFor="codigo">Código</label>
            <input id="codigo" name="codigo" type="number" min={1} required
                   defaultValue={centro?.codigo ?? proximoCodigo} />
          </div>
          <div className="campo c6">
            <label htmlFor="nome">Nome</label>
            <input id="nome" name="nome" className="maiusculas" required minLength={3}
                   defaultValue={centro?.nome ?? ''} placeholder="Ex.: EDIFICIO RESIDENCIAL X" />
          </div>
          <div className="campo c4">
            <label htmlFor="empresa_id">Empresa</label>
            <select id="empresa_id" name="empresa_id" required defaultValue={centro?.empresa_id ?? ''}>
              <option value="">Escolha…</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>

          <div className="campo c3">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={centro?.tipo ?? 'obra'}>
              <option value="obra">Obra</option>
              <option value="projeto">Projeto</option>
              <option value="administrativo">Administrativo</option>
              <option value="incorporadora">Incorporadora</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div className="campo c3">
            <label htmlFor="status">Situação</label>
            <select id="status" name="status" defaultValue={centro?.status ?? 'planejada'}>
              <option value="planejada">Planejada</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div className="campo c3">
            <label htmlFor="tipo_imovel">Tipo de imóvel</label>
            <input id="tipo_imovel" name="tipo_imovel" className="maiusculas"
                   defaultValue={centro?.tipo_imovel ?? ''} placeholder="APARTAMENTO, TERRENO…" />
          </div>
          <div className="campo c3">
            <label htmlFor="qtd_unidades">Unidades</label>
            <input id="qtd_unidades" name="qtd_unidades" type="number" min={0}
                   defaultValue={centro?.qtd_unidades ?? ''} />
          </div>

          <div className="campo c5">
            <label htmlFor="cidade">Cidade</label>
            <input id="cidade" name="cidade" className="maiusculas" defaultValue={centro?.cidade ?? ''} />
          </div>
          <div className="campo c2">
            <label htmlFor="uf">UF</label>
            <select id="uf" name="uf" defaultValue={centro?.uf ?? 'PR'}>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="campo c5"></div>

          <div className="campo c3">
            <label htmlFor="vgv_estimado">VGV estimado</label>
            <input id="vgv_estimado" name="vgv_estimado" inputMode="decimal"
                   defaultValue={centro?.vgv_estimado ?? ''} placeholder="0,00" />
          </div>
          <div className="campo c3">
            <label htmlFor="custo_estimado">Custo estimado</label>
            <input id="custo_estimado" name="custo_estimado" inputMode="decimal"
                   defaultValue={centro?.custo_estimado ?? ''} placeholder="0,00" />
          </div>
          <div className="campo c3">
            <label htmlFor="data_inicio_prevista">Início previsto</label>
            <input id="data_inicio_prevista" type="date" name="data_inicio_prevista"
                   defaultValue={centro?.data_inicio_prevista ?? ''} />
          </div>
          <div className="campo c3">
            <label htmlFor="data_fim_prevista">Fim previsto</label>
            <input id="data_fim_prevista" type="date" name="data_fim_prevista"
                   defaultValue={centro?.data_fim_prevista ?? ''} />
          </div>
        </div>
      </section>

      <div className="acoes">
        <a className="btn-secundario" href="/cadastros/centros">Cancelar</a>
        <button className="aplicar" type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : centro?.id ? 'Salvar alterações' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
