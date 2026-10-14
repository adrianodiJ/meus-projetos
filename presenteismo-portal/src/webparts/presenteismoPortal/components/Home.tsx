import * as React from 'react';
import { Icon } from '@fluentui/react';
import styles from './QualityPortal.module.scss';
import { resumoPainel } from '../lib/calculo';
import { chave, dataHora, dmy, fp, int, num, ordenarPt } from '../lib/util';
import { ROTULO_TURNO } from '../models';
import type { IDados, Visao } from './tipos';
import { BotaoAtualizar, Cartao, Hero, Kpi, Paginacao, Vazio } from './ui';

interface IHomeProps {
  d: IDados;
  titulo: string;
  frase: string;
  imagemBanner: string;
}

type Aba = 'todos' | 'ausencias' | 'meus';

export const Home: React.FC<IHomeProps> = ({ d, frase, imagemBanner }) => {
  const [aba, setAba] = React.useState<Aba>('todos');
  const [pagina, setPagina] = React.useState(1);
  const gestoresEquipe = React.useMemo(() => {
    const s: Record<string, boolean> = {};
    d.equipe.forEach((r) => (s[chave(r.g)] = true));
    return s;
  }, [d.equipe]);

  const linhas = React.useMemo(() => {
    const porGestor: Record<string, { n: number; turno: string }> = {};
    d.equipe.forEach((r) => {
      const o = porGestor[chave(r.g)] || (porGestor[chave(r.g)] = { n: 0, turno: r.t });
      o.n++;
    });
    return d.lancMes
      .filter((l) => gestoresEquipe[chave(l.g)])
      .map((l) => {
        const e = Object.keys(l.e).map((u) => l.e[u]);
        const aus = e.filter((x) => !x.p).length;
        const g = porGestor[chave(l.g)];
        return { l, total: e.length, pres: e.length - aus, aus, turno: g ? ROTULO_TURNO[g.turno] : '—' };
      })
      .sort((a, b) => (b.l.em || '').localeCompare(a.l.em || '') || b.l.d.localeCompare(a.l.d) || ordenarPt(a.l.g, b.l.g));
  }, [d.lancMes, d.equipe, gestoresEquipe]);

  const filtradas = linhas.filter((x) => (aba === 'ausencias' ? x.aus > 0 : aba === 'meus' ? x.l.por === d.email : true));
  const porPagina = 5;
  const pag = Math.min(pagina, Math.max(1, Math.ceil(filtradas.length / porPagina)));
  const visiveis = filtradas.slice((pag - 1) * porPagina, pag * porPagina);

  const resumo = React.useMemo(() => resumoPainel(d.equipe, d.lancMes, d.ym, d.params), [d.equipe, d.lancMes, d.ym, d.params]);
  const ok = resumo.v !== null && resumo.v >= d.params.meta;
  const efetivos = resumo.rows.length;

  const equipesDia: Record<string, { completo: boolean }> = {};
  d.equipe.forEach((r) => {
    const l = d.lancDia.filter((x) => x.id === `${d.op}_${d.ldate}_${chave(r.g)}`)[0];
    const k = `${r.t}|${chave(r.g)}`;
    const o = equipesDia[k] || (equipesDia[k] = { completo: true });
    if (!l || !l.e[r.u]) o.completo = false;
  });
  const totalEquipes = Object.keys(equipesDia).length;
  const pendentes = Object.keys(equipesDia).filter((k) => !equipesDia[k].completo).length;

  const atalhos: { visao: Visao; icone: string; titulo: string; texto: string }[] = [
    { visao: 'painel', icone: 'BarChartVertical', titulo: 'Painel Presenteísmo', texto: 'Indicadores do mês' },
    { visao: 'acompanhamento', icone: 'BulletedList', titulo: 'Acompanhamento', texto: 'Lançamentos por gestor' },
    { visao: 'relatorios', icone: 'ReportDocument', titulo: 'Relatórios', texto: 'Exportar em Excel' },
    { visao: 'headcount', icone: 'People', titulo: 'Headcount', texto: 'Atualizar cadastro' },
    { visao: 'usuarios', icone: 'AddFriend', titulo: 'Usuários e acessos', texto: 'Coordenadores e pedidos de acesso' },
    { visao: 'administracao', icone: 'Settings', titulo: 'Administração', texto: 'Listas e parâmetros' }
  ];
  const permitido = (v: Visao): boolean =>
    v === 'painel' ? d.pm('painel') : v === 'acompanhamento' ? d.pm('acomp') : v === 'relatorios' ? d.pm('exp') : d.admin;

  const abas: { id: Aba; texto: string; n: number }[] = [
    { id: 'todos', texto: 'Todos', n: linhas.length },
    { id: 'ausencias', texto: 'Com ausências', n: linhas.filter((x) => x.aus > 0).length },
    { id: 'meus', texto: 'Meus lançamentos', n: linhas.filter((x) => x.l.por === d.email).length }
  ];

  return (
    <div className={styles.home}>
      <div className={styles.homePrincipal}>
        <Hero imagem={imagemBanner} frase={frase} />
        <div className={styles.kpis}>
          <Kpi
            valor={fp(resumo.v)}
            legenda="Presenteísmo do mês"
            icone="Medal"
            cor={resumo.v === null ? '#6B7280' : ok ? '#1E9E3E' : '#D40511'}
            detalhe={resumo.v === null ? `Meta ${fp(d.params.meta)}` : ok ? `Dentro da meta de ${fp(d.params.meta)}` : `${num(d.params.meta - (resumo.v || 0))} p.p. abaixo da meta`}
            detalheCor={resumo.v === null ? undefined : ok ? '#14632b' : '#9b1c22'}
            onClick={d.pm('painel') ? () => d.irPara('painel') : undefined}
          />
          <Kpi
            valor={int(resumo.faltasMes.length)}
            legenda="Faltas no mês"
            icone="UserRemove"
            cor="#D40511"
            detalhe="injustificadas + atestados"
            onClick={d.pm('painel') ? () => d.irPara('painel') : undefined}
          />
          <Kpi
            valor={int(pendentes)}
            legenda={`Equipes sem lançamento · ${d.ldate.slice(8)}/${d.ldate.slice(5, 7)}`}
            icone="Clock"
            cor="#F28C00"
            detalhe={pendentes ? `${int(totalEquipes - pendentes)} de ${int(totalEquipes)} equipes lançadas` : 'Todas as equipes lançaram'}
            detalheCor={pendentes ? undefined : '#14632b'}
            onClick={() => d.irPara(d.pm('acomp') ? 'acompanhamento' : 'lancamento')}
          />
          <Kpi
            valor={int(d.equipe.length)}
            legenda="Colaboradores"
            icone="People"
            cor="#1F6FD1"
            detalhe={`${int(efetivos)} efetivos · ${int(d.equipe.length - efetivos)} temporários`}
            onClick={d.pm('lanc') ? () => d.irPara('lancamento') : undefined}
          />
        </div>

        <div className={styles.atalhos}>
          {d.pm('lanc') && (
            <button type="button" className={`${styles.atalho} ${styles.atalhoPrincipal}`} onClick={() => d.irPara('lancamento')}>
              <Icon iconName="Add" />
              <span>
                <b>Lançar Presença</b>
                <small>Lista de presença do dia</small>
              </span>
            </button>
          )}
          {atalhos
            .filter((a) => permitido(a.visao))
            .map((a) => (
              <button key={a.visao} type="button" className={styles.atalho} onClick={() => d.irPara(a.visao)}>
                <Icon iconName={a.icone} />
                <span>
                  <b>{a.titulo}</b>
                  <small>{a.texto}</small>
                </span>
              </button>
            ))}
        </div>

        <Cartao
          titulo="Últimos Lançamentos"
          acao={
            d.pm('acomp') ? (
              <button type="button" className={styles.link} onClick={() => d.irPara('acompanhamento')}>
                Ver todos <Icon iconName="Forward" />
              </button>
            ) : undefined
          }
        >
          <div className={styles.tabelaWrap}>
            <div className={styles.tabelaTopo}>
              <div className={styles.abas} role="tablist">
                {abas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    className={a.id === aba ? styles.abaAtiva : ''}
                    onClick={() => {
                      setAba(a.id);
                      setPagina(1);
                    }}
                  >
                    {a.texto} ({a.n})
                  </button>
                ))}
              </div>
              <BotaoAtualizar atualizando={d.atualizando} atualizadoEm={d.atualizadoEm} onClick={() => d.recarregar().catch(() => undefined)} />
            </div>
            {visiveis.length === 0 ? (
              <Vazio titulo="Nenhum lançamento" texto="Quando uma lista de presença for lançada neste mês, ela aparece aqui." />
            ) : (
              <div className={styles.tabelaRolagem}>
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Gestor</th>
                      <th>Turno</th>
                      <th>Colaboradores</th>
                      <th>Presentes</th>
                      <th>Ausências</th>
                      <th>Lançado por</th>
                      <th>Lançado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((x) => (
                      <tr key={x.l.id} onClick={() => d.irPara('lancamento')}>
                        <td className={styles.colId}>{dmy(x.l.d)}</td>
                        <td>{x.l.g}</td>
                        <td>{x.turno}</td>
                        <td>{int(x.total)}</td>
                        <td>
                          <span className={styles.pill} style={{ background: '#dcfce7', color: '#14632b' }}>
                            {x.pres}
                          </span>
                        </td>
                        <td>
                          <span className={styles.pill} style={x.aus ? { background: '#fee2e2', color: '#9b1c22' } : { background: '#eef0f3', color: '#616a75' }}>
                            {x.aus}
                          </span>
                        </td>
                        <td>{d.nomeDe(x.l.por)}</td>
                        <td>{dataHora(x.l.em, 'curto')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Paginacao total={filtradas.length} porPagina={porPagina} pagina={pag} onPagina={setPagina} />
          </div>
        </Cartao>
      </div>
    </div>
  );
};
