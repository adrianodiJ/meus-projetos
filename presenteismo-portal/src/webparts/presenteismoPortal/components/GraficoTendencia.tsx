import * as React from 'react';
import styles from './Tendencia.module.scss';
import type { IPontoTendencia } from '../lib/tendencia';
import { fmt, fp, int, num } from '../lib/util';
import { COR_OK, COR_RUIM } from './Charts';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (ym: string): string => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const mesCurto = (ym: string): string => `${MESES[Number(ym.slice(5, 7)) - 1].slice(0, 3)}/${ym.slice(2, 4)}`;

interface IProps {
  pontos: IPontoTendencia[];
  meta: number;
  /** mês aberto no painel (fica em destaque) */
  atual: string;
  /** clique num mês abre o painel nele */
  onEscolher: (ym: string) => void;
}

/**
 * Tendência do presenteísmo mês a mês (uma linha, um eixo), com a meta tracejada. Ponto verde na meta,
 * vermelho abaixo; mês sem dias marcados fica como um buraco na linha. Passar o mouse mostra o detalhe,
 * clicar abre o mês no painel; a tabela tem os mesmos números.
 */
export const GraficoTendencia: React.FC<IProps> = ({ pontos, meta, atual, onEscolher }) => {
  const [foco, setFoco] = React.useState<number | undefined>(undefined);
  const [tabela, setTabela] = React.useState(false);

  const comDados = pontos.filter((x) => x.v !== null);
  const naMeta = comDados.filter((x) => (x.v as number) >= meta).length;
  const somaP = comDados.reduce((s, x) => s + x.p, 0);
  const somaF = comDados.reduce((s, x) => s + x.f, 0);
  const media = somaP ? 100 * (1 - somaF / somaP) : null;
  const ordenados = comDados.slice().sort((a, b) => (a.v as number) - (b.v as number));
  const pior = ordenados[0];
  const melhor = ordenados[ordenados.length - 1];

  // geometria (viewBox; o SVG ocupa a largura do cartão)
  const W = 960;
  const H = 250;
  const L = 46;
  const R = 74;
  const T = 26;
  const B = 40;
  const vs = comDados.map((x) => x.v as number);
  let lo = Math.max(0, Math.floor(Math.min(meta, ...vs) - 1));
  const faixa = 100 - lo;
  const passo = faixa <= 6 ? 1 : faixa <= 14 ? 2 : faixa <= 30 ? 5 : 10;
  lo = Math.floor(lo / passo) * passo;
  const y = (v: number): number => T + (H - T - B) * (1 - (Math.max(lo, v) - lo) / (100 - lo));
  const coluna = (W - L - R) / Math.max(1, pontos.length);
  const x = (i: number): number => L + coluna * i + coluna / 2;
  const marcas: number[] = [];
  for (let t = lo; t <= 100; t += passo) marcas.push(t);

  // a linha quebra nos meses sem dados
  const trechos: string[] = [];
  let atualTrecho = '';
  pontos.forEach((p, i) => {
    if (p.v === null) {
      if (atualTrecho) trechos.push(atualTrecho);
      atualTrecho = '';
      return;
    }
    atualTrecho += `${atualTrecho ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`;
  });
  if (atualTrecho) trechos.push(atualTrecho);
  const ultimo = pontos.map((p, i) => ({ p, i })).filter((o) => o.p.v !== null).pop();

  const resumo =
    comDados.length > 0
      ? `${naMeta} de ${comDados.length} ${comDados.length === 1 ? 'mês' : 'meses'} na meta · média de ${fp(media)} no período` +
        (melhor && pior && melhor !== pior ? ` · melhor ${mesCurto(melhor.ym)} (${fp(melhor.v)}) · pior ${mesCurto(pior.ym)} (${fp(pior.v)})` : '')
      : '';

  const status = (v: number | null): string => (v === null ? 'Sem dias marcados' : v >= meta ? 'Dentro da meta' : `${num(meta - v)} p.p. abaixo da meta`);
  const p = foco !== undefined ? pontos[foco] : undefined;
  const ladoDica = foco === undefined ? 'meio' : foco < 2 ? 'esq' : foco > pontos.length - 3 ? 'dir' : 'meio';

  return (
    <div className={styles.tendencia}>
      <div className={styles.topo}>
        <span className={styles.resumo}>{resumo || 'Ainda não há meses com dias marcados no calendário.'}</span>
        <button type="button" className={styles.alternar} onClick={() => setTabela(!tabela)} aria-pressed={tabela}>
          {tabela ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>

      {tabela ? (
        <div className={styles.tabelaRolagem}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Folha ponto</th>
                <th>Dias</th>
                <th>Horas previstas</th>
                <th>Horas de falta</th>
                <th>Faltas</th>
                <th>Presenteísmo</th>
              </tr>
            </thead>
            <tbody>
              {pontos
                .slice()
                .reverse()
                .map((q) => (
                  <tr key={q.ym} className={q.ym === atual ? styles.linhaAtual : ''}>
                    <td>
                      <button type="button" className={styles.elo} onClick={() => onEscolher(q.ym)}>
                        {nomeMes(q.ym)}
                      </button>
                      {q.parcial && <small> (em andamento)</small>}
                    </td>
                    <td>
                      {fmt(q.ini)} a {fmt(q.fim)}
                    </td>
                    <td>{int(q.dias)}</td>
                    <td>{q.v === null ? '—' : num(q.p)}</td>
                    <td>{q.v === null ? '—' : num(q.f)}</td>
                    <td>{q.v === null ? '—' : int(q.faltas)}</td>
                    <td>
                      {q.v === null ? (
                        '—'
                      ) : (
                        <span className={styles.valorStatus}>
                          <i style={{ background: q.v >= meta ? COR_OK : COR_RUIM }} />
                          {fp(q.v)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : comDados.length < 2 ? (
        <p className={styles.vazio}>A tendência aparece quando pelo menos 2 meses tiverem dias marcados no calendário (botão Calendário, acima).</p>
      ) : (
        <div className={styles.area} onMouseLeave={() => setFoco(undefined)}>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`Tendência do presenteísmo: ${resumo}`}>
            {marcas.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e7e9ee" />
                <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                  {t}%
                </text>
              </g>
            ))}
            {/* meta */}
            <line x1={L} x2={W - R} y1={y(meta)} y2={y(meta)} stroke="#1f2328" strokeDasharray="5 4" opacity=".5" />
            <text x={W - R + 8} y={y(meta) + 4} fontSize="11" fill="#6b7280">
              Meta {fp(meta)}
            </text>
            {/* cruz do mês em foco */}
            {foco !== undefined && <line x1={x(foco)} x2={x(foco)} y1={T - 8} y2={H - B} stroke="#c9ced6" />}
            {/* linha */}
            {trechos.map((dPath, k) => (
              <path key={k} d={dPath} fill="none" stroke="#374151" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {/* pontos */}
            {pontos.map((q, i) => {
              if (q.v === null) return null;
              const cor = q.v >= meta ? COR_OK : COR_RUIM;
              const grande = q.ym === atual || foco === i;
              return (
                <circle
                  key={q.ym}
                  cx={x(i)}
                  cy={y(q.v)}
                  r={grande ? 6.5 : 5}
                  fill={q.parcial ? '#fff' : cor}
                  stroke={q.parcial ? cor : '#fff'}
                  strokeWidth={q.parcial ? 2.5 : 2}
                />
              );
            })}
            {/* valor só no último mês (o resto está no detalhe e na tabela) */}
            {ultimo && ultimo.p.v !== null && (
              <text x={x(ultimo.i)} y={y(ultimo.p.v) - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f2328">
                {fp(ultimo.p.v)}
              </text>
            )}
            {/* meses */}
            {pontos.map((q, i) => (
              <text
                key={`r${q.ym}`}
                x={x(i)}
                y={H - B + 20}
                textAnchor="middle"
                fontSize="11.5"
                fontWeight={q.ym === atual ? 800 : 500}
                fill={q.v === null ? '#b0b5bd' : q.ym === atual ? '#1f2328' : '#4b5563'}
              >
                {mesCurto(q.ym)}
              </text>
            ))}
            {/* áreas de toque (maiores que o ponto): foco, detalhe e clique */}
            {pontos.map((q, i) => (
              <rect
                key={`h${q.ym}`}
                x={L + coluna * i}
                y={T - 10}
                width={coluna}
                height={H - B - T + 34}
                fill="transparent"
                style={{ cursor: 'pointer', outline: 'none' }}
                tabIndex={0}
                role="button"
                aria-label={`${nomeMes(q.ym)}: ${q.v === null ? 'sem dias marcados' : fp(q.v)}. Abrir este mês`}
                onMouseEnter={() => setFoco(i)}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(undefined)}
                onClick={() => onEscolher(q.ym)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onEscolher(q.ym)}
              />
            ))}
          </svg>

          {p && foco !== undefined && (
            <div
              className={`${styles.dica} ${ladoDica === 'esq' ? styles.dicaEsq : ladoDica === 'dir' ? styles.dicaDir : ''}`}
              style={{ left: `${(x(foco) / W) * 100}%` }}
              role="status"
            >
              <b className={styles.dicaValor}>{p.v === null ? '—' : fp(p.v)}</b>
              <span className={styles.dicaMes}>
                {nomeMes(p.ym)}
                {p.parcial ? ' · em andamento' : ''}
              </span>
              <span className={styles.dicaFolha}>
                folha {fmt(p.ini)} a {fmt(p.fim)}
              </span>
              <span className={styles.dicaStatus}>
                {p.v !== null && <i style={{ background: p.v >= meta ? COR_OK : COR_RUIM }} />}
                {status(p.v)}
              </span>
              {p.v !== null && (
                <dl>
                  <dt>Horas previstas</dt>
                  <dd>{num(p.p)} h</dd>
                  <dt>Horas de falta</dt>
                  <dd>{num(p.f)} h</dd>
                  <dt>Faltas</dt>
                  <dd>{int(p.faltas)}</dd>
                  <dt>Dias marcados</dt>
                  <dd>{int(p.dias)}</dd>
                </dl>
              )}
              <small>Clique para abrir este mês</small>
            </div>
          )}
        </div>
      )}
      <p className={styles.nota}>
        Cada ponto é a folha ponto do mês (13 a 12), com a mesma conta do painel e o headcount atual. Ponto vazado: folha em andamento.
      </p>
    </div>
  );
};
