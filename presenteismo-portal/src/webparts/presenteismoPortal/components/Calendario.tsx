import * as React from 'react';
import { ContextualMenu, ContextualMenuItemType, DirectionalHint, Icon, Modal } from '@fluentui/react';
import styles from './Calendario.module.scss';
import { conta, diasEscolhidos, type IMarcacao, marcacao, marcacaoDoMes, periodoFolha, recorte, regraFolhaPonto } from '../lib/calendario';
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
const mesAbrev = (d: string): string => MESES[Number(d.slice(5, 7)) - 1].slice(0, 3);

/** Quantos dias marcados caem na folha ponto do mês (selo do botão). */
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
  // calendário único da operação: trocar o mês do cálculo não apaga nada, nem o que ainda não foi salvo
  const salvo = marcacao(d.params);
  const [rascunho, setRascunho] = React.useState<IMarcacao | undefined>(undefined);
  const [salvando, setSalvando] = React.useState(false);
  /** turnos que os cliques no dia, no dia da semana e nas ações em bloco alteram */
  const [alvo, setAlvo] = React.useState<Turno[]>(TURNOS);
  const [menuMais, setMenuMais] = React.useState(false);
  const botaoMais = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => setRascunho(undefined), [d.op]);

  const m: IMarcacao = rascunho || salvo;
  const editavel = d.admin;
  const hoje = iso(new Date());
  const [ini0, fim0] = periodoFolha(d.ym, d.params);
  const folha = dias(ini0, fim0);
  /** dias marcados que entram no cálculo deste mês (dentro da folha) */
  const escolhidos = diasEscolhidos(recorte(m, ini0, fim0));

  // grade: semanas completas (domingo a sábado) em volta da folha
  const inicioGrade = iso(new Date(dt(ini0).getTime() - dt(ini0).getDay() * 864e5));
  const fimGrade = iso(new Date(dt(fim0).getTime() + (6 - dt(fim0).getDay()) * 864e5));
  const grade = dias(inicioGrade, fimGrade);

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

  // horas previstas = efetivos do turno × horas por dia × dias marcados na folha (como no painel)
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

  /** apaga os dias marcados de todos os meses (para os turnos escolhidos), depois de confirmar */
  const limparTudo = (): void => {
    const marcados = diasEscolhidos(m).filter((x) => alvo.some((t) => conta(m, x, t)));
    if (!marcados.length) {
      window.alert('Não há dias marcados para limpar.');
      return;
    }
    const meses = Array.from(new Set(marcados.map((x) => x.slice(0, 7)))).length;
    const aviso =
      `Desmarcar ${marcados.length} dia${marcados.length > 1 ? 's' : ''} em ${meses} ${meses > 1 ? 'meses' : 'mês'} do calendário (${rotuloAlvo})?\n\n` +
      'Isso zera as horas previstas de todos os meses com esses dias. Nada é gravado até você clicar em Salvar; antes disso, Descartar desfaz.';
    if (!window.confirm(aviso)) return;
    aplicar(marcados, alvo, false);
  };
  const totalMarcados = diasEscolhidos(m).length;

  const sair = (acao: () => void): void => {
    if (pendentes && !window.confirm('Há dias marcados que ainda não foram salvos. Descartar?')) return;
    acao();
  };

  const salvar = async (): Promise<void> => {
    if (!rascunho) return;
    setSalvando(true);
    const novo: Record<string, unknown> = { ...d.params, dias: rascunho };
    delete novo.cal; // formato anterior (dias por mês de cálculo), já juntado no calendário único
    delete novo.aj; // formato mais antigo (ajustes sobre a regra)
    const ok = await d.gravar(async () => {
      await d.servicos.dados.gravar(`cfg/params_${d.op}`, novo);
      d.registrar('calendário', `${pendentes} dia(s) alterado(s) · folha de ${nomeMes(d.ym)} com ${diasEscolhidos(recorte(rascunho, ini0, fim0)).length} dia(s)`);
    }, 'Calendário salvo. O painel já usa os dias marcados.');
    if (ok) setRascunho(undefined);
    setSalvando(false);
  };

  return (
    <Modal isOpen onDismiss={() => sair(onFechar)} containerClassName={styles.janela} isBlocking={false}>
      <div className={styles.topo}>
        <div className={styles.topoTexto}>
          <small>Folha ponto · {d.opNome(d.op)}</small>
          <h2>Dias do cálculo</h2>
        </div>
        <div className={styles.navegar}>
          <button type="button" aria-label="Mês anterior" onClick={() => d.setYm(somarMes(d.ym, -1))}>
            ‹
          </button>
          <span>
            <b>{nomeMes(d.ym)}</b>
            <small>
              {fmt(ini0)} a {fmt(fim0)}
            </small>
          </span>
          <button type="button" aria-label="Próximo mês" onClick={() => d.setYm(somarMes(d.ym, 1))}>
            ›
          </button>
        </div>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={() => sair(onFechar)}>
          ✕
        </button>
      </div>

      <div className={styles.resumo}>
        <div className={styles.resumoTotal}>
          <b>{num(totalPrevistas)} h</b>
          <span>horas previstas · {int(escolhidos.length)} dia{escolhidos.length === 1 ? '' : 's'} marcado{escolhidos.length === 1 ? '' : 's'}</span>
        </div>
        {TURNOS.map((t) => (
          <div key={t} className={styles.resumoTurno} title={`${int(efetivos(t))} efetivos × ${num(horasDia(t))} h × ${diasDo(t)} dias`}>
            <span>{ROTULO_TURNO[t]}</span>
            <b>
              {diasDo(t)} <small>dias</small>
            </b>
            <em>{num(previstas(t))} h</em>
          </div>
        ))}
      </div>

      {editavel && (
        <div className={styles.barra}>
          <div className={styles.segmentos} role="group" aria-label="Turnos que os cliques marcam">
            <button type="button" className={todosAlvo ? styles.segOn : ''} aria-pressed={todosAlvo} onClick={() => trocarAlvo('todos')}>
              Todos
            </button>
            {TURNOS.map((t) => {
              const on = !todosAlvo && alvo.indexOf(t) >= 0;
              return (
                <button key={t} type="button" className={on ? styles.segOn : ''} aria-pressed={on} onClick={() => trocarAlvo(t)}>
                  {CURTO[t]}
                </button>
              );
            })}
          </div>
          <span className={styles.barraEspaco} />
          <button
            type="button"
            className={styles.acao}
            onClick={aplicarRegra}
            title={`Marca só a folha de ${nomeMes(d.ym)} (${fmt(ini0)} a ${fmt(fim0)}) pela regra: domingo não conta; ADM folga aos sábados; 1º e 2º folgam os 2 primeiros sábados da folha (3 se houver 5) · para ${rotuloAlvo}. Os outros meses não mudam.`}
          >
            <Icon iconName="Lightbulb" /> Aplicar folha ponto de {mesAbrev(fim0)}/{fim0.slice(2, 4)}
          </button>
          <button ref={botaoMais} type="button" className={styles.acaoMais} aria-label="Mais ações" title="Mais ações" onClick={() => setMenuMais(true)}>
            ⋯
          </button>
          {menuMais && (
            <ContextualMenu
              target={botaoMais}
              onDismiss={() => setMenuMais(false)}
              directionalHint={DirectionalHint.bottomRightEdge}
              items={[
                { key: 'todos', text: `Marcar todos os dias da folha (${rotuloAlvo})`, iconProps: { iconName: 'CheckboxComposite' }, onClick: () => aplicar(folha, alvo, true) },
                { key: 'limpar', text: `Limpar a folha (${rotuloAlvo})`, iconProps: { iconName: 'Delete' }, onClick: () => aplicar(folha, alvo, false) },
                { key: 'div', itemType: ContextualMenuItemType.Divider },
                {
                  key: 'limparTudo',
                  text: `Limpar todos os dias marcados${totalMarcados ? ` (${totalMarcados} em todos os meses)` : ''}`,
                  secondaryText: todosAlvo ? undefined : rotuloAlvo,
                  iconProps: { iconName: 'EraseTool', style: { color: '#d40511' } },
                  disabled: totalMarcados === 0,
                  onClick: limparTudo
                }
              ]}
            />
          )}
        </div>
      )}

      <div className={styles.corpo}>
        <div className={styles.grade}>
          {SEMANA.map((s, i) => {
            const coluna = folha.filter((x) => dt(x).getDay() === i);
            return editavel ? (
              <button key={s} type="button" className={styles.diaSemana} title={`Marcar/desmarcar todas as ${s.toLowerCase()}s da folha`} onClick={() => alternar(coluna)}>
                {s}
              </button>
            ) : (
              <span key={s} className={styles.diaSemana}>
                {s}
              </span>
            );
          })}
          {grade.map((dia) => {
            if (dia < ini0 || dia > fim0) {
              return (
                <div key={dia} className={styles.diaFora} aria-hidden="true">
                  {Number(dia.slice(8))}
                </div>
              );
            }
            const algum = TURNOS.some((t) => conta(m, dia, t));
            const rotuloMes = dia === ini0 || dia.slice(8) === '01';
            return (
              <div key={dia} className={`${styles.dia} ${algum ? styles.diaOn : ''} ${dia === hoje ? styles.diaHoje : ''}`}>
                <button
                  type="button"
                  className={styles.diaNumero}
                  disabled={!editavel}
                  title={editavel ? `Marcar/desmarcar ${fmt(dia)} (${rotuloAlvo})` : fmt(dia)}
                  onClick={() => alternar([dia])}
                >
                  {Number(dia.slice(8))}
                  {rotuloMes && <small>{mesAbrev(dia)}</small>}
                </button>
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
        <p className={styles.dica}>
          {editavel
            ? 'Clique no número do dia para marcar ou desmarcar os turnos escolhidos acima, no nome do dia da semana para a coluna inteira, ou na pílula para um turno só.'
            : 'Só o administrador altera o calendário.'}
        </p>
      </div>

      <div className={styles.rodape}>
        <span className={styles.rodapeTexto}>
          {pendentes ? (
            <span className={styles.pendente}>
              {pendentes} dia{pendentes > 1 ? 's' : ''} alterado{pendentes > 1 ? 's' : ''}, ainda não salvo{pendentes > 1 ? 's' : ''}
            </span>
          ) : (
            'Só os dias marcados entram nas horas previstas e nas faltas do mês.'
          )}
        </span>
        {editavel && rascunho && (
          <button type="button" className={styles.botao} disabled={salvando} onClick={() => setRascunho(undefined)}>
            Descartar
          </button>
        )}
        {editavel ? (
          <button type="button" className={styles.salvar} disabled={salvando || !pendentes} onClick={() => salvar().catch(() => undefined)}>
            {salvando ? 'Salvando…' : 'Salvar'}
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
