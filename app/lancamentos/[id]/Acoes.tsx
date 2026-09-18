'use client';

import { useActionState, useState } from 'react';
import { estornarBaixa, cancelarLancamento, type Resultado } from '@/app/parcelas/acoes';

export function BotaoEstornar({ baixaId, voltarPara }: { baixaId: number; voltarPara: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(estornarBaixa, {});

  if (!aberto) {
    return <button type="button" className="link-acao" onClick={() => setAberto(true)}>Estornar</button>;
  }
  return (
    <form action={acao} className="form-inline">
      <input type="hidden" name="baixa_id" value={baixaId} />
      <input type="hidden" name="voltar_para" value={voltarPara} />
      <input name="motivo" className="maiusculas" placeholder="Motivo do estorno" required autoFocus />
      <button className="aplicar pequeno" disabled={enviando}>{enviando ? '…' : 'Confirmar'}</button>
      <button type="button" className="link-acao" onClick={() => setAberto(false)}>Cancelar</button>
      {estado.erro && <span className="erro-inline">{estado.erro}</span>}
    </form>
  );
}

export function BotaoCancelarLancamento({ lancamentoId }: { lancamentoId: number }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState<Resultado, FormData>(cancelarLancamento, {});

  if (!aberto) {
    return <button type="button" className="btn-perigo" onClick={() => setAberto(true)}>Cancelar lançamento</button>;
  }
  return (
    <div className="bloco-acao">
      <form action={acao} className="form-inline">
        <input type="hidden" name="lancamento_id" value={lancamentoId} />
        <input name="motivo" className="maiusculas" placeholder="Por que está cancelando?" required autoFocus style={{ minWidth: 260 }} />
        <button className="btn-perigo" disabled={enviando}>{enviando ? 'Cancelando…' : 'Confirmar cancelamento'}</button>
        <button type="button" className="link-acao" onClick={() => setAberto(false)}>Voltar</button>
      </form>
      {estado.erro && <div className="erro" style={{ marginTop: 10, marginBottom: 0 }}>{estado.erro}</div>}
    </div>
  );
}
