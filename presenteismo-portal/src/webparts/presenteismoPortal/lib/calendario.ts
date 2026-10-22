import { type IParametros, type Turno, TURNOS } from '../models';
import { dias, dt, iso } from './util';

/**
 * Dias escolhidos para o cálculo de um mês: dia (aaaa-mm-dd) → turno → conta.
 * Dia ou turno ausente não conta. Os dias podem ser de qualquer mês (a folha ponto de outubro vai
 * de 13/09 a 12/10).
 */
export type IMarcacao = Record<string, Partial<Record<Turno, boolean>>>;

export const FOLHA_DE_PADRAO = 13;
export const FOLHA_ATE_PADRAO = 12;

/** Dias da folha ponto: (de) do mês anterior até (ate) do mês do cálculo. */
export function diasDaFolha(par: IParametros): { de: number; ate: number } {
  const ok = (v: unknown, padrao: number): number => {
    const n = Math.round(Number(v));
    return n >= 1 && n <= 31 ? n : padrao;
  };
  return { de: ok(par.fpDe, FOLHA_DE_PADRAO), ate: ok(par.fpAte, FOLHA_ATE_PADRAO) };
}

/**
 * Folha ponto do mês "2026-10": do dia 13 de setembro ao dia 12 de outubro (com os dias padrão).
 * Vale para qualquer mês escolhido; dia maior que o fim do mês vira o último dia do mês.
 */
export function periodoFolha(ym: string, par: IParametros): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  const { de, ate } = diasDaFolha(par);
  const dia = (ano: number, mes0: number, n: number): string => iso(new Date(ano, mes0, Math.min(n, new Date(ano, mes0 + 1, 0).getDate())));
  return [dia(y, m - 2, de), dia(y, m - 1, ate)];
}

/** Os dias escolhidos para o cálculo do mês (vazio = nenhum dia conta). */
export const marcacaoDoMes = (par: IParametros, ym: string): IMarcacao => (par.cal && par.cal[ym]) || {};

export const conta = (m: IMarcacao, d: string, t: Turno): boolean => !!(m[d] && m[d][t]);

/** Datas com algum turno marcado, em ordem. */
export const diasEscolhidos = (m: IMarcacao): string[] =>
  Object.keys(m)
    .filter((d) => TURNOS.some((t) => conta(m, d, t)))
    .sort();

/** Intervalo do cálculo: a folha ponto do mês, ampliada se algum dia escolhido ficar fora dela. */
export function intervaloDoCalculo(par: IParametros, ym: string): [string, string] {
  const [ini, fim] = periodoFolha(ym, par);
  const lista = diasEscolhidos(marcacaoDoMes(par, ym));
  if (!lista.length) return [ini, fim];
  return [lista[0] < ini ? lista[0] : ini, lista[lista.length - 1] > fim ? lista[lista.length - 1] : fim];
}

/**
 * Regra da folha ponto (aplicada pelo botão, não é mais automática):
 * - domingo não conta;
 * - ADM folga todos os sábados;
 * - 1º e 2º turno folgam os 2 primeiros sábados da folha (3, se a folha tiver 5).
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
