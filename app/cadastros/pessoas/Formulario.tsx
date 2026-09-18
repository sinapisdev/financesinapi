'use client';

import { useActionState, useMemo, useState } from 'react';
import { salvarPessoa, type Resultado } from './acoes';
import { soDigitos, documentoValido, formatarDocumento } from '@/lib/documento';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI',
             'PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export default function Formulario({ pessoa }: { pessoa?: any }) {
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarPessoa, {});
  const [tipo, setTipo] = useState(pessoa?.tipo_pessoa ?? 'PJ');
  const [doc, setDoc] = useState(formatarDocumento(pessoa?.cpf_cnpj) === '—' ? '' : formatarDocumento(pessoa?.cpf_cnpj));
  const [papeis, setPapeis] = useState({
    cliente: pessoa?.eh_cliente ?? false,
    fornecedor: pessoa?.eh_fornecedor ?? true,
    vendedor: pessoa?.eh_vendedor ?? false,
  });

  const digitos = soDigitos(doc);
  const docStatus = useMemo(() => {
    if (!digitos) return null;
    if (digitos.length < 11) return { ok: false, texto: 'incompleto' };
    if (!documentoValido(digitos)) return { ok: false, texto: 'dígito verificador não confere' };
    return { ok: true, texto: digitos.length === 11 ? 'CPF válido' : 'CNPJ válido' };
  }, [digitos]);

  const semPapel = !papeis.cliente && !papeis.fornecedor && !papeis.vendedor;

  return (
    <form action={acao}>
      {pessoa?.id && <input type="hidden" name="id" value={pessoa.id} />}
      {estado.erro && <div className="erro">{estado.erro}</div>}

      <section className="bloco">
        <h2>Identificação</h2>
        <div className="grade">
          <div className="campo c2">
            <label htmlFor="tipo_pessoa">Tipo</label>
            <select id="tipo_pessoa" name="tipo_pessoa" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="PJ">Jurídica</option>
              <option value="PF">Física</option>
            </select>
          </div>
          <div className="campo c6">
            <label htmlFor="nome_razao_social">{tipo === 'PF' ? 'Nome completo' : 'Razão social'}</label>
            <input id="nome_razao_social" name="nome_razao_social" className="maiusculas"
                   required minLength={3} defaultValue={pessoa?.nome_razao_social ?? ''} />
          </div>
          <div className="campo c4">
            <label htmlFor="nome_fantasia">{tipo === 'PF' ? 'Apelido' : 'Nome fantasia'}</label>
            <input id="nome_fantasia" name="nome_fantasia" className="maiusculas"
                   defaultValue={pessoa?.nome_fantasia ?? ''} />
          </div>

          <div className="campo c4">
            <label htmlFor="cpf_cnpj">
              {tipo === 'PF' ? 'CPF' : 'CNPJ'}
              {docStatus && (
                <span className={`selo-doc ${docStatus.ok ? 'selo-ok' : 'selo-erro'}`}>{docStatus.texto}</span>
              )}
            </label>
            <input id="cpf_cnpj" name="cpf_cnpj" inputMode="numeric" value={doc}
                   onChange={(e) => setDoc(e.target.value)}
                   placeholder={tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'} />
          </div>
          <div className="campo c4">
            <label htmlFor="rg_ie">{tipo === 'PF' ? 'RG' : 'Inscrição estadual'}</label>
            <input id="rg_ie" name="rg_ie" className="maiusculas" defaultValue={pessoa?.rg_ie ?? ''} />
          </div>
          <div className="campo c4">
            <label>Papéis</label>
            <div className="papeis">
              {([['cliente','Cliente'],['fornecedor','Fornecedor'],['vendedor','Vendedor']] as const).map(([k, rot]) => (
                <label key={k} className={papeis[k] ? 'sel' : ''}>
                  <input type="checkbox" name={`eh_${k}`} checked={papeis[k]}
                         onChange={(e) => setPapeis({ ...papeis, [k]: e.target.checked })} />
                  {rot}
                </label>
              ))}
            </div>
          </div>
        </div>
        {semPapel && (
          <p className="dica erro-texto" style={{ marginTop: 10 }}>
            Marque ao menos um papel — é ele que define onde a pessoa aparece nos lançamentos.
          </p>
        )}
      </section>

      <section className="bloco">
        <h2>Contato e endereço</h2>
        <div className="grade">
          <div className="campo c5">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" defaultValue={pessoa?.email ?? ''} />
          </div>
          <div className="campo c3">
            <label htmlFor="telefone">Telefone</label>
            <input id="telefone" name="telefone" defaultValue={pessoa?.telefone ?? ''} />
          </div>
          <div className="campo c4">
            <label htmlFor="cep">CEP</label>
            <input id="cep" name="cep" inputMode="numeric" defaultValue={pessoa?.cep ?? ''} placeholder="00000-000" />
          </div>
          <div className="campo c6">
            <label htmlFor="endereco">Endereço</label>
            <input id="endereco" name="endereco" className="maiusculas" defaultValue={pessoa?.endereco ?? ''} />
          </div>
          <div className="campo c2">
            <label htmlFor="numero">Número</label>
            <input id="numero" name="numero" defaultValue={pessoa?.numero ?? ''} />
          </div>
          <div className="campo c4">
            <label htmlFor="complemento">Complemento</label>
            <input id="complemento" name="complemento" className="maiusculas" defaultValue={pessoa?.complemento ?? ''} />
          </div>
          <div className="campo c4">
            <label htmlFor="bairro">Bairro</label>
            <input id="bairro" name="bairro" className="maiusculas" defaultValue={pessoa?.bairro ?? ''} />
          </div>
          <div className="campo c5">
            <label htmlFor="cidade">Cidade</label>
            <input id="cidade" name="cidade" className="maiusculas" defaultValue={pessoa?.cidade ?? ''} />
          </div>
          <div className="campo c3">
            <label htmlFor="uf">UF</label>
            <select id="uf" name="uf" defaultValue={pessoa?.uf ?? 'PR'}>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="bloco">
        <h2>Cobrança</h2>
        <div className="grade">
          <div className="campo c3">
            <label htmlFor="juros_percentual">Juros ao mês (%)</label>
            <input id="juros_percentual" name="juros_percentual" inputMode="decimal"
                   defaultValue={pessoa?.juros_percentual ?? '0'} />
          </div>
          <div className="campo c3">
            <label htmlFor="multa_percentual">Multa por atraso (%)</label>
            <input id="multa_percentual" name="multa_percentual" inputMode="decimal"
                   defaultValue={pessoa?.multa_percentual ?? '0'} />
          </div>
          <div className="campo c3">
            <label htmlFor="dias_tolerancia">Dias de tolerância</label>
            <input id="dias_tolerancia" name="dias_tolerancia" type="number" min={0}
                   defaultValue={pessoa?.dias_tolerancia ?? 0} />
          </div>
          <div className="campo c3">
            <label htmlFor="percentual_comissao">Comissão (%)</label>
            <input id="percentual_comissao" name="percentual_comissao" inputMode="decimal"
                   defaultValue={pessoa?.percentual_comissao ?? ''}
                   disabled={!papeis.vendedor} placeholder={papeis.vendedor ? '' : 'só para vendedor'} />
          </div>
        </div>
        <p className="dica" style={{ marginTop: 12 }}>
          Estes valores são a referência da pessoa. Na baixa, juros e multa continuam
          sendo digitados caso a caso — o sistema não calcula sozinho.
        </p>
      </section>

      <div className="acoes">
        <a className="btn-secundario" href="/cadastros/pessoas">Cancelar</a>
        <button className="aplicar" type="submit" disabled={enviando || semPapel}>
          {enviando ? 'Salvando…' : pessoa?.id ? 'Salvar alterações' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
