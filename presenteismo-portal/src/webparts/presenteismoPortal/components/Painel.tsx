import * as React from 'react';
import styles from './QualityPortal.module.scss';
import { calcular, periodoDoMes, pct, resumoPainel, somar } from '../lib/calculo';
import { fmt, fp, int, num, ordenarPt, unicos } from '../lib/util';
import { ROTULO_TURNO, TURNOS } from '../models';
import { Anel, COR_OK, COR_RUIM, GraficoSemanal, Trilha } from './Charts';
import type { IDados } from './tipos';
import { Aviso, BotaoAtualizar, Cartao, Kpi, Pagina } from './ui';

export const Painel: React.FC<{ d: IDados }> = ({ d }) => {
  const meta = d.params.meta;
  const [ini, fim] = periodoDoMes(d.ym);

  const controles = (
    <div className={styles.fileira}>
      <label className={styles.campo}>
        Mês
        <input type="month" value={d.ym} onChange={(e) => e.target.value && d.setYm(e.target.value)} />
      </label>
      <span className={styles.fileiraNota}>
        {fmt(ini)} a {fmt(fim)} · meta {fp(meta)} · somente efetivos
      </span>
      <BotaoAtualizar atualizando={d.atualizando} atualizadoEm={d.atualizadoEm} onClick={() => d.recarregar().catch(() => undefined)} />
      {d.pm('exp') && (
        <button type="button" className={styles.botaoAmarelo} onClick={() => d.irPara('relatorios')}>
          Exportar relatório
        </button>
      )}
    </div>
  );

  const r = React.useMemo(() => resumoPainel(d.equipe, d.lancMes, d.ym, d.params), [d.equipe, d.lancMes, d.ym, d.params]);

  if (!d.hc.rows.length) {
    return (
      <Pagina titulo="Painel Presenteísmo" acoes={controles}>
        <Aviso titulo="Nenhum headcount carregado" texto={d.admin ? 'Importe a planilha na aba Headcount para começar.' : 'O administrador ainda não carregou o headcount.'} />
      </Pagina>
    );
  }
  if (!r.rows.length) {
    return (
      <Pagina titulo="Painel Presenteísmo" acoes={controles}>
        <Aviso titulo="Nenhum efetivo na sua equipe" texto="O administrador precisa vincular ao seu usuário os gestores da sua equipe." />
      </Pagina>
    );
  }

  const v = r.v;
  const ok = v !== null && v >= meta;
  const semanas = unicos(r.res.map((o) => o.w)).sort((a, b) => a - b);
  const dadosSemana = semanas.map((w) => {
    const x = r.res.filter((o) => o.w === w);
    const s = somar(x);
    return { l: `W${w}`, r: `${fmt(x.map((o) => o.a).sort()[0])}–${fmt(x.map((o) => o.b).sort().pop() as string)}`, v: pct(s.p, s.f) };
  });

  const turnos = TURNOS.map((t) => {
    const a = r.res.filter((o) => o.t === t);
    if (!a.length) return undefined;
    const s = somar(a);
    return { t, s, x: pct(s.p, s.f) };
  }).filter((x): x is NonNullable<typeof x> => !!x);

  const gestores = unicos(r.rows.map((x) => x.g))
    .map((g) => {
      const rr = r.rows.filter((x) => x.g === g);
      const s = somar(calcular(rr, r.faltasMes, d.ym, d.params));
      return { g, n: rr.length, v: pct(s.p, s.f) };
    })
    .sort((a, b) => (a.v === null ? 101 : a.v) - (b.v === null ? 101 : b.v) || ordenarPt(a.g, b.g));

  const contagem: Record<string, { u: string; n: number; a: number; i: number }> = {};
  r.faltasMes.forEach((f) => {
    const o = contagem[f.u] || (contagem[f.u] = { u: f.u, n: 0, a: 0, i: 0 });
    o.n++;
    if (f.m === 'Atestado') o.a++;
    else o.i++;
  });
  const top = Object.keys(contagem)
    .map((k) => contagem[k])
    .sort((x, y) => y.n - x.n || y.i - x.i)
    .slice(0, 10);

  const cor = (x: number | null): string => (x !== null && x >= meta ? COR_OK : COR_RUIM);

  return (
    <Pagina titulo="Painel Presenteísmo" subtitulo={`Operação ${d.opNome(d.op)} · cálculo sobre horas previstas x horas de falta`} acoes={controles}>
      <div className={styles.painelTopo}>
        <div className={styles.indicadorAnel}>
          <Anel valor={v === null ? 0 : v} ok={ok} />
          <div>
            <span>Presenteísmo do mês</span>
            <b style={{ color: cor(v) }}>{v === null ? 'Sem horas' : ok ? 'Dentro da meta' : `${num(meta - v)} p.p. abaixo`}</b>
            <small>Meta {fp(meta)}</small>
          </div>
        </div>
        <Kpi valor={num(r.total.p)} legenda="Horas previstas" icone="Clock" cor="#1F6FD1" detalhe="dias com expediente" />
        <Kpi valor={num(r.total.f)} legenda="Horas de falta" icone="Warning" cor="#D40511" detalhe={r.total.p ? `${num((r.total.f / r.total.p) * 100)}% das horas previstas` : undefined} />
        <Kpi valor={int(r.faltasMes.length)} legenda="Faltas no mês" icone="UserRemove" cor="#8C0A12" detalhe="injustificadas + atestados" />
        <Kpi valor={int(r.rows.length)} legenda="Efetivos" icone="People" cor="#4B5563" detalhe="temporários fora do cálculo" />
      </div>

      <div className={styles.grade2}>
        <Cartao titulo="Evolução semanal">
          <GraficoSemanal semanas={dadosSemana} meta={meta} />
        </Cartao>
        <Cartao titulo="Visão por turno">
          {turnos.map((x) => (
            <div key={x.t} className={styles.turno}>
              <div className={styles.turnoTopo}>
                <b>{ROTULO_TURNO[x.t]}</b>
                <span style={{ color: cor(x.x) }}>{fp(x.x)}</span>
              </div>
              <Trilha valor={x.x} meta={meta} altura={6} />
              <div className={styles.mudo} style={{ marginTop: 5 }}>
                {num(x.s.f)} h de falta · {num(x.s.p)} h previstas
              </div>
            </div>
          ))}
        </Cartao>
      </div>

      <div className={styles.grade2}>
        <Cartao titulo="Por gestor, do pior para o melhor">
          {gestores.map((x) => (
            <div key={x.g} className={styles.linhaGestor}>
              <div>
                <b>{x.g}</b>
                <div className={styles.mudo}>{int(x.n)} efetivos</div>
              </div>
              <Trilha valor={x.v} meta={meta} altura={6} />
              <div className={styles.valor}>{fp(x.v)}</div>
            </div>
          ))}
        </Cartao>
        {d.pm('top') && (
          <Cartao titulo="Top 10 ofensores">
            {top.length === 0 && <p className={styles.mudo}>Nenhuma falta lançada neste mês.</p>}
            {top.map((o, i) => {
              const x = r.ix[o.u];
              return (
                <div key={o.u} className={styles.ofensor}>
                  <span className={i < 3 ? styles.rankTop : styles.rank}>{i + 1}</span>
                  <div>
                    <b>{x.n || x.u}</b>
                    <div className={styles.mudo}>{x.g}</div>
                  </div>
                  <span className={styles.mudo}>
                    {o.i} injustificada(s) · {o.a} atestado(s)
                  </span>
                  <span className={styles.faltaPill}>
                    {o.n} falta{o.n > 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
            <p className={styles.mudo} style={{ margin: '8px 0 0' }}>
              Faltas injustificadas e atestados no mês; só dias com expediente.
            </p>
          </Cartao>
        )}
      </div>
    </Pagina>
  );
};
