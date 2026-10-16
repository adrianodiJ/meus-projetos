import * as React from 'react';
import styles from './QualityPortal.module.scss';
import { periodoDoMes } from '../lib/calculo';
import { type IAjustes, mapaDias, regraPadrao } from '../lib/calendario';
import { dias, dt, fmt } from '../lib/util';
import { ROTULO_TURNO, type Turno, TURNOS } from '../models';
import type { IDados } from './tipos';
import { Cartao } from './ui';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CURTO: Record<Turno, string> = { ADM: 'ADM', PRIMEIRO: '1º', SEGUNDO: '2º' };
const VERDE = '#1e9e3e';

/**
 * Calendário do período: quais dias contam no cálculo para cada turno.
 * Parte da regra da folha ponto (domingo não conta; ADM folga aos sábados; 1º e 2º folgam os 2 primeiros
 * sábados, ou 3 se o período tiver 5) e o administrador marca ou desmarca dias (feriados, inventário…).
 */
export const Calendario: React.FC<{ d: IDados }> = ({ d }) => {
  const [ini, fim] = periodoDoMes(d.ym, d.params);
  const [rascunho, setRascunho] = React.useState<IAjustes | undefined>(undefined);
  const [salvando, setSalvando] = React.useState(false);
  React.useEffect(() => setRascunho(undefined), [d.ym, d.op, d.params.aj]);

  const aj: IAjustes = rascunho || d.params.aj || {};
  const padrao = regraPadrao(ini, fim);
  const mapa = mapaDias(ini, fim, aj);
  const lista = dias(ini, fim);
  const editavel = d.admin;
  const alterado = !!rascunho;

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
    lista.forEach((dia) => delete novo[dia]);
    setRascunho(novo);
  };

  const salvar = async (): Promise<void> => {
    if (!rascunho) return;
    setSalvando(true);
    const n = lista.filter((dia) => rascunho[dia]).length;
    await d.gravar(async () => {
      await d.servicos.dados.gravar(`cfg/params_${d.op}`, { ...d.params, aj: rascunho });
      d.registrar('calendário', `${fmt(ini)} a ${fmt(fim)} · ${n} dia(s) ajustado(s)`);
    }, 'Calendário salvo. O painel já usa os novos dias.');
    setSalvando(false);
  };

  const ajustadosNoPeriodo = lista.filter((dia) => aj[dia]).length;
  const vazios = dt(ini).getDay();

  return (
    <Cartao
      titulo={`Dias que contam no cálculo · ${fmt(ini)} a ${fmt(fim)}`}
      acao={
        editavel ? (
          <div className={styles.linhaBotoes}>
            {ajustadosNoPeriodo > 0 && (
              <button type="button" className={styles.botao} disabled={salvando} onClick={restaurar}>
                Restaurar padrão
              </button>
            )}
            {alterado && (
              <>
                <button type="button" className={styles.botao} disabled={salvando} onClick={() => setRascunho(undefined)}>
                  Descartar
                </button>
                <button type="button" className={styles.botaoAmarelo} disabled={salvando} onClick={() => salvar().catch(() => undefined)}>
                  {salvando ? 'Salvando…' : 'Salvar calendário'}
                </button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      <p className={styles.mudo} style={{ margin: '0 0 10px' }}>
        Regra da folha ponto: domingo não conta; ADM folga todos os sábados; 1º e 2º turno folgam os 2 primeiros sábados do período (3 quando há 5 sábados).
        {editavel ? ' Clique no turno para marcar ou desmarcar o dia, ou na data para o dia inteiro.' : ' Só o administrador altera.'}
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10, fontSize: 12 }}>
        {TURNOS.map((t) => (
          <span key={t}>
            <b>{ROTULO_TURNO[t]}</b>: {lista.filter((dia) => mapa[dia][t]).length} dias
          </span>
        ))}
        <span className={styles.mudo}>
          <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: VERDE, marginRight: 4 }} />
          conta
        </span>
        <span className={styles.mudo}>
          <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#e5e7eb', marginRight: 4 }} />
          não conta
        </span>
        <span className={styles.mudo}>
          <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, border: '2px dashed #f28c00', marginRight: 4 }} />
          alterado à mão
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
        {SEMANA.map((s) => (
          <div key={s} className={styles.mudo} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600 }}>
            {s}
          </div>
        ))}
        {Array.from({ length: vazios }).map((_, i) => (
          <div key={`v${i}`} />
        ))}
        {lista.map((dia) => {
          const algum = TURNOS.some((t) => mapa[dia][t]);
          return (
            <div
              key={dia}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '4px 4px 6px',
                background: algum ? '#fff' : '#f8f9fb',
                minWidth: 0
              }}
            >
              <button
                type="button"
                disabled={!editavel}
                title={editavel ? (algum ? 'Desmarcar o dia inteiro' : 'Marcar o dia inteiro') : undefined}
                onClick={() => definir(dia, TURNOS, !algum)}
                style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 700, fontSize: 12, cursor: editavel ? 'pointer' : 'default', color: algum ? '#1f2328' : '#9aa1ab' }}
              >
                {fmt(dia)}
              </button>
              <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                {TURNOS.map((t) => {
                  const on = mapa[dia][t];
                  const mudou = on !== padrao[dia][t];
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!editavel}
                      aria-pressed={on}
                      aria-label={`${ROTULO_TURNO[t]} em ${fmt(dia)}: ${on ? 'conta' : 'não conta'}`}
                      onClick={() => definir(dia, [t], !on)}
                      style={{
                        flex: '1 1 auto',
                        minWidth: 26,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 0',
                        borderRadius: 4,
                        cursor: editavel ? 'pointer' : 'default',
                        color: on ? '#fff' : '#6b7280',
                        background: on ? VERDE : '#e5e7eb',
                        textDecoration: on ? 'none' : 'line-through',
                        border: mudou ? '2px dashed #f28c00' : '2px solid transparent'
                      }}
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
      {alterado && <p style={{ margin: '10px 0 0', fontWeight: 600, color: '#b45309' }}>Alterações ainda não salvas: o painel só muda depois de salvar.</p>}
    </Cartao>
  );
};
