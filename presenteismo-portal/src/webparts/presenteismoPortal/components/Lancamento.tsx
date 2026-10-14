import * as React from 'react';
import styles from './QualityPortal.module.scss';
import { chave, dataHora, dt, ehTemp, fmt, int, iso, nz, ordenarPt, unicos } from '../lib/util';
import { type IColab, type ILancamento, type ILancEntrada, MOTIVOS, ROTULO_TURNO, TURNOS } from '../models';
import type { IDados } from './tipos';
import { Aviso, BotaoAtualizar, Pagina } from './ui';

interface IProps {
  d: IDados;
  /** gestor pré-selecionado (vindo do Acompanhamento) */
  gestorInicial: string;
  /** texto da pesquisa da barra superior */
  busca: string;
  onLimparBusca: () => void;
}

const igual = (a?: ILancEntrada | null, b?: ILancEntrada | null): boolean =>
  !!a && !!b && a.p === b.p && (a.p || a.m === b.m) && (a.o || '') === (b.o || '');

export const Lancamento: React.FC<IProps> = ({ d, gestorInicial, busca, onLimparBusca }) => {
  const [fg, setFg] = React.useState(gestorInicial);
  const [ft, setFt] = React.useState('');
  const [rascunho, setRascunho] = React.useState<Record<string, ILancEntrada>>({});
  const [erros, setErros] = React.useState<Record<string, boolean>>({});
  const [gravando, setGravando] = React.useState(false);

  // trocar a data ou a operação descarta alterações ainda não lançadas
  React.useEffect(() => {
    setRascunho({});
    setErros({});
  }, [d.ldate, d.op]);

  const td = iso(new Date());
  const gravavel = d.pm('grav');
  const idDoc = (g: string): string => `${d.op}_${d.ldate}_${chave(g)}`;
  const docs: Record<string, ILancamento> = {};
  d.lancDia.forEach((l) => (docs[l.id] = l));
  const salvo = (r: IColab): ILancEntrada | null => {
    const doc = docs[idDoc(r.g)];
    return doc && doc.e ? doc.e[r.u] || null : null;
  };
  const atual = (r: IColab): ILancEntrada => rascunho[r.u] || salvo(r) || { p: true };

  const todos = React.useMemo(() => d.minhaEquipe.slice().sort((a, b) => ordenarPt(a.n || a.u, b.n || b.u)), [d.minhaEquipe]);
  if (!d.hc.rows.length) {
    return (
      <Pagina titulo="Lançamento de presença">
        <Aviso titulo="Nenhum headcount carregado" texto={d.admin ? 'Importe a planilha na aba Headcount para montar as listas de presença.' : 'O administrador ainda não carregou o headcount.'} />
      </Pagina>
    );
  }
  if (!todos.length) {
    return (
      <Pagina titulo="Lançamento de presença">
        <Aviso titulo="Nenhuma equipe nesta operação" texto="Só o gestor da equipe (coluna GESTOR do headcount) lança a presença. Se você é gestor e não aparece aqui, peça ao administrador para conferir seu e-mail em Usuários e acessos." />
      </Pagina>
    );
  }

  const gestores = unicos(todos.map((r) => r.g)).sort(ordenarPt);
  const gestorAtivo = fg && gestores.indexOf(fg) >= 0 ? fg : '';
  const q = nz(busca);
  const porFiltro = todos.filter((r) => (!gestorAtivo || r.g === gestorAtivo) && (!ft || r.t === ft));
  const visiveis = q ? porFiltro.filter((r) => nz(`${r.n} ${r.u} ${r.g} ${r.m}`).indexOf(q) >= 0) : porFiltro;
  const diaSemana = dt(d.ldate).getDay();
  const efetivos = visiveis.filter((r) => !ehTemp(r)).length;
  const pendentes = visiveis.filter((r) => !igual(atual(r), salvo(r))).length;
  const ausentes = visiveis.filter((r) => !atual(r).p).length;

  const definir = (r: IColab, e: ILancEntrada): void => {
    setRascunho((x) => ({ ...x, [r.u]: e }));
    setErros((x) => ({ ...x, [r.u]: false }));
  };
  const setP = (r: IColab, p: boolean): void => {
    const c = atual(r);
    definir(r, { p, m: p ? '' : c.m || '', o: c.o || '' });
  };
  const setM = (r: IColab, m: string): void => definir(r, { p: false, m, o: atual(r).o || '' });
  const setO = (r: IColab, o: string): void => {
    const c = atual(r);
    setRascunho((x) => ({ ...x, [r.u]: { p: c.p, m: c.m || '', o } }));
  };

  const lancar = async (): Promise<void> => {
    if (!gravavel) return;
    const incompletos = porFiltro.filter((r) => {
      const c = atual(r);
      return c.p === false && !c.m;
    });
    if (incompletos.length) {
      const e: Record<string, boolean> = {};
      incompletos.forEach((r) => (e[r.u] = true));
      setErros(e);
      d.avisar('erro', `Escolha o motivo de ${incompletos.length} ausência${incompletos.length > 1 ? 's' : ''}.`);
      return;
    }
    const porGestor: Record<string, { g: string; rs: IColab[] }> = {};
    porFiltro.forEach((r) => (porGestor[chave(r.g)] || (porGestor[chave(r.g)] = { g: r.g, rs: [] })).rs.push(r));
    setGravando(true);
    const ok = await d.gravar(async () => {
      let n = 0;
      for (const k of Object.keys(porGestor)) {
        const grupo = porGestor[k];
        const id = `${d.op}_${d.ldate}_${k}`;
        const existente = (docs[id] || { e: {} }).e || {};
        const e: Record<string, ILancEntrada> = { ...existente };
        const agora = new Date().toISOString();
        let aus = 0;
        grupo.rs.forEach((r) => {
          const c = atual(r);
          const velho = existente[r.u];
          const em = velho && igual(c, velho) && velho.em ? velho.em : agora;
          e[r.u] = c.p ? { p: true, o: c.o || '', em } : { p: false, m: c.m, o: c.o || '', em };
          if (!c.p) aus++;
        });
        await d.servicos.lancamentos.salvar({ id, op: d.op, d: d.ldate, g: grupo.g, e, por: d.email, em: new Date().toISOString() });
        n += grupo.rs.length;
        d.registrar('lançou', `${grupo.g} · ${fmt(d.ldate)} · ${grupo.rs.length} colaboradores, ${aus} ausência${aus === 1 ? '' : 's'}`);
      }
      d.avisar('ok', `Presença lançada para ${n} colaboradores.`);
    });
    if (ok) {
      setRascunho({});
      setErros({});
    }
    setGravando(false);
  };

  return (
    <Pagina
      titulo="Lançamento de presença"
      subtitulo={`${int(visiveis.length)} colaboradores · ${int(efetivos)} efetivos · ${int(visiveis.length - efetivos)} temporários`}
      acoes={<BotaoAtualizar atualizando={d.atualizando} atualizadoEm={d.atualizadoEm} onClick={() => d.recarregar().catch(() => undefined)} />}
    >
      <section className={styles.cartao}>
        <div className={`${styles.fileira} ${styles.filtrosLanc}`} style={{ marginBottom: 12 }}>
          <label className={styles.campo}>
            Data de referência
            <input type="date" value={d.ldate} max={td} onChange={(e) => e.target.value && d.setLdate(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Gestor
            <select value={gestorAtivo} onChange={(e) => setFg(e.target.value)}>
              <option value="">Todos</option>
              {gestores.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className={styles.campo}>
            Turno
            <select value={ft} onChange={(e) => setFt(e.target.value)}>
              <option value="">Todos</option>
              {TURNOS.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TURNO[t]}
                </option>
              ))}
            </select>
          </label>
          {d.ldate < td && <span className={styles.retro}>Lançamento retroativo</span>}
          {busca && (
            <span className={`${styles.mudo} ${styles.fileiraNota}`}>
              Pesquisa: “{busca}”{' '}
              <button type="button" className={styles.link} onClick={onLimparBusca}>
                limpar
              </button>
            </span>
          )}
        </div>
        {(diaSemana === 0 || diaSemana === 6) && (
          <p className={styles.mudo} style={{ margin: '0 0 10px' }}>
            {diaSemana === 0 ? 'Domingo: as faltas ficam registradas, mas não entram no cálculo do Presenteísmo.' : 'Sábado: as faltas do ADM ficam registradas, mas não entram no cálculo.'}
          </p>
        )}
        {!gravavel && <p className={styles.aviso2}>Somente visualização: seu usuário não tem permissão para gravar lançamentos.</p>}
        <fieldset disabled={!gravavel} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className={styles.tabelaRolagem}>
            <table className={`${styles.tabelaEsq} ${styles.tabelaLanc}`}>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Função</th>
                  <th>Turno</th>
                  <th>Presença</th>
                  <th>Motivo</th>
                  <th>Status</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={7} className={styles.mudo}>
                      Nenhum colaborador com esses filtros.
                    </td>
                  </tr>
                )}
                {visiveis.map((r) => {
                  const c = atual(r);
                  const sv = salvo(r);
                  const lancado = igual(c, sv);
                  const doc = docs[idDoc(r.g)];
                  const dica = lancado && doc ? `Lançado por ${d.nomeDe(doc.por)} em ${dataHora(doc.em)}` : '';
                  return (
                    <tr key={r.u} className={c.p ? '' : styles.linhaAusente}>
                      <td className={styles.cNome}>
                        <b>{r.n || r.u}</b>
                        {ehTemp(r) && <span className={styles.seloTemp}>TEMP</span>}
                        <div className={styles.mudo}>
                          {r.u}
                          {d.completo || gestores.length > 1 ? ` · ${r.g}` : ''}
                        </div>
                      </td>
                      <td className={styles.cFuncao}>{r.c || '—'}</td>
                      <td className={styles.cTurno}>{ROTULO_TURNO[r.t]}</td>
                      <td className={styles.cPresenca}>
                        <div className={styles.alterna} role="group" aria-label={`Presença de ${r.n || r.u}`}>
                          <button type="button" className={c.p ? styles.alternaSim : ''} onClick={() => setP(r, true)}>
                            Sim
                          </button>
                          <button type="button" className={!c.p ? styles.alternaNao : ''} onClick={() => setP(r, false)}>
                            Não
                          </button>
                        </div>
                      </td>
                      <td className={`${styles.cMotivo} ${c.p ? styles.cVazio : ''}`}>
                        {c.p ? (
                          <span className={styles.mudo}>—</span>
                        ) : (
                          <select className={`${styles.controleTabela} ${erros[r.u] ? styles.campoErro : ''}`} value={c.m || ''} aria-label="Motivo" onChange={(e) => setM(r, e.target.value)}>
                            <option value="">Selecione o motivo</option>
                            {MOTIVOS.map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className={styles.cStatus}>
                        <span className={lancado ? styles.seloOk : styles.selo} title={dica}>
                          {lancado ? 'LANÇADO' : 'PENDENTE'}
                        </span>
                      </td>
                      <td className={styles.cObs}>
                        <input
                          type="text"
                          className={styles.controleTabela}
                          value={c.o || ''}
                          placeholder="Observação"
                          aria-label="Observação"
                          onChange={(e) => setO(r, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </fieldset>
      </section>

      <div className={styles.barraFixa}>
        <div className={styles.barraResumo}>
          <span className={styles.resumoPres}>
            <b>{int(visiveis.length - ausentes)}</b> presentes
          </span>
          <span className={styles.resumoAus}>
            <b>{int(ausentes)}</b> ausentes
          </span>
          <span className={pendentes ? styles.resumoPend : styles.resumoOk}>{pendentes ? `${int(pendentes)} a lançar` : 'Tudo lançado'}</span>
        </div>
        <div className={styles.barraAcoes}>
          <button
            type="button"
            className={`${styles.botao} ${styles.soDesktop}`}
            onClick={() => {
              setFg('');
              setFt('');
              onLimparBusca();
            }}
          >
            Limpar filtros
          </button>
          <button
            type="button"
            className={styles.botao}
            disabled={!Object.keys(rascunho).length}
            onClick={() => {
              setRascunho({});
              setErros({});
            }}
          >
            Desfazer alterações
          </button>
          {gravavel && (
            <button type="button" className={`${styles.botaoVermelho} ${styles.botaoLancar}`} disabled={gravando} onClick={() => lancar().catch(() => undefined)}>
              {gravando ? 'Lançando…' : 'Lançar presença'}
            </button>
          )}
        </div>
      </div>
    </Pagina>
  );
};
