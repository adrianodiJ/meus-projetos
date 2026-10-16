import { type IParametros, type Turno, TURNOS } from '../models';
import { dias, dt, iso } from './util';

/** Ajustes manuais do calendário: dia (aaaa-mm-dd) → turno → conta (true) ou não conta (false). */
export type IAjustes = Record<string, Partial<Record<Turno, boolean>>>;

/** Dia em que começa o período de apuração (folha ponto). 1 = mês-calendário. */
export const inicioPeriodo = (par: IParametros): number => {
  const n = Math.round(Number(par.ini) || 1);
  return n < 1 || n > 28 ? 1 : n;
};

/**
 * Período de apuração identificado pelo mês em que começa ("2026-08").
 * Início 1: 01/08 a 31/08. Início 13: 13/08 a 12/09.
 */
export function periodo(ym: string, inicio: number = 1): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  if (inicio <= 1) return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
  return [iso(new Date(y, m - 1, inicio)), iso(new Date(y, m, inicio - 1))];
}

/** Período que contém a data (para abrir o painel no período atual). */
export function periodoDaData(d: Date, inicio: number): string {
  const ref = inicio > 1 && d.getDate() < inicio ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : d;
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Regra da folha ponto:
 * - domingo não conta;
 * - ADM folga todos os sábados;
 * - 1º e 2º turno folgam os 2 primeiros sábados do período (3, se o período tiver 5 sábados).
 */
export function regraPadrao(ini: string, fim: string): Record<string, Record<Turno, boolean>> {
  const lista = dias(ini, fim);
  const sabados = lista.filter((d) => dt(d).getDay() === 6);
  const folgas = sabados.length >= 5 ? 3 : 2;
  const trabalhados: Record<string, boolean> = {};
  sabados.slice(folgas).forEach((d) => (trabalhados[d] = true));
  const mapa: Record<string, Record<Turno, boolean>> = {};
  lista.forEach((d) => {
    const w = dt(d).getDay();
    const turnoOp = w !== 0 && (w !== 6 || !!trabalhados[d]);
    mapa[d] = { ADM: w !== 0 && w !== 6, PRIMEIRO: turnoOp, SEGUNDO: turnoOp };
  });
  return mapa;
}

/** Dias que contam no cálculo: a regra da folha ponto com os ajustes do administrador por cima. */
export function mapaDias(ini: string, fim: string, aj: IAjustes | undefined): Record<string, Record<Turno, boolean>> {
  const mapa = regraPadrao(ini, fim);
  Object.keys(mapa).forEach((d) => {
    const x = aj && aj[d];
    if (!x) return;
    TURNOS.forEach((t) => {
      if (typeof x[t] === 'boolean') mapa[d][t] = x[t] as boolean;
    });
  });
  return mapa;
}

/** Função "o dia conta para o turno?" para qualquer data (usa o período de cada data). */
export function contadorDeDias(par: IParametros): (d: string, t: Turno) => boolean {
  const inicio = inicioPeriodo(par);
  const cache: Record<string, Record<string, Record<Turno, boolean>>> = {};
  return (d: string, t: Turno): boolean => {
    const ym = periodoDaData(dt(d), inicio);
    if (!cache[ym]) {
      const [a, b] = periodo(ym, inicio);
      cache[ym] = mapaDias(a, b, par.aj);
    }
    const x = cache[ym][d];
    return !!x && !!x[t];
  };
}
