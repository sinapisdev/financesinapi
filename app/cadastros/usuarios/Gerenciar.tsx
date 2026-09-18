'use client';

import { useActionState, useState } from 'react';
import {
  criarConvite, cancelarConvite, salvarAcesso, resetarSenha, type Resultado,
} from './acoes';
import EditorAcesso, { type Empresa } from './EditorAcesso';
import { PERFIS, type Mapa } from '@/lib/areas';

type Usuario = {
  id: number; email: string; nome: string; papel: string; ativo: boolean;
  precisa_trocar_senha: boolean; ultimo_acesso: string | null;
  areas: Partial<Mapa>; empresas: number[];
};
type Convite = {
  token: string; email: string; nome: string; papel: string;
  expira: string; vencido: boolean; convidou: string | null;
};

/** O link só existe nesta tela, uma vez. Copiar precisa ser trivial. */
function LinkConvite({ link, nome, expira }: { link: string; nome: string; expira: string }) {
  const [copiou, setCopiou] = useState(false);
  return (
    <div className="sucesso">
      <strong>Convite de {nome} pronto.</strong> Mande este link para a pessoa — ela escolhe a
      própria senha e já entra. Vale até <strong>{expira}</strong> e funciona uma vez só.
      <div className="link-convite">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="aplicar pequeno"
                onClick={() => {
                  navigator.clipboard?.writeText(link).then(() => {
                    setCopiou(true);
                    setTimeout(() => setCopiou(false), 2500);
                  });
                }}>
          {copiou ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

function SenhaGerada({ senha, nome }: { senha: string; nome?: string }) {
  return (
    <div className="sucesso">
      <strong>Senha temporária de {nome}:</strong> <code className="senha-temp">{senha}</code><br />
      Passe para a pessoa — ela troca no primeiro acesso.
      <strong> Esta senha não aparece de novo.</strong>
    </div>
  );
}

export default function Gerenciar({
  usuarios, convites, empresas, souEu,
}: { usuarios: Usuario[]; convites: Convite[]; empresas: Empresa[]; souEu: number }) {
  const [convidando, setConvidando] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);

  const [conv, acaoConvidar, convidandoEnv] = useActionState<Resultado, FormData>(criarConvite, {});
  const [canc, acaoCancelar] = useActionState<Resultado, FormData>(cancelarConvite, {});
  const [salvo, acaoSalvar, salvando] = useActionState<Resultado, FormData>(salvarAcesso, {});
  const [reset, acaoReset, resetando] = useActionState<Resultado, FormData>(resetarSenha, {});

  const erro = conv.erro || canc.erro || salvo.erro || reset.erro;
  const nomeEmpresa = (id: number) => empresas.find((e) => e.id === id)?.razao_social ?? `#${id}`;

  return (
    <>
      {erro && <div className="erro">{erro}</div>}
      {conv.convite && <LinkConvite {...conv.convite} />}
      {reset.senhaTemporaria && <SenhaGerada senha={reset.senhaTemporaria} nome={reset.nome} />}
      {salvo.ok && <div className="sucesso">{salvo.ok}</div>}
      {canc.ok && <div className="sucesso">{canc.ok}</div>}

      {convidando ? (
        <section className="bloco">
          <h2>Convidar pessoa</h2>
          <p className="sub" style={{ marginBottom: 12 }}>
            Você define o que ela pode fazer agora; ela escolhe a senha ao abrir o link.
          </p>
          <form action={acaoConvidar}>
            <div className="grade">
              <div className="campo c4">
                <label htmlFor="nome-conv">Nome</label>
                <input id="nome-conv" name="nome" className="maiusculas" required minLength={3} autoFocus />
              </div>
              <div className="campo c4">
                <label htmlFor="email-conv">E-mail</label>
                <input id="email-conv" name="email" type="email" required
                       placeholder="nome@silvereng.com.br" />
              </div>
              <EditorAcesso empresas={empresas} idForm="conv" />
            </div>
            <div className="acoes" style={{ marginTop: 14 }}>
              <button type="button" className="btn-secundario"
                      onClick={() => setConvidando(false)}>Cancelar</button>
              <button className="aplicar" disabled={convidandoEnv}>
                {convidandoEnv ? 'Gerando…' : 'Gerar convite'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <button className="aplicar" onClick={() => setConvidando(true)}>Convidar pessoa</button>
        </div>
      )}

      {convites.length > 0 && (
        <section className="bloco">
          <h2>Convites abertos</h2>
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Vale até</th><th className="num"></th></tr>
              </thead>
              <tbody>
                {convites.map((c) => (
                  <tr key={c.token} style={c.vencido ? { opacity: .55 } : undefined}>
                    <td className="desc">{c.nome}</td>
                    <td className="sub">{c.email}</td>
                    <td><span className="tag tag-transf">{PERFIS[c.papel]?.nome ?? c.papel}</span></td>
                    <td className="sub tabular">
                      {c.expira}
                      {c.vencido && <div className="sub">vencido — gere outro</div>}
                    </td>
                    <td className="num">
                      <form action={acaoCancelar} style={{ display: 'inline' }}>
                        <input type="hidden" name="token" value={c.token} />
                        <button className="link-acao">Cancelar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th><th>Perfil</th><th>Empresas</th><th>Situação</th>
              <th className="oculta-mobile">Último acesso</th><th className="num"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              editando === u.id ? (
                <tr key={u.id}>
                  <td colSpan={6} style={{ background: 'var(--off-white)' }}>
                    <form action={acaoSalvar}>
                      <input type="hidden" name="id" value={u.id} />
                      <div className="grade">
                        <div className="campo c4">
                          <label htmlFor={`nome-${u.id}`}>Nome</label>
                          <input id={`nome-${u.id}`} name="nome" defaultValue={u.nome}
                                 className="maiusculas" required minLength={3} />
                        </div>
                        <div className="campo c4">
                          <label htmlFor={`email-${u.id}`}>E-mail</label>
                          <input id={`email-${u.id}`} name="email" type="email"
                                 defaultValue={u.email} required />
                        </div>
                        <div className="campo c4">
                          <label htmlFor={`ativo-${u.id}`}>Situação</label>
                          <select id={`ativo-${u.id}`} name="ativo" defaultValue={u.ativo ? 'on' : 'off'}>
                            <option value="on">Ativo</option>
                            <option value="off">Inativo — não consegue entrar</option>
                          </select>
                        </div>
                        <EditorAcesso
                          idForm={String(u.id)}
                          papelInicial={u.papel}
                          areasIniciais={{ ...(Object.fromEntries(
                            Object.entries(u.areas)) as Partial<Mapa>) } as Mapa}
                          empresasIniciais={u.empresas ?? []}
                          empresas={empresas}
                        />
                      </div>
                      <div className="acoes" style={{ marginTop: 14 }}>
                        <button type="button" className="btn-secundario"
                                onClick={() => setEditando(null)}>Cancelar</button>
                        <button className="aplicar" disabled={salvando}>
                          {salvando ? 'Salvando…' : 'Salvar acesso'}
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={u.id} style={!u.ativo ? { opacity: .55 } : undefined}>
                  <td>
                    <div className="desc">{u.nome}</div>
                    <div className="sub">{u.email}{u.id === souEu ? ' · você' : ''}</div>
                  </td>
                  <td>
                    <span className={`tag ${u.papel === 'admin' ? 'tag-alerta' : 'tag-entrada'}`}>
                      {PERFIS[u.papel]?.nome ?? u.papel}
                    </span>
                  </td>
                  <td className="sub">
                    {!u.empresas?.length
                      ? 'todas'
                      : u.empresas.map(nomeEmpresa).join(', ')}
                  </td>
                  <td>
                    {u.ativo ? <span className="tag tag-entrada">ativo</span>
                             : <span className="tag tag-saida">inativo</span>}
                    {u.precisa_trocar_senha && <div className="sub">senha temporária</div>}
                  </td>
                  <td className="sub oculta-mobile tabular">{u.ultimo_acesso ?? 'nunca entrou'}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    <button className="link-acao" onClick={() => setEditando(u.id)}>Editar</button>
                    {' · '}
                    <form action={acaoReset} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="link-acao" disabled={resetando}>Resetar senha</button>
                    </form>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
