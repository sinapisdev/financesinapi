import { q } from '@/lib/db';
import { exigirEmpresa, nomeCurto } from '@/lib/empresa';
import Formulario from './Formulario';

export const dynamic = 'force-dynamic';

export default async function NovaTransferencia() {
  const ctx = await exigirEmpresa();

  const [contas, empresas] = await Promise.all([
    // saldo por conta = tudo que entrou menos tudo que saiu dela
    q(`select cb.id, cb.apelido as nome, cb.empresa_id,
              coalesce((select sum(mc.valor_com_sinal) from movimento_caixa mc
                         where mc.conta_bancaria_id = cb.id), 0)::float8 as saldo
         from conta_bancaria cb
        where cb.ativo and ($1::bigint is null or cb.empresa_id = $1)
        order by cb.empresa_id, cb.apelido`, [ctx.id]),
    q(`select id, razao_social as nome from empresa where ativo
        and ($1::bigint is null or id = $1) order by codigo`, [ctx.id]),
  ]);

  return (
    <main>
      <div className="cabecalho-pagina">
        <div className="eyebrow">Movimento</div>
        <h1>Nova transferência</h1>
        <p className="sub">
          {ctx.todas ? 'Escolha a empresa' : nomeCurto(ctx.nome)} · dinheiro saindo de uma
          conta e entrando em outra da mesma empresa.
        </p>
      </div>
      <Formulario contas={contas as any} empresaId={ctx.id} empresas={empresas as any} />
    </main>
  );
}
