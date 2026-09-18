'use client';

import { useState } from 'react';
import { AREAS, PERFIS, areasDoPerfil, type Mapa, type Nivel } from '@/lib/areas';

const NIVEIS: { v: Nivel; r: string }[] = [
  { v: 'nenhum', r: 'sem acesso' },
  { v: 'ver',    r: 'só ver' },
  { v: 'editar', r: 'ver e editar' },
];

export type Empresa = { id: number; codigo: number; razao_social: string };

/**
 * Perfil + exceções por área + empresas. O perfil só semeia os valores; a
 * partir do primeiro ajuste manual ele vira "personalizado", para a tela
 * nunca mostrar "Financeiro" num acesso que já não é o financeiro padrão.
 */
export default function EditorAcesso({
  papelInicial = 'financeiro', areasIniciais, empresasIniciais = [], empresas, idForm,
}: {
  papelInicial?: string;
  areasIniciais?: Mapa;
  empresasIniciais?: number[];
  empresas: Empresa[];
  idForm: string;
}) {
  const [papel, setPapel] = useState(papelInicial);
  const [areas, setAreas] = useState<Mapa>(areasIniciais ?? areasDoPerfil(papelInicial));
  const [sel, setSel] = useState<number[]>(empresasIniciais);

  function trocarPerfil(novo: string) {
    setPapel(novo);
    if (novo !== 'personalizado') setAreas(areasDoPerfil(novo));
  }

  function ajustarArea(area: string, nivel: Nivel) {
    const proximo = { ...areas, [area]: nivel } as Mapa;
    setAreas(proximo);
    // se o resultado não é mais idêntico a nenhum perfil pronto, é personalizado
    const igual = Object.entries(PERFIS).find(([id]) =>
      id !== 'personalizado' &&
      AREAS.every((a) => areasDoPerfil(id)[a.id] === proximo[a.id]));
    setPapel(igual ? igual[0] : 'personalizado');
  }

  const alternarEmpresa = (id: number) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const nenhumaArea = AREAS.every((a) => areas[a.id] === 'nenhum');

  return (
    <>
      <div className="campo c4">
        <label htmlFor={`papel-${idForm}`}>Perfil</label>
        <select id={`papel-${idForm}`} name="papel" value={papel}
                onChange={(e) => trocarPerfil(e.target.value)}>
          {Object.entries(PERFIS).map(([id, p]) => (
            <option key={id} value={id}>{p.nome}</option>
          ))}
        </select>
        <div className="sub" style={{ marginTop: 4 }}>{PERFIS[papel]?.explica}</div>
      </div>

      <div className="campo c12" style={{ marginTop: 6 }}>
        <label>O que esta pessoa pode fazer</label>
        <div className="tabela-wrap">
          <table className="matriz-acesso">
            <thead>
              <tr>
                <th>Área</th>
                {NIVEIS.map((n) => <th key={n.v} className="num">{n.r}</th>)}
              </tr>
            </thead>
            <tbody>
              {AREAS.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="desc">{a.nome}</div>
                    <div className="sub">{a.detalhe}</div>
                  </td>
                  {NIVEIS.map((n) => (
                    <td key={n.v} className="num">
                      <input
                        type="radio"
                        name={`area_${a.id}`}
                        value={n.v}
                        checked={areas[a.id] === n.v}
                        onChange={() => ajustarArea(a.id, n.v)}
                        aria-label={`${a.nome}: ${n.r}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {nenhumaArea && (
          <div className="sub" style={{ color: 'var(--negativo)', marginTop: 6 }}>
            Nenhuma área liberada — a pessoa entraria e não veria nada.
          </div>
        )}
      </div>

      <div className="campo c12">
        <label>Empresas que esta pessoa enxerga</label>
        <div className="lista-empresas">
          {empresas.map((e) => (
            <label key={e.id} className="check-empresa">
              <input type="checkbox" name="empresa" value={e.id}
                     checked={sel.includes(e.id)}
                     onChange={() => alternarEmpresa(e.id)} />
              <span>{e.codigo} · {e.razao_social}</span>
            </label>
          ))}
        </div>
        <div className="sub" style={{ marginTop: 4 }}>
          {sel.length === 0
            ? 'Nenhuma marcada: enxerga todas as empresas, inclusive o consolidado.'
            : `Enxerga ${sel.length} empresa(s). Quem tem empresa marcada não vê o consolidado.`}
        </div>
      </div>
    </>
  );
}
