import * as React from 'react';
import { Icon, Modal } from '@fluentui/react';
import styles from './Calendario.module.scss';
import { periodoDoMes } from '../lib/calculo';
import { type IAjustes, mapaDias, regraPadrao } from '../lib/calendario';
import { dias, dt, ehTemp, fmt, int, iso, num } from '../lib/util';
import { ROTULO_TURNO, type Turno, TURNOS } from '../models';
import type { IDados } from './tipos';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CURTO: Record<Turno, string> = { ADM: 'ADM', PRIMEIRO: '1º', SEGUNDO: '2º' };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-10" ± n meses */
function somarMes(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const x = new Date(y, m - 1 + n, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

/** Quantos dias do período foram ajustados à mão (para o selo do botão). */
export function ajustesNoPeriodo(d: IDados): number {
  const [ini, fim] = periodoDoMes(d.ym, d.params);
  const aj = d.params.aj || {};
  return dias(ini, fim).filter((x) => aj[x]).length;
}

/**
 * Botão do topo do Painel que abre o calendário do período: quais dias contam no cálculo para cada turno.
 * Parte da regra da folha ponto (domingo não conta; ADM folga aos sábados; 1º e 2º folgam os 2 primeiros
 * sábados, ou 3 se o período tiver 5) e o administrador marca ou desmarca dias (feriados, inventário…).
 */
export const BotaoCalendario: React.FC<{ d: IDados }> = ({ d }) => {
  const [aberto, setAberto] = React.useState(false);
  const n = ajustesNoPeriodo(d);
  return (
    <>
      <button type="button" className={styles.abrir} onClick={() => setAberto(true)} title="Dias que contam no cálculo">
        <Icon iconName="Calendar" />
        Calendário
        {n > 0 && <span className={styles.abrirSelo} title={`${n} dia(s) ajustado(s) neste período`}>{n}</span>}
      </button>
      {aberto && <JanelaCalendario d={d} onFechar={() => setAberto(false)} />}
    </>
  );
};

const JanelaCalendario: React.FC<{ d: IDados; onFechar: () => void }> = ({ d, onFechar }) => {
  const [ini, fim] = periodoDoMes(d.ym, d.params);
  const [rascunho, setRascunho] = React.useState<IAjustes | undefined>(undefined);
  const [salvando, setSalvando] = React.useState(false);
  /** turnos que os cliques no número do dia, no dia da semana e nas ações em bloco alteram */
  const [alvo, setAlvo] = React.useState<Turno[]>(TURNOS);
  React.useEffect(() => setRascunho(undefined), [d.ym, d.op, d.params.aj]);

  const aj: IAjustes = rascunho || d.params.aj || {};
  const padrao = regraPadrao(ini, fim);
  const mapa = mapaDias(ini, fim, aj);
  const lista = dias(ini, fim);
  const editavel = d.admin;
  const hoje = iso(new Date());
  const pendentes = rascunho ? lista.filter((x) => JSON.stringify(rascunho[x] || {}) !== JSON.stringify((d.params.aj || {})[x] || {})).length : 0;
  const ajustados = lista.filter((x) => aj[x]).length;
  const inicioMes = (d.params.ini || 1) <= 1;
  const rotulo = inicioMes ? `${MESES[dt(ini).getMonth()]} ${ini.slice(0, 4)}` : `${fmt(ini)} a ${fmt(fim)}`;

  /** Marca (valor = true) ou desmarca vários dias de uma vez; o que voltar ao padrão deixa de ser ajuste. */
  const aplicar = (diasAlvo: string[], turnos: Turno[], valor: boolean | 'padrao'): void => {
    const novo: IAjustes = { ...aj };
    diasAlvo.forEach((dia) => {
      const x: Partial<Record<Turno, boolean>> = { ...(novo[dia] || {}) };
      turnos.forEach((t) => {
        if (valor === 'padrao' || padrao[dia][t] === valor) delete x[t];
        else x[t] = valor;
      });
      if (Object.keys(x).length) novo[dia] = x;
      else delete novo[dia];
    });
    setRascunho(novo);
  };
  const definir = (dia: string, turnos: Turno[], valor: boolean): void => aplicar([dia], turnos, valor);
  /** clique que liga se algum turno do alvo está desligado, e desliga se todos estão ligados */
  const alternar = (diasAlvo: string[]): void => {
    const todosLigados = diasAlvo.every((x) => alvo.every((t) => mapa[x][t]));
    aplicar(diasAlvo, alvo, !todosLigados);
  };
  const restaurar = (): void => aplicar(lista, TURNOS, 'padrao');

  // horas previstas = efetivos do turno × horas por dia × dias marcados (como no painel)
  const efetivos = (t: Turno): number => d.equipe.filter((r) => r.t === t && !ehTemp(r)).length;
  const horasDia = (t: Turno): number => Number(d.params.h[t]) || 0;
  const diasDo = (t: Turno): number => lista.filter((x) => mapa[x][t]).length;
  const previstas = (t: Turno): number => efetivos(t) * horasDia(t) * diasDo(t);
  const totalPrevistas = TURNOS.reduce((s, t) => s + previstas(t), 0);
  const todosAlvo = alvo.length === TURNOS.length;
  const rotuloAlvo = todosAlvo ? 'todos os turnos' : alvo.map((t) => ROTULO_TURNO[t]).join(' e ');
  const trocarAlvo = (t: Turno | 'todos'): void => {
    if (t === 'todos') setAlvo(TURNOS);
    else setAlvo(todosAlvo ? [t] : alvo.indexOf(t) >= 0 ? (alvo.length > 1 ? alvo.filter((x) => x !== t) : alvo) : TURNOS.filter((x) => x === t || alvo.indexOf(x) >= 0));
  };

  const sair = (acao: () => void): void => {
    if (pendentes && !window.confirm('Há alterações não salvas no calendário. Descartar?')) return;
    acao();
  };

  const salvar = async (): Promise<void> => {
    if (!rascunho) return;
    setSalvando(true);
    await d.gravar(async () => {
      await d.servicos.dados.gravar(`cfg/params_${d.op}`, { ...d.params, aj: rascunho });
      d.registrar('calendário', `${fmt(ini)} a ${fmt(fim)} · ${lista.filter((x) => rascunho[x]).length} dia(s) ajustado(s)`);
    }, 'Calendário salvo. O painel já usa os novos dias.');
    setSalvando(false);
  };

  return (
    <Modal isOpen onDismiss={() => sair(onFechar)} containerClassName={styles.janela} isBlocking={false}>
      <div className={styles.topo}>
        <div className={styles.topoIcone}>
          <Icon iconName="Calendar" />
        </div>
        <div className={styles.topoTexto}>
          <small>Folha ponto · {d.opNome(d.op)}</small>
          <h2>Dias que contam no cálculo</h2>
          <span>
            {fmt(ini)}/{ini.slice(0, 4)} a {fmt(fim)}/{fim.slice(0, 4)}
            {ajustados ? ` · ${ajustados} dia${ajustados > 1 ? 's' : ''} ajustado${ajustados > 1 ? 's' : ''} à mão` : ' · regra padrão'}
          </span>
        </div>
        <div className={styles.navegar}>
          <button type="button" aria-label="Período anterior" onClick={() => sair(() => d.setYm(somarMes(d.ym, -1)))}>
            <Icon iconName="ChevronLeft" />
          </button>
          <b>{rotulo}</b>
          <button type="button" aria-label="Próximo período" onClick={() => sair(() => d.setYm(somarMes(d.ym, 1)))}>
            <Icon iconName="ChevronRight" />
          </button>
        </div>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={() => sair(onFechar)}>
          <Icon iconName="Cancel" />
        </button>
      </div>

      <div className={styles.corpo}>
        <div className={styles.resumo}>
          {TURNOS.map((t) => (
            <div key={t} className={styles.turno}>
              <div className={styles.turnoNumero}>{diasDo(t)}</div>
              <div className={styles.turnoTexto}>
                <b>{ROTULO_TURNO[t]}</b>
                <span>
                  dias · {int(efetivos(t))} pessoas × {num(horasDia(t))} h
                </span>
                <strong>{num(previstas(t))} h previstas</strong>
              </div>
            </div>
          ))}
          <div className={styles.total}>
            <small>Horas previstas do período</small>
            <b>{num(totalPrevistas)} h</b>
            <span>efetivos × horas por dia × dias marcados</span>
          </div>
        </div>

        {editavel && (
          <div className={styles.ferramentas}>
            <div className={styles.alvo} role="group" aria-label="Turnos que a seleção altera">
              <span>Escolher dias para</span>
              <button type="button" className={todosAlvo ? styles.alvoOn : ''} aria-pressed={todosAlvo} onClick={() => trocarAlvo('todos')}>
                Todos os turnos
              </button>
              {TURNOS.map((t) => {
                const on = !todosAlvo && alvo.indexOf(t) >= 0;
                return (
                  <button key={t} type="button" className={on ? styles.alvoOn : ''} aria-pressed={on} onClick={() => trocarAlvo(t)}>
                    {ROTULO_TURNO[t]}
                  </button>
                );
              })}
            </div>
            <div className={styles.blocos}>
              <button type="button" onClick={() => aplicar(lista, alvo, true)} title={`Marca todos os dias do período, inclusive sábados e domingos, para ${rotuloAlvo}`}>
                <Icon iconName="CheckboxComposite" /> Marcar todos os dias
              </button>
              <button type="button" onClick={() => aplicar(lista, alvo, false)} title={`Desmarca todos os dias do período para ${rotuloAlvo}`}>
                <Icon iconName="Checkbox" /> Desmarcar todos
              </button>
              <button type="button" onClick={() => aplicar(lista, alvo, 'padrao')} title={`Volta à regra da folha ponto para ${rotuloAlvo}`}>
                <Icon iconName="Undo" /> Padrão da folha ponto
              </button>
            </div>
          </div>
        )}

        <div className={styles.legenda}>
          <span>
            <i className={styles.marcaConta} /> conta
          </span>
          <span>
            <i className={styles.marcaNao} /> não conta
          </span>
          <span>
            <i className={styles.marcaAjuste} /> alterado à mão
          </span>
          <span>
            <i className={styles.marcaHoje} /> hoje
          </span>
          <span>
            {editavel
              ? `Clique no número do dia ou no dia da semana (ex.: SÁB) para marcar/desmarcar ${rotuloAlvo}; a pílula muda só aquele turno. Padrão: domingo não conta, ADM folga aos sábados, 1º e 2º folgam os 2 primeiros sábados (3 se houver 5).`
              : 'Só o administrador altera o calendário.'}
          </span>
        </div>

        <div className={styles.rolagem}>
          <div className={styles.grade}>
            {SEMANA.map((s, i) => {
              const doDia = lista.filter((x) => dt(x).getDay() === i);
              return editavel ? (
                <button
                  key={s}
                  type="button"
                  className={`${styles.diaSemana} ${styles.diaSemanaBotao} ${i === 0 || i === 6 ? styles.fimDeSemana : ''}`}
                  title={`Marcar/desmarcar todas as ${s.toLowerCase()}s do período para ${rotuloAlvo}`}
                  onClick={() => alternar(doDia)}
                >
                  {s}
                </button>
              ) : (
                <div key={s} className={`${styles.diaSemana} ${i === 0 || i === 6 ? styles.fimDeSemana : ''}`}>
                  {s}
                </div>
              );
            })}
            {Array.from({ length: dt(ini).getDay() }).map((_, i) => (
              <div key={`v${i}`} />
            ))}
            {lista.map((dia) => {
              const algum = TURNOS.some((t) => mapa[dia][t]);
              return (
                <div key={dia} className={`${styles.dia} ${algum ? '' : styles.diaFolga} ${dia === hoje ? styles.diaHoje : ''}`}>
                  <div className={styles.diaTopo}>
                    <button
                      type="button"
                      className={`${styles.diaNumero} ${algum ? '' : styles.diaNumeroFolga}`}
                      disabled={!editavel}
                      title={editavel ? `Marcar/desmarcar ${fmt(dia)} para ${rotuloAlvo}` : undefined}
                      onClick={() => alternar([dia])}
                    >
                      {dia.slice(8)}
                    </button>
                    <span className={styles.diaMes}>{algum ? MESES[dt(dia).getMonth()].slice(0, 3) : 'folga'}</span>
                  </div>
                  <div className={styles.pilulas}>
                    {TURNOS.map((t) => {
                      const on = mapa[dia][t];
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={!editavel}
                          aria-pressed={on}
                          aria-label={`${ROTULO_TURNO[t]} em ${fmt(dia)}: ${on ? 'conta' : 'não conta'}`}
                          title={`${ROTULO_TURNO[t]}: ${on ? 'conta' : 'não conta'}${on !== padrao[dia][t] ? ' (alterado à mão)' : ''}`}
                          className={`${styles.pilula} ${on ? styles.pilulaOn : ''} ${on !== padrao[dia][t] ? styles.pilulaAjuste : ''}`}
                          onClick={() => definir(dia, [t], !on)}
                        >
                          {CURTO[t]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.rodape}>
        <span className={styles.rodapeTexto}>
          {pendentes ? (
            <span className={styles.pendente}>
              {pendentes} dia{pendentes > 1 ? 's' : ''} com alteração não salva. O painel só muda depois de salvar.
            </span>
          ) : (
            'Os dias marcados entram no total de horas previstas e as faltas só contam nesses dias.'
          )}
        </span>
        {editavel && ajustados > 0 && (
          <button type="button" className={styles.botao} disabled={salvando} onClick={restaurar}>
            Restaurar padrão
          </button>
        )}
        {editavel && rascunho && (
          <button type="button" className={styles.botao} disabled={salvando} onClick={() => setRascunho(undefined)}>
            Descartar
          </button>
        )}
        {editavel ? (
          <button type="button" className={styles.salvar} disabled={salvando || !pendentes} onClick={() => salvar().catch(() => undefined)}>
            {salvando ? 'Salvando…' : 'Salvar calendário'}
          </button>
        ) : (
          <button type="button" className={styles.botao} onClick={onFechar}>
            Fechar
          </button>
        )}
      </div>
    </Modal>
  );
};
