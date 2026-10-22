import * as React from 'react';
import { Icon, Modal } from '@fluentui/react';
import styles from './Calendario.module.scss';
import { conta, diasEscolhidos, inicioPeriodo, type IMarcacao, marcacaoDoMes, outrosMeses, periodo, regraFolhaPonto } from '../lib/calendario';
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

const nomeMes = (ym: string): string => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const mesCurto = (ym: string): string => `${MESES[Number(ym.slice(5, 7)) - 1].slice(0, 3)}/${ym.slice(2, 4)}`;
const mesDoDia = (d: string): string => d.slice(0, 7);

/** Quantos dias foram escolhidos para o cálculo do mês (selo do botão). */
export const diasNoCalculo = (d: IDados): number => diasEscolhidos(marcacaoDoMes(d.params, d.ym)).length;

/**
 * Botão do Painel que abre o calendário: o administrador escolhe os dias (de qualquer mês) que entram nas
 * horas previstas do mês de cálculo. Sem dias escolhidos, o mês não tem horas previstas.
 */
export const BotaoCalendario: React.FC<{ d: IDados; texto?: string }> = ({ d, texto }) => {
  const [aberto, setAberto] = React.useState(false);
  const n = diasNoCalculo(d);
  return (
    <>
      <button type="button" className={styles.abrir} onClick={() => setAberto(true)} title="Dias que entram nas horas previstas do mês">
        <Icon iconName="Calendar" />
        {texto || 'Calendário'}
        <span className={styles.abrirSelo} title={`${n} dia(s) escolhido(s) para o cálculo`}>
          {n}
        </span>
      </button>
      {aberto && <JanelaCalendario d={d} onFechar={() => setAberto(false)} />}
    </>
  );
};

const JanelaCalendario: React.FC<{ d: IDados; onFechar: () => void }> = ({ d, onFechar }) => {
  const salvo = marcacaoDoMes(d.params, d.ym);
  const [rascunho, setRascunho] = React.useState<IMarcacao | undefined>(undefined);
  const [salvando, setSalvando] = React.useState(false);
  /** turnos que os cliques no número do dia, no dia da semana e nas ações em bloco alteram */
  const [alvo, setAlvo] = React.useState<Turno[]>(TURNOS);
  /** mês exibido na grade (pode ser outro que o do cálculo) */
  const [visivel, setVisivel] = React.useState(d.ym);
  React.useEffect(() => {
    setRascunho(undefined);
    setVisivel(d.ym);
  }, [d.ym, d.op, d.params.cal]);

  const m: IMarcacao = rascunho || salvo;
  const escolhidos = diasEscolhidos(m);
  const editavel = d.admin;
  const hoje = iso(new Date());
  const [ini0, fim0] = periodo(d.ym, inicioPeriodo(d.params));

  // grade do mês exibido
  const [vy, vm] = visivel.split('-').map(Number);
  const lista = dias(iso(new Date(vy, vm - 1, 1)), iso(new Date(vy, vm, 0)));

  const diferentes = (a: IMarcacao, b: IMarcacao): string[] =>
    Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).filter((k) => TURNOS.some((t) => conta(a, k, t) !== conta(b, k, t)));
  const pendentes = rascunho ? diferentes(rascunho, salvo).length : 0;
  const guardar = (novo: IMarcacao): void => setRascunho(diferentes(novo, salvo).length ? novo : undefined);

  /** marca (true) ou desmarca (false) vários dias para os turnos */
  const aplicar = (diasAlvo: string[], turnos: Turno[], valor: boolean): void => {
    const novo: IMarcacao = { ...m };
    diasAlvo.forEach((dia) => {
      const x: Partial<Record<Turno, boolean>> = { ...(novo[dia] || {}) };
      turnos.forEach((t) => {
        if (valor) x[t] = true;
        else delete x[t];
      });
      if (Object.keys(x).length) novo[dia] = x;
      else delete novo[dia];
    });
    guardar(novo);
  };
  /** liga se algum turno do alvo está desligado; desliga se todos estão ligados */
  const alternar = (diasAlvo: string[]): void => {
    const todosLigados = diasAlvo.length > 0 && diasAlvo.every((x) => alvo.every((t) => conta(m, x, t)));
    aplicar(diasAlvo, alvo, !todosLigados);
  };
  const aplicarRegra = (): void => {
    const regra = regraFolhaPonto(ini0, fim0);
    const novo: IMarcacao = { ...m };
    Object.keys(regra).forEach((dia) => {
      const x: Partial<Record<Turno, boolean>> = { ...(novo[dia] || {}) };
      alvo.forEach((t) => {
        if (regra[dia][t]) x[t] = true;
        else delete x[t];
      });
      if (Object.keys(x).length) novo[dia] = x;
      else delete novo[dia];
    });
    guardar(novo);
  };
  const limparTudo = (): void => {
    const novo: IMarcacao = {};
    Object.keys(m).forEach((dia) => {
      const x: Partial<Record<Turno, boolean>> = { ...m[dia] };
      alvo.forEach((t) => delete x[t]);
      if (Object.keys(x).length) novo[dia] = x;
    });
    guardar(novo);
  };

  // horas previstas = efetivos do turno × horas por dia × dias escolhidos (como no painel)
  const efetivos = (t: Turno): number => d.equipe.filter((r) => r.t === t && !ehTemp(r)).length;
  const horasDia = (t: Turno): number => Number(d.params.h[t]) || 0;
  const diasDo = (t: Turno): number => escolhidos.filter((x) => conta(m, x, t)).length;
  const previstas = (t: Turno): number => efetivos(t) * horasDia(t) * diasDo(t);
  const totalPrevistas = TURNOS.reduce((s, t) => s + previstas(t), 0);
  const todosAlvo = alvo.length === TURNOS.length;
  const rotuloAlvo = todosAlvo ? 'todos os turnos' : alvo.map((t) => ROTULO_TURNO[t]).join(' e ');
  const trocarAlvo = (t: Turno | 'todos'): void => {
    if (t === 'todos') setAlvo(TURNOS);
    else setAlvo(todosAlvo ? [t] : alvo.indexOf(t) >= 0 ? (alvo.length > 1 ? alvo.filter((x) => x !== t) : alvo) : TURNOS.filter((x) => x === t || alvo.indexOf(x) >= 0));
  };

  // meses com dias escolhidos (atalhos) e quantos dias em cada
  const porMes: Record<string, number> = {};
  escolhidos.forEach((x) => (porMes[mesDoDia(x)] = (porMes[mesDoDia(x)] || 0) + 1));
  const mesesAtalho = Array.from(new Set([somarMes(d.ym, -1), d.ym, somarMes(d.ym, 1), ...Object.keys(porMes)])).sort();

  const sair = (acao: () => void): void => {
    if (pendentes && !window.confirm('Há dias escolhidos que ainda não foram salvos. Descartar?')) return;
    acao();
  };

  const salvar = async (): Promise<void> => {
    if (!rascunho) return;
    setSalvando(true);
    const cal = { ...(d.params.cal || {}) };
    if (diasEscolhidos(rascunho).length) cal[d.ym] = rascunho;
    else delete cal[d.ym];
    const novo: Record<string, unknown> = { ...d.params, cal };
    delete novo.aj; // formato antigo (ajustes sobre a regra), não é mais usado
    await d.gravar(async () => {
      await d.servicos.dados.gravar(`cfg/params_${d.op}`, novo);
      d.registrar('calendário', `${nomeMes(d.ym)} · ${diasEscolhidos(rascunho).length} dia(s) escolhido(s)`);
    }, `Calendário de ${nomeMes(d.ym)} salvo. O painel já usa os dias escolhidos.`);
    setSalvando(false);
  };

  const primeiro = escolhidos[0];
  const ultimo = escolhidos[escolhidos.length - 1];

  return (
    <Modal isOpen onDismiss={() => sair(onFechar)} containerClassName={styles.janela} isBlocking={false}>
      <div className={styles.topo}>
        <div className={styles.topoIcone}>
          <Icon iconName="Calendar" />
        </div>
        <div className={styles.topoTexto}>
          <small>Horas previstas · {d.opNome(d.op)}</small>
          <h2>Dias do cálculo de {nomeMes(d.ym)}</h2>
          <span>
            {escolhidos.length
              ? `${int(escolhidos.length)} dia${escolhidos.length > 1 ? 's' : ''} escolhido${escolhidos.length > 1 ? 's' : ''} · de ${fmt(primeiro)}/${primeiro.slice(0, 4)} a ${fmt(ultimo)}/${ultimo.slice(0, 4)}`
              : 'Nenhum dia escolhido: o mês ainda não tem horas previstas'}
          </span>
        </div>
        <div className={styles.navegar} title="Mês do cálculo (o mesmo do Painel)">
          <button type="button" aria-label="Mês de cálculo anterior" onClick={() => sair(() => d.setYm(somarMes(d.ym, -1)))}>
            <Icon iconName="ChevronLeft" />
          </button>
          <b>Cálculo de {nomeMes(d.ym)}</b>
          <button type="button" aria-label="Próximo mês de cálculo" onClick={() => sair(() => d.setYm(somarMes(d.ym, 1)))}>
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
            <small>Horas previstas de {mesCurto(d.ym)}</small>
            <b>{num(totalPrevistas)} h</b>
            <span>efetivos × horas por dia × dias escolhidos</span>
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
              <button type="button" onClick={() => aplicar(lista, alvo, true)} title={`Marca todos os dias de ${nomeMes(visivel)} para ${rotuloAlvo}`}>
                <Icon iconName="CheckboxComposite" /> Marcar {mesCurto(visivel)} inteiro
              </button>
              <button type="button" onClick={() => aplicar(lista, alvo, false)} title={`Desmarca os dias de ${nomeMes(visivel)} para ${rotuloAlvo}`}>
                <Icon iconName="Checkbox" /> Desmarcar {mesCurto(visivel)}
              </button>
              <button
                type="button"
                onClick={aplicarRegra}
                title={`Marca ${fmt(ini0)} a ${fmt(fim0)} pela folha ponto (domingo não conta; ADM folga aos sábados; 1º e 2º folgam os 2 primeiros sábados, 3 se houver 5) para ${rotuloAlvo}`}
              >
                <Icon iconName="Lightbulb" /> Aplicar regra da folha ponto
              </button>
              <button type="button" onClick={limparTudo} title={`Desmarca todos os dias do cálculo de ${nomeMes(d.ym)}, em todos os meses, para ${rotuloAlvo}`}>
                <Icon iconName="Delete" /> Limpar tudo
              </button>
            </div>
          </div>
        )}

        <div className={styles.meses}>
          <div className={styles.mesesNavegar}>
            <button type="button" aria-label="Mês anterior" onClick={() => setVisivel(somarMes(visivel, -1))}>
              <Icon iconName="ChevronLeft" />
            </button>
            <b>{nomeMes(visivel)}</b>
            <button type="button" aria-label="Próximo mês" onClick={() => setVisivel(somarMes(visivel, 1))}>
              <Icon iconName="ChevronRight" />
            </button>
          </div>
          <div className={styles.mesesAtalhos}>
            <span>Dias escolhidos por mês:</span>
            {mesesAtalho.map((x) => (
              <button key={x} type="button" className={x === visivel ? styles.mesAtivo : ''} aria-pressed={x === visivel} onClick={() => setVisivel(x)}>
                {mesCurto(x)}
                <i>{porMes[x] || 0}</i>
              </button>
            ))}
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
            <i className={styles.marcaOutro} /> já escolhido no cálculo de outro mês
          </span>
          <span>
            <i className={styles.marcaHoje} /> hoje
          </span>
          <span>
            {editavel
              ? `Clique no número do dia ou no dia da semana (ex.: SÁB) para marcar/desmarcar ${rotuloAlvo}; a pílula muda só aquele turno. Use as setas para escolher dias de outros meses.`
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
                  title={`Marcar/desmarcar todas as ${s.toLowerCase()}s de ${nomeMes(visivel)} para ${rotuloAlvo}`}
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
            {Array.from({ length: dt(lista[0]).getDay() }).map((_, i) => (
              <div key={`v${i}`} />
            ))}
            {lista.map((dia) => {
              const algum = TURNOS.some((t) => conta(m, dia, t));
              const outros = outrosMeses(d.params, d.ym, dia);
              return (
                <div key={dia} className={`${styles.dia} ${algum ? styles.diaEscolhido : styles.diaVazio} ${dia === hoje ? styles.diaHoje : ''}`}>
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
                    {outros.length > 0 ? (
                      <span className={styles.diaOutro} title={`Este dia também está no cálculo de ${outros.map(nomeMes).join(', ')}`}>
                        em {outros.map(mesCurto).join(', ')}
                      </span>
                    ) : (
                      <span className={styles.diaMes}>{SEMANA[dt(dia).getDay()].toLowerCase()}</span>
                    )}
                  </div>
                  <div className={styles.pilulas}>
                    {TURNOS.map((t) => {
                      const on = conta(m, dia, t);
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={!editavel}
                          aria-pressed={on}
                          aria-label={`${ROTULO_TURNO[t]} em ${fmt(dia)}: ${on ? 'conta' : 'não conta'}`}
                          title={`${ROTULO_TURNO[t]}: ${on ? 'conta' : 'não conta'}`}
                          className={`${styles.pilula} ${on ? styles.pilulaOn : ''}`}
                          onClick={() => aplicar([dia], [t], !on)}
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
            'Só os dias marcados entram nas horas previstas, e as faltas só contam nesses dias.'
          )}
        </span>
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
