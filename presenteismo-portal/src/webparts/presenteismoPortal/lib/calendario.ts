import { type IParametros, type Turno, TURNOS } from '../models';
import { dias, dt, iso } from './util';

/**
 * Dias escolhidos para o cálculo de um mês: dia (aaaa-mm-dd) → turno → conta.
 * Dia ou turno ausente não conta. Os dias podem ser de qualquer mês (ex.: o cálculo de outubro
 * pode usar de 13/09 a 12/10, como na folha ponto).
 */
export type IMarcacao = Record<string, Partial<Record<Turno, boolean>>>;

/** Dia em que começa o período padrão (folha ponto). 1 = mês-calendário. */
export const inicioPeriodo = (par: IParametros): number => {
  const n = Math.round(Number(par.ini) || 1);
  return n < 1 || n > 28 ? 1 : n;
};

/**
 * Período padrão do mês "2026-08" (usado pelo botão "Aplicar regra da folha ponto" e enquanto nenhum dia foi escolhido).
 * Início 1: 01/08 a 31/08. Início 13: 13/08 a 12/09.
 */
export function periodo(ym: string, inicio: number = 1): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  if (inicio <= 1) return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
  return [iso(new Date(y, m - 1, inicio)), iso(new Date(y, m, inicio - 1))];
}

/** Mês de cálculo que contém a data (para abrir o painel no mês atual). */
export function periodoDaData(d: Date, inicio: number): string {
  const ref = inicio > 1 && d.getDate() < inicio ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : d;
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
}

/** Os dias escolhidos para o cálculo do mês (vazio = nenhum dia conta). */
export const marcacaoDoMes = (par: IParametros, ym: string): IMarcacao => (par.cal && par.cal[ym]) || {};

export const conta = (m: IMarcacao, d: string, t: Turno): boolean => !!(m[d] && m[d][t]);

/** Datas com algum turno marcado, em ordem. */
export const diasEscolhidos = (m: IMarcacao): string[] =>
  Object.keys(m)
    .filter((d) => TURNOS.some((t) => conta(m, d, t)))
    .sort();

/** Intervalo do cálculo: do primeiro ao último dia escolhido; sem nenhum, o período padrão do mês. */
export function intervaloDoCalculo(par: IParametros, ym: string): [string, string] {
  const lista = diasEscolhidos(marcacaoDoMes(par, ym));
  return lista.length ? [lista[0], lista[lista.length - 1]] : periodo(ym, inicioPeriodo(par));
}

/**
 * Regra da folha ponto (aplicada pelo botão, não é mais automática):
 * - domingo não conta;
 * - ADM folga todos os sábados;
 * - 1º e 2º turno folgam os 2 primeiros sábados do período (3, se o período tiver 5).
 */
export function regraFolhaPonto(ini: string, fim: string): Record<string, Record<Turno, boolean>> {
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

/** "O dia conta para o turno em algum mês de cálculo?" (relatórios que pegam um intervalo livre de datas). */
export function contadorDeDias(par: IParametros): (d: string, t: Turno) => boolean {
  const cal = par.cal || {};
  return (d: string, t: Turno): boolean => Object.keys(cal).some((ym) => conta(cal[ym], d, t));
}

/** Em quais outros meses de cálculo o dia já foi escolhido (para avisar contagem em dobro). */
export function outrosMeses(par: IParametros, ym: string, d: string): string[] {
  const cal = par.cal || {};
  return Object.keys(cal).filter((x) => x !== ym && TURNOS.some((t) => conta(cal[x], d, t)));
}
