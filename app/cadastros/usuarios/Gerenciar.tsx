'use client';

import { useActionState, useState } from 'react';
import { salvarUsuario, resetarSenha, type Resultado } from './acoes';

const PAPEL: Record<string, string> = {
  admin: 'Administrador', financeiro: 'Financeiro', leitura: 'Somente leitura',
};

function SenhaGerada({ senha, nome }: { senha: string; nome?: string }) {
  return (
    <div className="sucesso">
      <strong>Acesso de {nome} pronto.</strong> Senha temporária:{' '}
      <code className="senha-temp">{senha}</code><br />
      Passe para a pessoa — ela vai trocar no primeiro acesso.
      <strong> Esta senha não aparece de novo.</strong>
    </div>
  );
}

export default function Gerenciar({ usuarios, souEu }: { usuarios: any[]; souEu: number }) {
  const [novo, setNovo] = useState(false);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(salvarUsuario, {});
  const [reset, acaoReset, resetando] = useActionState<Resultado, FormData>(resetarSenha, {});
  const [editando, setEditando] = useState<number | null>(null);

  return (
    <>
      {estado.senhaTemporaria && <SenhaGerada senha={estado.senhaTemporaria} nome={estado.nome} />}
      {reset.senhaTemporaria && <SenhaGerada senha={reset.senhaTemporaria} nome={reset.nome} />}
      {estado.erro && <div className="erro">{estado.erro}</div>}
      {reset.erro && <div className="erro">{reset.erro}</div>}

      {novo && (
        <section className="bloco">
          <h2>Novo acesso</h2>
          <form action={acao}>
            <div className="grade">
              <div className="campo c4">
                <label htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" required autoFocus />
              </div>
              <div className="campo c5">
                <label htmlFor="nome">Nome</label>
                <input id="nome" name="nome" className="maiusculas" required minLength={3} />
              </div>
              <div className="campo c3">
                <label htmlFor="papel">Papel</label>
                <select id="papel" name="papel" defaultValue="financeiro">
                  <option value="financeiro">Financeiro — lança, baixa, edita</option>
                  <option value="leitura">Leitura — só consulta</option>
                  <option value="admin">Administrador — tudo</option>
                </select>
              </div>
            </div>
            <div className="acoes" style={{ marginTop: 14 }}>
              <button type="button" className="btn-secundario" onClick={() => setNovo(false)}>Cancelar</button>
              <button className="aplicar" disabled={enviando}>
                {enviando ? 'Criando…' : 'Criar acesso'}
              </button>
            </div>
          </form>
        </section>
      )}

      {!novo && (
        <div style={{ marginBottom: 14 }}>
          <button className="aplicar" onClick={() => setNovo(true)}>Novo acesso</button>
        </div>
      )}

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th><th>E-mail</th><th>Papel</th><th>Situação</th>
              <th className="oculta-mobile">Último acesso</th><th className="num"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u: any) => (
              editando === u.id ? (
                <tr key={u.id}>
                  <td colSpan={6}>
                    <form action={acao} className="form-inline" style={{ padding: '4px 0' }}>
                      <input type="hidden" name="id" value={u.id} />
                      <input name="nome" defaultValue={u.nome} className="maiusculas" required />
                      <input name="email" type="email" defaultValue={u.email} required />
                      <select name="papel" defaultValue={u.papel}
                              style={{ height: 34, borderRadius: 6, border: '1px solid var(--linha-forte)', padding: '0 8px' }}>
                        <option value="financeiro">Financeiro</option>
                        <option value="leitura">Leitura</option>
                        <option value="admin">Administrador</option>
                      </select>
                      <select name="ativo" defaultValue={u.ativo ? 'on' : 'off'}
                              style={{ height: 34, borderRadius: 6, border: '1px solid var(--linha-forte)', padding: '0 8px' }}>
                        <option value="on">Ativo</option>
                        <option value="off">Inativo</option>
                      </select>
                      <button className="aplicar pequeno" disabled={enviando}>Salvar</button>
                      <button type="button" className="link-acao" onClick={() => setEditando(null)}>Cancelar</button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={u.id} style={!u.ativo ? { opacity: .55 } : undefined}>
                  <td>
                    <div className="desc">{u.nome}</div>
                    {u.id === souEu && <div className="sub">você</div>}
                  </td>
                  <td className="sub">{u.email}</td>
                  <td>
                    <span className={`tag ${u.papel === 'admin' ? 'tag-alerta'
                      : u.papel === 'leitura' ? 'tag-transf' : 'tag-entrada'}`}>
                      {PAPEL[u.papel]}
                    </span>
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
