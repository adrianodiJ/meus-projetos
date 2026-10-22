import { type IParametros, type Turno, TURNOS } from '../models';
import { dias, dt, iso } from './util';

/**
 * Calendário da operação: dia (aaaa-mm-dd) → turno → conta. Dia ou turno ausente não conta.
 * Um só calendário para todos os meses; o cálculo de cada mês usa os dias marcados dentro da folha ponto dele
 * (outubro = 13/09 a 12/10).
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

/**
 * O calendário da operação (dias marcados de todos os meses). Se ainda estiver no formato anterior
 * (dias por mês de cálculo), junta tudo num só.
 */
export function marcacao(par: IParametros): IMarcacao {
  if (par.dias) return par.dias;
  const junto: IMarcacao = {};
  const cal = par.cal || {};
  Object.keys(cal).forEach((ym) =>
    Object.keys(cal[ym]).forEach((d) => {
      TURNOS.forEach((t) => {
        if (cal[ym][d][t]) junto[d] = { ...(junto[d] || {}), [t]: true };
      });
    })
  );
  return junto;
}

export const conta = (m: IMarcacao, d: string, t: Turno): boolean => !!(m[d] && m[d][t]);

/** Datas com algum turno marcado, em ordem. */
export const diasEscolhidos = (m: IMarcacao): string[] =>
  Object.keys(m)
    .filter((d) => TURNOS.some((t) => conta(m, d, t)))
    .sort();

/** Só os dias de uma marcação que caem entre ini e fim. */
export function recorte(m: IMarcacao, ini: string, fim: string): IMarcacao {
  const o: IMarcacao = {};
  Object.keys(m).forEach((d) => {
    if (d >= ini && d <= fim) o[d] = m[d];
  });
  return o;
}

/** Os dias que entram no cálculo do mês: os marcados dentro da folha ponto dele. */
export function marcacaoDoMes(par: IParametros, ym: string): IMarcacao {
  const [ini, fim] = periodoFolha(ym, par);
  return recorte(marcacao(par), ini, fim);
}

/** Intervalo do cálculo do mês = a folha ponto dele. */
export const intervaloDoCalculo = (par: IParametros, ym: string): [string, string] => periodoFolha(ym, par);

/** Mês de cálculo cuja folha ponto contém o dia (ex.: 20/09 → outubro, com a folha 13 a 12). */
export function mesDaFolha(d: string, par: IParametros): string {
  const [y, m] = d.split('-').map(Number);
  for (const n of [0, 1, -1]) {
    const x = new Date(y, m - 1 + n, 1);
    const ym = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
    const [ini, fim] = periodoFolha(ym, par);
    if (d >= ini && d <= fim) return ym;
  }
  return d.slice(0, 7);
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

/** "O dia está marcado para o turno no calendário?" (relatórios que pegam um intervalo livre de datas). */
export function contadorDeDias(par: IParametros): (d: string, t: Turno) => boolean {
  const m = marcacao(par);
  return (d: string, t: Turno): boolean => conta(m, d, t);
}
