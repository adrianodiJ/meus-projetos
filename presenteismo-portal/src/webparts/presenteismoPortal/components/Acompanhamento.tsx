import * as React from 'react';
import styles from './QualityPortal.module.scss';
import { chave, dataHora, fmt, fp, int, ordenarPt, unicos } from '../lib/util';
import { ROTULO_TURNO, TURNOS } from '../models';
import type { IDados } from './tipos';
import { Aviso, BotaoAtualizar, Kpi, Pagina } from './ui';

interface IGrupo {
  t: string;
  g: string;
  n: number;
  pr: number;
  au: number;
  ij: number;
  at: number;
  ot: number;
  sl: number;
  em: string;
}

export const Acompanhamento: React.FC<{ d: IDados; onAbrirGestor: (g: string) => void }> = ({ d, onAbrirGestor }) => {
  const [turno, setTurno] = React.useState('');
  const [area, setArea] = React.useState('');
  const td = new Date().toISOString().slice(0, 10);

  const acoes = <BotaoAtualizar atualizando={d.atualizando} atualizadoEm={d.atualizadoEm} onClick={() => d.recarregar().catch(() => undefined)} />;
  if (!d.hc.rows.length) {
    return (
      <Pagina titulo="Acompanhamento de gestores" acoes={acoes}>
        <Aviso titulo="Nenhum headcount carregado" texto={d.admin ? 'Importe a planilha na aba Headcount.' : 'O administrador ainda não carregou o headcount.'} />
      </Pagina>
    );
  }

  const areas = unicos(d.equipe.map((r) => r.a).filter(Boolean)).sort(ordenarPt);
  const areaAtiva = area && areas.indexOf(area) >= 0 ? area : '';
  const rows = d.equipe.filter((r) => (!turno || r.t === turno) && (!areaAtiva || r.a === areaAtiva));
  const docs: Record<string, (typeof d.lancDia)[number]> = {};
  d.lancDia.forEach((l) => (docs[l.id] = l));

  const G: Record<string, IGrupo> = {};
  rows.forEach((r) => {
    const k = `${r.t}|${chave(r.g)}`;
    const o = G[k] || (G[k] = { t: r.t, g: r.g, n: 0, pr: 0, au: 0, ij: 0, at: 0, ot: 0, sl: 0, em: '' });
    const doc = docs[`${d.op}_${d.ldate}_${chave(r.g)}`];
    const e = doc && doc.e ? doc.e[r.u] : null;
    o.n++;
    if (!e) o.sl++;
    else if (e.p) o.pr++;
    else {
      o.au++;
      if (e.m === 'Atestado') o.at++;
      else if (e.m === 'Falta injustificada') o.ij++;
      else o.ot++;
    }
    if (doc && doc.em && doc.em > o.em) o.em = doc.em;
  });
  const L = Object.keys(G)
    .map((k) => G[k])
    .sort((a, b) => TURNOS.indexOf(a.t as never) - TURNOS.indexOf(b.t as never) || ordenarPt(a.g, b.g));
  const aus = L.reduce((s, o) => s + o.au, 0);
  const ij = L.reduce((s, o) => s + o.ij, 0);
  const at = L.reduce((s, o) => s + o.at, 0);
  const feitos = L.filter((o) => !o.sl).length;
  const pc = L.length ? (feitos / L.length) * 100 : 0;


  return (
    <Pagina titulo="Acompanhamento de gestores" acoes={acoes}>
      <div className={styles.fileira}>
        <label className={styles.campo}>
          Data
          <input type="date" value={d.ldate} max={td} onChange={(e) => e.target.value && d.setLdate(e.target.value)} />
        </label>
        <label className={styles.campo}>
          Turno
          <select value={turno} onChange={(e) => setTurno(e.target.value)}>
            <option value="">Todos</option>
            {TURNOS.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TURNO[t]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.campo}>
          Área
          <select value={areaAtiva} onChange={(e) => setArea(e.target.value)}>
            <option value="">Todas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.kpis}>
        <Kpi valor={int(rows.length)} legenda="Colaboradores" icone="People" cor="#1F6FD1" detalhe="incluindo temporários" />
        <Kpi valor={int(aus)} legenda="Ausências no dia" icone="UserRemove" cor="#D40511" detalhe={`${int(ij)} injust. · ${int(at)} atest. · ${int(aus - ij - at)} outros`} />
        <Kpi valor={`${int(feitos)} de ${int(L.length)}`} legenda="Equipes que lançaram" icone="CheckList" cor="#1E9E3E" detalhe="lista completa no dia" />
        <Kpi
          valor={fp(pc)}
          legenda="Lançado"
          icone="Clock"
          cor={pc === 100 ? '#1E9E3E' : '#F28C00'}
          detalhe={L.length - feitos ? `${int(L.length - feitos)} equipe${L.length - feitos > 1 ? 's' : ''} pendente${L.length - feitos > 1 ? 's' : ''}` : 'Tudo lançado'}
          detalheCor={pc === 100 ? '#14632b' : '#9b1c22'}
        />
      </div>

      <section className={styles.cartao}>
        <div className={styles.cartaoTopo}>
          <h3>
            Lista de gestores em {fmt(d.ldate)}/{d.ldate.slice(0, 4)}
          </h3>
        </div>
        <div className={styles.legenda}>
          <span>
            <i style={{ background: '#dcfce7' }} />
            Lançamento completo
          </span>
          <span>
            <i style={{ background: '#fee2e2' }} />
            Lançamento pendente
          </span>
          <span>{d.pm('lanc') ? 'Clique na sua equipe para abrir a lista de presença.' : 'Só o gestor de cada equipe lança a presença.'}</span>
        </div>
        <div className={styles.tabelaRolagem}>
          <table className={styles.tabelaEsq}>
            <thead>
              <tr>
                <th>Turno</th>
                <th>Gestor</th>
                <th className={styles.num}>Colaboradores</th>
                <th className={styles.num}>Presentes</th>
                <th className={styles.num}>Ausências</th>
                <th className={styles.num}>Injustificadas</th>
                <th className={styles.num}>Atestados</th>
                <th className={styles.num}>Outros</th>
                <th className={styles.num}>Sem lançamento</th>
                <th>Últ. lançamento às</th>
                <th>Pendente?</th>
              </tr>
            </thead>
            <tbody>
              {L.length === 0 && (
                <tr>
                  <td colSpan={11} className={styles.mudo}>
                    Nenhum gestor com esses filtros.
                  </td>
                </tr>
              )}
              {L.map((o) => {
                const ok = !o.sl;
                return (
                  <tr key={`${o.t}|${o.g}`} className={ok ? styles.linhaOk : styles.linhaPend}>
                    <td>{ROTULO_TURNO[o.t]}</td>
                    <td>
                      {d.completo || d.meusGestores.some((g) => chave(g) === chave(o.g)) ? (
                        <button type="button" className={styles.elo} onClick={() => onAbrirGestor(o.g)}>
                          {o.g}
                        </button>
                      ) : (
                        o.g
                      )}
                    </td>
                    <td className={styles.num}>{o.n}</td>
                    <td className={styles.num}>{o.pr}</td>
                    <td className={styles.num}>{o.au}</td>
                    <td className={styles.num}>{o.ij}</td>
                    <td className={styles.num}>{o.at}</td>
                    <td className={styles.num}>{o.ot}</td>
                    <td className={styles.num}>{o.sl}</td>
                    <td>{o.em ? dataHora(o.em, 'curto') : '—'}</td>
                    <td className={styles.pend}>{ok ? 'NÃO' : 'SIM'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Pagina>
  );
};
