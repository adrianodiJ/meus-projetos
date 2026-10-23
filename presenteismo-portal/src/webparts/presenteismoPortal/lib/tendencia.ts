import type { IColab, ILancamento, IParametros } from '../models';
import { resumoPainel } from './calculo';
import { diasEscolhidos, marcacaoDoMes, periodoFolha } from './calendario';

/** Um mês da tendência: a mesma conta do Painel, na folha ponto daquele mês. */
export interface IPontoTendencia {
  ym: string;
  /** folha ponto do mês */
  ini: string;
  fim: string;
  /** presenteísmo em % (null: nenhum dia marcado na folha) */
  v: number | null;
  /** horas previstas e de falta */
  p: number;
  f: number;
  /** faltas (injustificadas + atestados) nos dias marcados */
  faltas: number;
  /** dias marcados no calendário dentro da folha */
  dias: number;
  /** folha ainda em andamento (hoje está dentro dela) */
  parcial: boolean;
}

/** Os n meses que terminam em ym, do mais antigo ao mais novo ("2025-11" … "2026-10"). */
export function mesesAte(ym: string, n: number): string[] {
  const [y, m] = ym.split('-').map(Number);
  const o: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(y, m - 1 - i, 1);
    o.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return o;
}

/** Intervalo de datas que cobre as folhas dos n meses (para buscar os lançamentos de uma vez). */
export function intervaloTendencia(ym: string, n: number, par: IParametros): [string, string] {
  const meses = mesesAte(ym, n);
  return [periodoFolha(meses[0], par)[0], periodoFolha(meses[meses.length - 1], par)[1]];
}

/**
 * Presenteísmo de cada mês, calculado igual ao Painel (efetivos do headcount atual, dias marcados na folha,
 * só injustificadas e atestados).
 */
export function calcularTendencia(equipe: IColab[], lancs: ILancamento[], ym: string, n: number, par: IParametros, hoje: string): IPontoTendencia[] {
  return mesesAte(ym, n).map((mes) => {
    const [ini, fim] = periodoFolha(mes, par);
    const r = resumoPainel(equipe, lancs, mes, par);
    return {
      ym: mes,
      ini,
      fim,
      v: r.v,
      p: r.total.p,
      f: r.total.f,
      faltas: r.faltasMes.length,
      dias: diasEscolhidos(marcacaoDoMes(par, mes)).length,
      parcial: hoje >= ini && hoje <= fim
    };
  });
}
