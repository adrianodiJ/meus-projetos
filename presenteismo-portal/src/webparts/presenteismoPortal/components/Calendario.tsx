import * as React from 'react';
import { Icon, Modal } from '@fluentui/react';
import styles from './Calendario.module.scss';
import { periodoDoMes } from '../lib/calculo';
import { type IAjustes, mapaDias, regraPadrao } from '../lib/calendario';
import { dias, dt, fmt, iso, num } from '../lib/util';
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

  const definir = (dia: string, turnos: Turno[], valor: boolean): void => {
    const novo: IAjustes = { ...aj };
    const x: Partial<Record<Turno, boolean>> = { ...(novo[dia] || {}) };
    turnos.forEach((t) => {
      if (padrao[dia][t] === valor) delete x[t];
      else x[t] = valor;
    });
    if (Object.keys(x).length) novo[dia] = x;
    else delete novo[dia];
    setRascunho(novo);
  };

  const restaurar = (): void => {
    const novo: IAjustes = { ...aj };
    lista.forEach((x) => delete novo[x]);
    setRascunho(novo);
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
          {TURNOS.map((t) => {
            const n = lista.filter((x) => mapa[x][t]).length;
            return (
              <div key={t} className={styles.turno}>
                <div className={styles.turnoNumero}>{n}</div>
                <div className={styles.turnoTexto}>
                  <b>{ROTULO_TURNO[t]}</b>
                  <span>
                    dias · {num(n * (Number(d.params.h[t]) || 0))} h por pessoa
                  </span>
                </div>
              </div>
            );
          })}
          <div className={styles.regra}>
            <b>Regra da folha ponto</b>
            Domingo não conta. ADM folga todos os sábados. 1º e 2º turno folgam os 2 primeiros sábados (3 quando o período tem 5).
          </div>
        </div>

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
          <span>{editavel ? 'Clique no turno para marcar ou desmarcar; clique no número para o dia inteiro.' : 'Só o administrador altera o calendário.'}</span>
        </div>

        <div className={styles.rolagem}>
          <div className={styles.grade}>
            {SEMANA.map((s, i) => (
              <div key={s} className={`${styles.diaSemana} ${i === 0 || i === 6 ? styles.fimDeSemana : ''}`}>
                {s}
              </div>
            ))}
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
                      title={editavel ? (algum ? 'Desmarcar o dia inteiro' : 'Marcar o dia inteiro') : undefined}
                      onClick={() => definir(dia, TURNOS, !algum)}
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
