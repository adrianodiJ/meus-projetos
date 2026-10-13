import * as React from 'react';
import styles from './QualityPortal.module.scss';
import { fp } from '../lib/util';

export const COR_OK = '#1e9e3e';
export const COR_RUIM = '#d40511';

export const Anel: React.FC<{ valor: number; ok: boolean }> = ({ valor, ok }) => {
  const r = 54;
  const c = 2 * Math.PI * r;
  const o = c * (1 - Math.max(0, Math.min(100, valor)) / 100);
  return (
    <svg className={styles.anel} viewBox="0 0 140 140" role="img" aria-label={`Presenteísmo do mês ${fp(valor)}`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#eef0f3" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={ok ? COR_OK : COR_RUIM}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={o}
        transform="rotate(-90 70 70)"
      />
      <text className={styles.anelValor} x="70" y="78" textAnchor="middle" style={{ fontSize: 22 }}>
        {fp(valor)}
      </text>
    </svg>
  );
};

/** Barra de progresso com marca da meta. */
export const Trilha: React.FC<{ valor: number | null; meta: number; altura?: number }> = ({ valor, meta, altura }) => {
  const v = valor === null ? 0 : Math.max(0, Math.min(100, valor));
  return (
    <div className={styles.trilha} style={altura ? { height: altura } : undefined}>
      <i style={{ width: `${v}%`, background: valor !== null && valor >= meta ? COR_OK : COR_RUIM }} />
      <b style={{ left: `${meta}%` }} />
    </div>
  );
};

export interface ISemana {
  l: string;
  r: string;
  v: number | null;
}

/** Colunas por semana com a meta tracejada; o eixo começa perto do menor valor. */
export const GraficoSemanal: React.FC<{ semanas: ISemana[]; meta: number }> = ({ semanas, meta }) => {
  const W = 560;
  const Ht = 190;
  const L = 40;
  const R = 10;
  const T = 20;
  const B = 40;
  const vs = semanas.map((x) => x.v).filter((v): v is number => v !== null);
  let lo = Math.max(0, Math.floor(Math.min(meta, ...vs) - 1));
  const sp = 100 - lo;
  const st = sp <= 6 ? 1 : sp <= 14 ? 2 : sp <= 30 ? 5 : 10;
  lo = Math.floor(lo / st) * st;
  const y = (v: number): number => T + (Ht - T - B) * (1 - (Math.max(lo, v) - lo) / (100 - lo));
  const gap = (W - L - R) / Math.max(1, semanas.length);
  const bw = Math.min(54, gap * 0.6);
  const grades: number[] = [];
  for (let t = lo; t <= 100; t += st) grades.push(t);
  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${Ht}`} style={{ width: '100%', minWidth: 360, height: 'auto' }} role="img" aria-label="Presenteísmo por semana">
          {grades.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e4e7eb" />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#616a75">
                {t}%
              </text>
            </g>
          ))}
          {semanas.map((x, i) => {
            const cx = L + gap * i + gap / 2;
            const top = x.v === null ? y(lo) : y(x.v);
            const ok = x.v !== null && x.v >= meta;
            return (
              <g key={x.l}>
                {x.v !== null && (
                  <>
                    <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(2, y(lo) - top)} rx="4" fill={ok ? COR_OK : COR_RUIM} />
                    <text x={cx} y={top - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1f2328">
                      {fp(x.v)}
                    </text>
                  </>
                )}
                <text x={cx} y={Ht - B + 17} textAnchor="middle" fontSize="12" fontWeight="600" fill="#1f2328">
                  {x.l}
                </text>
                <text x={cx} y={Ht - B + 31} textAnchor="middle" fontSize="10" fill="#616a75">
                  {x.r}
                </text>
              </g>
            );
          })}
          <line x1={L} x2={W - R} y1={y(meta)} y2={y(meta)} stroke="#1f2328" strokeDasharray="5 4" opacity=".55" />
        </svg>
      </div>
      <p className={styles.mudo} style={{ margin: '4px 0 0' }}>
        Linha tracejada: meta de {meta}%. Eixo a partir de {lo}%.
      </p>
    </>
  );
};
