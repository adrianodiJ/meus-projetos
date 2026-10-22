import type { IColab, ILancamento, IParametros, Turno } from '../models';
import { MOTIVOS_FALTA } from '../models';
import { conta, diasEscolhidos, intervaloDoCalculo, marcacaoDoMes } from './calendario';
import { dt, ehTemp, semana } from './util';

export interface IFalta {
  u: string;
  d: string;
  m: string;
  o?: string;
}

export interface IBloco {
  w: number;
  /** chave da semana para ordenar e agrupar (ano + semana), pois os dias podem cruzar o ano */
  s: string;
  t: Turno;
  /** horas previstas */
  p: number;
  /** horas de falta */
  f: number;
  a: string;
  b: string;
}

/** Intervalo do cálculo do mês: do primeiro ao último dia escolhido no calendário (podem ser de outros meses). */
export function periodoDoMes(ym: string, par: IParametros): [string, string] {
  return intervaloDoCalculo(par, ym);
}

export function horasDoTurno(par: IParametros, t: Turno): number {
  return Number(par.h[t]) || 0;
}

/** Faltas (injustificadas e atestados) a partir dos lançamentos do período. */
export function faltas(lancs: ILancamento[]): IFalta[] {
  const o: IFalta[] = [];
  lancs.forEach((doc) => {
    const e = doc.e || {};
    Object.keys(e).forEach((u) => {
      const x = e[u];
      if (x && x.p === false && MOTIVOS_FALTA.indexOf(x.m || '') >= 0) o.push({ u, d: doc.d, m: x.m || '', o: x.o });
    });
  });
  return o;
}

/**
 * Horas previstas e de falta por semana e turno, como na planilha:
 * previstas = pessoas × horas do turno × dias que contam; falta = (injustificadas + atestados) × horas do turno.
 */
export function calcular(rows: IColab[], fl: IFalta[], ym: string, par: IParametros): IBloco[] {
  const m = marcacaoDoMes(par, ym);
  const previsto = (d: string, t: Turno): boolean => conta(m, d, t);
  const chaveSemana = (d: string): string => `${d.slice(0, 4)}-${String(semana(d)).padStart(2, '0')}`;
  const R: Record<string, IBloco> = {};
  const ix: Record<string, IColab> = {};
  rows.forEach((r) => (ix[r.u] = r));
  diasEscolhidos(m).forEach((d) => {
    const w = semana(d);
    const s = chaveSemana(d);
    rows.forEach((r) => {
      if (!previsto(d, r.t)) return;
      const k = `${s}|${r.t}`;
      const o = R[k] || (R[k] = { w, s, t: r.t, p: 0, f: 0, a: d, b: d });
      o.p += horasDoTurno(par, r.t);
      if (d < o.a) o.a = d;
      if (d > o.b) o.b = d;
    });
  });
  fl.forEach((f) => {
    const r = ix[f.u];
    if (!r || !previsto(f.d, r.t)) return;
    const o = R[`${chaveSemana(f.d)}|${r.t}`];
    if (o) o.f += horasDoTurno(par, r.t);
  });
  return Object.keys(R).map((k) => R[k]);
}

export const somar = (a: { p: number; f: number }[]): { p: number; f: number } => a.reduce((s, o) => ({ p: s.p + o.p, f: s.f + o.f }), { p: 0, f: 0 });
/** Presenteísmo em % (null sem horas previstas). */
export const pct = (p: number, f: number): number | null => (p ? 100 * (1 - f / p) : null);

export interface IResumoPainel {
  /** efetivos considerados (temporários ficam de fora) */
  rows: IColab[];
  res: IBloco[];
  total: { p: number; f: number };
  /** presenteísmo do mês em % (null sem horas previstas) */
  v: number | null;
  /** faltas do mês em dias que contam */
  faltasMes: IFalta[];
  ix: Record<string, IColab>;
}

export function resumoPainel(equipe: IColab[], lancs: ILancamento[], ym: string, par: IParametros): IResumoPainel {
  const rows = equipe.filter((r) => !ehTemp(r));
  const fl = faltas(lancs);
  const res = calcular(rows, fl, ym, par);
  const total = somar(res);
  const m = marcacaoDoMes(par, ym);
  const ix: Record<string, IColab> = {};
  rows.forEach((r) => (ix[r.u] = r));
  const faltasMes = fl.filter((f) => ix[f.u] && conta(m, f.d, ix[f.u].t));
  return { rows, res, total, v: pct(total.p, total.f), faltasMes, ix };
}

export { dt };
