import { type IAbs, type IColab, type ILancamento, ROTULO_TURNO, TURNOS } from '../models';
import type { Celula, IPlanilhaXlsx } from './xlsx';
import { chave, dias, dmy, dt, ehTemp, ordenarPt, p2, previsto } from './util';
import type { Turno } from '../models';

export interface IRelatorio {
  planilhas: IPlanilhaXlsx[];
  arquivo: string;
  mensagem: string;
  resumoLog: string;
}

export interface IEscopo {
  /** colaboradores incluídos (já filtrados por turno, área, gestor e equipe do usuário) */
  colabs: IColab[];
  inicio: string;
  fim: string;
  op: string;
  /** o dia conta para o turno? (calendário do painel); sem ele vale domingo/sábado ADM fora */
  conta?: (d: string, t: Turno) => boolean;
}

export const idLancamento = (op: string, d: string, g: string): string => `${op}_${d}_${chave(g)}`;

const dataBr = (t: string | undefined): string => (t ? new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const dataHoraBr = (t: string | undefined): string =>
  t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/** Histórico ABS: uma linha por ausência (falta injustificada ou atestado), incluindo temporários. */
export function relatorioAbs(docs: ILancamento[], esc: IEscopo, abs: IAbs, quemLancou: (email: string) => string): IRelatorio {
  void quemLancou;
  const ix: Record<string, IColab> = {};
  esc.colabs.forEach((r) => (ix[r.u] = r));
  const semLdap = new Set<string>();
  const L: { d: string; g: string; n: string; r: Celula[] }[] = [];
  docs.forEach((d) => {
    const e = d.e || {};
    Object.keys(e).forEach((u) => {
      const r = ix[u];
      const x = e[u];
      if (!r || !x || x.p !== false) return;
      const area = String(r.a || '').replace(/TEMP\s*$/i, '').trim();
      const gi = abs.gest[chave(r.g)] || {};
      const re = String(r.m || r.u);
      const gn = gi.nome || '';
      const gl = gi.ldap || '';
      if (!gl) semLdap.add(r.g);
      L.push({
        d: d.d,
        g: gn,
        n: r.n || r.u,
        r: [
          `${d.d.slice(8)}${d.d.slice(5, 7)}${d.d.slice(0, 4)}${re}2`,
          re,
          `${r.n || r.u}-${re}`,
          String(abs.funcao[chave(r.c)] || r.c || '').toUpperCase(),
          gl,
          gn,
          String(x.m || '').toUpperCase(),
          ROTULO_TURNO[r.t].toUpperCase(),
          String(abs.setor[chave(area)] || area).toUpperCase(),
          abs.contract || 'DHL',
          gn && gl ? `${gn}-${gl}` : '',
          dmy(d.d),
          dataBr(x.em || d.em)
        ]
      });
    });
  });
  L.sort((p, q) => p.d.localeCompare(q.d) || p.g.localeCompare(q.g, 'pt-BR') || p.n.localeCompare(q.n, 'pt-BR'));
  const cab: [string, number][] = [
    ['ABS_ID', 18],
    ['RE', 12],
    ['NOME', 44],
    ['FUNÇÃO', 14],
    ['GESTOR_LDAP', 13],
    ['GESTOR_NAME', 40],
    ['MOTIVO', 22],
    ['TURNO', 10],
    ['SETOR', 20],
    ['CONTRACT', 10],
    ['LAUNCHED_BY_PROP', 52],
    ['ABS_DATE', 12],
    ['LAUNCH_DATE', 12]
  ];
  const agora = new Date();
  return {
    planilhas: [
      {
        nome: `ABS${p2(agora.getDate())}-${p2(agora.getMonth() + 1)}`,
        colunas: cab.map(([titulo, largura]) => ({ titulo, largura })),
        linhas: L.map((x) => x.r),
        congelarCabecalho: true,
        filtro: true
      }
    ],
    arquivo: `ABS - HISTORICO BASE ${p2(agora.getDate())}_${p2(agora.getMonth() + 1)}_${agora.getFullYear()} ${p2(agora.getHours())}_${p2(agora.getMinutes())}.xlsx`,
    mensagem: `Relatório pronto: ${L.length} ausência${L.length === 1 ? '' : 's'}.${
      semLdap.size ? ` ${semLdap.size} gestor${semLdap.size > 1 ? 'es' : ''} sem LDAP cadastrado (${Array.from(semLdap).join(', ')}). Preencha na Administração.` : ''
    }`,
    resumoLog: `${L.length} ausências (ABS)`
  };
}

/** Resumo por gestor (dia a dia, com pendências) e Lançamentos (um colaborador por linha). */
export function relatorioResumo(docs: ILancamento[], esc: IEscopo, quemLancou: (email: string) => string): IRelatorio {
  const ix: Record<string, IColab> = {};
  esc.colabs.forEach((r) => (ix[r.u] = r));
  const porId: Record<string, ILancamento> = {};
  docs.forEach((d) => (porId[d.id] = d));

  const det: Celula[][] = [];
  docs.forEach((d) => {
    const e = d.e || {};
    Object.keys(e).forEach((u) => {
      const r = ix[u];
      const x = e[u];
      if (!r || !x) return;
      det.push([
        dt(d.d),
        r.g,
        r.u,
        r.n,
        r.c,
        r.a,
        ROTULO_TURNO[r.t],
        ehTemp(r) ? 'Temporário' : 'Efetivo',
        x.p ? 'Sim' : 'Não',
        x.p ? '' : x.m || '',
        x.o || '',
        quemLancou(d.por),
        dataHoraBr(x.em || d.em)
      ]);
    });
  });
  det.sort((p, q) => (p[0] as Date).getTime() - (q[0] as Date).getTime() || ordenarPt(String(p[1]), String(q[1])) || ordenarPt(String(p[3]), String(q[3])));

  const G: Record<string, { t: string; g: string; us: IColab[] }> = {};
  esc.colabs.forEach((r) => {
    const k = `${r.t}|${chave(r.g)}`;
    (G[k] || (G[k] = { t: r.t, g: r.g, us: [] })).us.push(r);
  });
  const grp = Object.keys(G)
    .map((k) => G[k])
    .sort((p, q) => TURNOS.indexOf(p.t as never) - TURNOS.indexOf(q.t as never) || ordenarPt(p.g, q.g));
  const res: Celula[][] = [];
  dias(esc.inicio, esc.fim).forEach((d) => {
    grp.forEach((o) => {
      if (!(esc.conta || previsto)(d, o.t as Turno)) return;
      const doc = porId[idLancamento(esc.op, d, o.g)];
      const e = doc && doc.e ? doc.e : {};
      let pr = 0;
      let au = 0;
      let ij = 0;
      let at = 0;
      let ot = 0;
      let sl = 0;
      o.us.forEach((r) => {
        const x = e[r.u];
        if (!x) sl++;
        else if (x.p) pr++;
        else {
          au++;
          if (x.m === 'Atestado') at++;
          else if (x.m === 'Falta injustificada') ij++;
          else ot++;
        }
      });
      res.push([dt(d), ROTULO_TURNO[o.t], o.g, o.us.length, pr, au, ij, at, ot, sl, doc && doc.em ? dataHoraBr(doc.em) : '', sl ? 'SIM' : 'NÃO']);
    });
  });

  const col = (titulo: string, largura: number, formato?: 'data' | 'inteiro'): { titulo: string; largura: number; formato?: 'data' | 'inteiro' } => ({
    titulo,
    largura,
    formato
  });
  return {
    planilhas: [
      {
        nome: 'Resumo por gestor',
        colunas: [
          col('Data', 11, 'data'),
          col('Turno', 10),
          col('Gestor', 24),
          col('Colaboradores', 14, 'inteiro'),
          col('Presentes', 10, 'inteiro'),
          col('Ausências', 10, 'inteiro'),
          col('Injustificadas', 14, 'inteiro'),
          col('Atestados', 10, 'inteiro'),
          col('Outros motivos', 15, 'inteiro'),
          col('Sem lançamento', 17, 'inteiro'),
          col('Último lançamento', 18),
          col('Pendente?', 10)
        ],
        linhas: res,
        congelarCabecalho: true,
        filtro: true
      },
      {
        nome: 'Lançamentos',
        colunas: [
          col('Data', 11, 'data'),
          col('Gestor', 24),
          col('Usuário', 12),
          col('Nome', 30),
          col('Cargo', 14),
          col('Área', 16),
          col('Turno', 10),
          col('Vínculo', 12),
          col('Presente', 9),
          col('Motivo', 20),
          col('Observação', 32),
          col('Lançado por', 22),
          col('Lançado em', 17)
        ],
        linhas: det,
        congelarCabecalho: true,
        filtro: true
      }
    ],
    arquivo: `Presenteismo_${esc.inicio}_a_${esc.fim}.xlsx`,
    mensagem: `Relatório pronto: ${det.length} lançamentos e ${res.length} linhas de resumo.`,
    resumoLog: `${det.length} lançamentos`
  };
}
