'use client';

import { useState } from 'react';

export type Mes = { mes: string; entradas: number; saidas: number };

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const curto = (v: number) =>
  Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  : Math.abs(v) >= 1_000 ? `${Math.round(v / 1_000)}k`
  : String(Math.round(v));
const rotuloMes = (iso: string) => {
  const [a, m] = iso.split('-');
  return ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(m) - 1] +
         (m === '01' ? `/${a.slice(2)}` : '');
};

export default function GraficoMensal({ dados }: { dados: Mes[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);

  if (!dados.length) return <p className="dica">Sem movimento no período.</p>;

  const L = 64, R = 12, T = 16, B = 34;       // margens
  const larg = 860, alt = 260;
  const plotW = larg - L - R, plotH = alt - T - B;

  const maxValor = Math.max(...dados.flatMap(d => [d.entradas, d.saidas]), 1);
  // escala "redonda" para o topo, para a grade cair em números legíveis
  const passo = Math.pow(10, Math.floor(Math.log10(maxValor)));
  const topo = Math.ceil(maxValor / (passo / 2)) * (passo / 2);
  const y = (v: number) => T + plotH - (v / topo) * plotH;

  const larguraGrupo = plotW / dados.length;
  const larguraBarra = Math.min(16, (larguraGrupo - 8) / 2 - 1);  // 2px de respiro entre as barras
  const linhasGrade = [0, 0.25, 0.5, 0.75, 1].map(f => topo * f);

  return (
    <div className="gm-wrap">
      <div className="gm-legenda">
        <span><i style={{ background: 'var(--serie-entrada)' }} />Entradas</span>
        <span><i style={{ background: 'var(--serie-saida)' }} />Saídas</span>
      </div>

      <svg viewBox={`0 0 ${larg} ${alt}`} className="gm-svg" role="img"
           aria-label="Entradas e saídas por mês">
        {linhasGrade.map((v, i) => (
          <g key={i}>
            <line x1={L} x2={larg - R} y1={y(v)} y2={y(v)}
                  stroke="var(--linha)" strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="gm-eixo">{curto(v)}</text>
          </g>
        ))}

        {dados.map((d, i) => {
          const x0 = L + i * larguraGrupo;
          const centro = x0 + larguraGrupo / 2;
          const destacado = ativo === i;
          return (
            <g key={d.mes}
               onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)}>
              {/* alvo de hover maior que as barras */}
              <rect x={x0} y={T} width={larguraGrupo} height={plotH}
                    fill={destacado ? 'var(--navy-suave)' : 'transparent'} opacity={.55} />
              <rect x={centro - larguraBarra - 1} y={y(d.entradas)} width={larguraBarra}
                    height={Math.max(2, plotH + T - y(d.entradas))} rx={3}
                    fill="var(--serie-entrada)" />
              <rect x={centro + 1} y={y(d.saidas)} width={larguraBarra}
                    height={Math.max(2, plotH + T - y(d.saidas))} rx={3}
                    fill="var(--serie-saida)" />
              <text x={centro} y={alt - 12} textAnchor="middle"
                    className={`gm-eixo ${destacado ? 'gm-eixo-forte' : ''}`}>
                {rotuloMes(d.mes)}
              </text>
            </g>
          );
        })}
        <line x1={L} x2={larg - R} y1={T + plotH} y2={T + plotH}
              stroke="var(--linha-forte)" strokeWidth={1} />
      </svg>

      {ativo !== null && (
        <div className="gm-tooltip">
          <strong>{rotuloMes(dados[ativo].mes)}</strong>
          <div><span><i style={{ background: 'var(--serie-entrada)' }} />Entradas</span>
               <b className="tabular">{brl(dados[ativo].entradas)}</b></div>
          <div><span><i style={{ background: 'var(--serie-saida)' }} />Saídas</span>
               <b className="tabular">{brl(dados[ativo].saidas)}</b></div>
          <div className="gm-resultado">
            <span>Resultado</span>
            <b className="tabular">{brl(dados[ativo].entradas - dados[ativo].saidas)}</b>
          </div>
        </div>
      )}
    </div>
  );
}
