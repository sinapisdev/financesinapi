import { q } from '@/lib/db';
import { exigirEmpresa } from '@/lib/empresa';
import { exigirArea } from '@/lib/permissoes';
import Gerenciar from './Gerenciar';

export const dynamic = 'force-dynamic';

export default async function Usuarios() {
  await exigirEmpresa('administracao');
  const { usuario: eu } = await exigirArea('administracao', 'editar');

  // Áreas e empresas vêm agregadas: uma consulta por usuário multiplicaria
  // linhas e faria a tela crescer em consultas conforme a equipe crescesse.
  const usuarios = await q(`
    select u.id, u.email, u.nome, u.papel, u.ativo, u.precisa_trocar_senha,
           to_char(u.ultimo_acesso, 'DD/MM/YYYY HH24:MI') as ultimo_acesso,
           coalesce((select jsonb_object_agg(p.area, p.nivel)
                       from usuario_permissao p where p.usuario_id = u.id), '{}'::jsonb) as areas,
           coalesce((select array_agg(ue.empresa_id)
                       from usuario_empresa ue where ue.usuario_id = u.id), '{}') as empresas
      from usuario u
     order by u.ativo desc, u.nome`);

  const convites = await q(`
    select c.token, c.email, c.nome, c.papel,
           to_char(c.expira_em, 'DD/MM/YYYY') as expira,
           c.expira_em < now() as vencido,
           a.nome as convidou
      from convite c
      left join usuario a on a.id = c.criado_por
     where c.usado_em is null and c.cancelado_em is null
     order by c.criado_em desc`);

  const empresas = await q(
    `select id, codigo, razao_social from empresa where ativo order by codigo`);

  const ativos = usuarios.filter((u: any) => u.ativo).length;

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Administração</div>
        <h1>Acessos</h1>
        <p className="sub">
          {ativos} acesso(s) ativo(s){convites.length ? ` · ${convites.length} convite(s) aberto(s)` : ''}.
          Ninguém define a senha de ninguém: você envia um convite e a pessoa escolhe a dela.
        </p>
      </div>
      <Gerenciar
        usuarios={usuarios as any}
        convites={convites as any}
        empresas={empresas as any}
        souEu={eu.id}
      />
    </main>
  );
}
