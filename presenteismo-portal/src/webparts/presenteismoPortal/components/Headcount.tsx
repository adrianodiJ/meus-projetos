import * as React from 'react';
import styles from './QualityPortal.module.scss';
import { lerXlsx } from '../lib/xlsxLeitor';
import { dataHora, ehTemp, nz, ordenarPt } from '../lib/util';
import { type IColab, ROTULO_TURNO, type Turno, TURNOS } from '../models';
import type { IDados } from './tipos';
import { Cartao, Pagina } from './ui';

type CampoHc = 'm' | 'u' | 'n' | 'sn' | 'g' | 'c' | 'a' | 't' | 's';

const MAPA: Record<CampoHc, string[]> = {
  m: ['MATRICULA', 'RE'],
  u: ['USUARIO', 'USER', 'USER ID', 'USERID', 'LOGIN', 'USERNAME', 'ID', 'MATRICULA', 'RE', 'NOME DE USUARIO'],
  n: ['NOME', 'NAME', 'NOME COMPLETO', 'FIRST NAME'],
  sn: ['SOBRENOME', 'LAST NAME', 'SURNAME'],
  g: ['GESTOR', 'GESTOR IMEDIATO', 'CHEFIA', 'CHEFIA IMEDIATA', 'LIDER', 'MANAGER'],
  c: ['CARGO', 'USER GROUP', 'FUNCAO', 'GRUPO'],
  a: ['AREA', 'WORK TEAM', 'WORKTEAM', 'SETOR', 'EQUIPE'],
  t: ['TURNO', 'SHIFT', 'HORARIO'],
  s: ['STATUS', 'SITUACAO']
};
const ROTULO_CAMPO: Record<CampoHc, string> = {
  u: 'Usuário',
  m: 'Matrícula',
  n: 'Nome',
  sn: 'Sobrenome',
  g: 'Gestor',
  c: 'Cargo / função',
  a: 'Área',
  t: 'Turno',
  s: 'Status'
};
const OBRIGATORIOS: CampoHc[] = ['u', 't', 'g'];

interface IPlan {
  arquivo: string;
  folha: string;
  cabecalho: string[];
  linhas: Record<string, string>[];
  col: Record<CampoHc, string>;
}

interface IDiff {
  rows: IColab[];
  add: string[];
  rem: string[];
  inativos: number;
  semTurno: number;
  repetidos: number;
  addE: number;
  remE: number;
  alterados: number;
  nomesAdd: string[];
  nomesRem: string[];
}

function montarDiff(plan: IPlan, atuais: IColab[]): IDiff | undefined {
  const col = plan.col;
  if (!col.u || !col.t || !col.g) return undefined;
  const ATIVOS = ['ATIVO', 'ACTIVE', 'ATIVA'];
  const vistos: Record<string, boolean> = {};
  const rows: IColab[] = [];
  let inativos = 0;
  let semTurno = 0;
  let repetidos = 0;
  const g = (r: Record<string, string>, k: CampoHc): string => (col[k] ? String(r[col[k]] === undefined ? '' : r[col[k]]).trim() : '');
  plan.linhas.forEach((r) => {
    const u = g(r, 'u');
    if (!u) return;
    if (vistos[u.toUpperCase()]) {
      repetidos++;
      return;
    }
    if (col.s && ATIVOS.indexOf(nz(r[col.s])) < 0) {
      inativos++;
      return;
    }
    const x = nz(r[col.t]);
    const t: Turno | '' = x.indexOf('ADM') >= 0 ? 'ADM' : /PRIMEIRO|1/.test(x) ? 'PRIMEIRO' : /SEGUNDO|2/.test(x) ? 'SEGUNDO' : '';
    if (!t) {
      semTurno++;
      return;
    }
    vistos[u.toUpperCase()] = true;
    rows.push({ u, m: g(r, 'm'), n: `${g(r, 'n')} ${g(r, 'sn')}`.trim(), g: g(r, 'g'), c: g(r, 'c'), a: g(r, 'a'), t });
  });
  const velho: Record<string, IColab> = {};
  atuais.forEach((r) => (velho[r.u.toUpperCase()] = r));
  const novo: Record<string, IColab> = {};
  rows.forEach((r) => (novo[r.u.toUpperCase()] = r));
  const add = Object.keys(novo).filter((k) => !velho[k]);
  const rem = Object.keys(velho).filter((k) => !novo[k]);
  const campos: (keyof IColab)[] = ['g', 'a', 't', 'c', 'n', 'm'];
  return {
    rows,
    add,
    rem,
    inativos,
    semTurno,
    repetidos,
    addE: add.filter((k) => !ehTemp(novo[k])).length,
    remE: rem.filter((k) => !ehTemp(velho[k])).length,
    alterados: Object.keys(novo).filter((k) => velho[k] && campos.some((c) => (velho[k][c] || '') !== (novo[k][c] || ''))).length,
    nomesAdd: add.slice(0, 8).map((k) => novo[k].n || novo[k].u),
    nomesRem: rem.slice(0, 8).map((k) => velho[k].n || velho[k].u)
  };
}

export const Headcount: React.FC<{ d: IDados }> = ({ d }) => {
  const [plan, setPlan] = React.useState<IPlan | undefined>(undefined);
  const [lendo, setLendo] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const arquivoRef = React.useRef<HTMLInputElement>(null);
  const R = d.hc.rows;
  const efetivos = R.filter((r) => !ehTemp(r));
  const diff = React.useMemo(() => (plan ? montarDiff(plan, R) : undefined), [plan, R]);

  const ler = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    setLendo(true);
    try {
      const abas = await lerXlsx(f);
      const aba = abas.filter((a) => nz(a.nome) === 'TT ATIVOS')[0] || abas.filter((a) => nz(a.nome) === 'HEAD')[0] || abas[0];
      if (!aba || !aba.linhas.length) {
        d.avisar('erro', 'A planilha está vazia.');
        return;
      }
      const col = {} as Record<CampoHc, string>;
      (Object.keys(MAPA) as CampoHc[]).forEach((k) => {
        col[k] = aba.cabecalho.filter((x) => MAPA[k].indexOf(nz(x).replace(/[^A-Z0-9 ]/g, '')) >= 0)[0] || '';
      });
      setPlan({ arquivo: f.name, folha: aba.nome, cabecalho: aba.cabecalho, linhas: aba.linhas, col });
    } catch (e) {
      d.avisar('erro', `Não foi possível ler o arquivo: ${(e as Error).message || ''}`);
    } finally {
      setLendo(false);
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  const aplicar = async (): Promise<void> => {
    if (!diff || !plan) return;
    const ok = await d.gravar(async () => {
      await d.servicos.dados.gravar(`hc/${d.op}`, { rows: diff.rows, em: new Date().toISOString(), por: d.email, arq: plan.arquivo });
      d.registrar('headcount', `+${diff.add.length} / −${diff.rem.length} · ${diff.rows.length} ativos`);
    }, 'Headcount aplicado. As listas de presença já usam a nova base.');
    if (ok) setPlan(undefined);
  };

  const q = nz(busca);
  const lista = R.filter((r) => !q || nz(`${r.n} ${r.u} ${r.g} ${r.a}`).indexOf(q) >= 0).sort((a, b) => ordenarPt(a.n || a.u, b.n || b.u));

  const porGestor: Record<string, { g: string; e: number; t: number }> = {};
  R.forEach((r) => {
    const o = porGestor[r.g] || (porGestor[r.g] = { g: r.g, e: 0, t: 0 });
    if (ehTemp(r)) o.t++;
    else o.e++;
  });
  const gl = Object.keys(porGestor)
    .map((k) => porGestor[k])
    .sort((a, b) => b.e + b.t - (a.e + a.t));
  const max = Math.max(1, ...gl.map((x) => x.e + x.t));

  return (
    <Pagina titulo={`Headcount · ${d.opNome(d.op)}`} subtitulo="Cadastro de colaboradores da operação, atualizado por planilha">
      <Cartao titulo="Atualizar headcount">
        <label className={styles.campo} style={{ maxWidth: 440 }}>
          Planilha (.xlsx), aba TT ATIVOS, HEAD ou a primeira aba
          <input ref={arquivoRef} type="file" accept=".xlsx,.xlsm" disabled={lendo} onChange={(e) => ler(e.target.files ? e.target.files[0] : undefined).catch(() => undefined)} />
        </label>
        <p className={styles.mudo} style={{ margin: '10px 0 0' }}>
          Modelo esperado (aba TT ATIVOS): USER, MATRICULA, STATUS, GESTOR, NOME, SOBRENOME, CARGO, AREA, TURNO. Só entram linhas com status Active, e área terminada em TEMP conta como temporário.
        </p>
        <p className={styles.mudo} style={{ margin: '6px 0 0' }}>
          {R.length
            ? `Base atual: ${R.length} ativos${d.hc.em ? `, carregada em ${dataHora(d.hc.em)}${d.hc.por ? ` por ${d.nomeDe(d.hc.por)}` : ''}${d.hc.arq ? ` (${d.hc.arq})` : ''}` : ''}`
            : 'Ainda não há headcount. Envie a planilha para montar as listas de presença e o painel.'}
        </p>

        {plan && (
          <>
            <div className={styles.mapa}>
              {(Object.keys(ROTULO_CAMPO) as CampoHc[]).map((k) => (
                <label key={k} className={styles.campo}>
                  {ROTULO_CAMPO[k]}
                  {OBRIGATORIOS.indexOf(k) >= 0 ? ' *' : ''}
                  <select value={plan.col[k]} onChange={(e) => setPlan({ ...plan, col: { ...plan.col, [k]: e.target.value } })}>
                    <option value="">—</option>
                    {plan.cabecalho.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {diff ? (
              <>
                <p style={{ margin: '0 0 6px' }}>
                  <b>{diff.add.length}</b> entram · <b>{diff.rem.length}</b> saem · <b>{diff.alterados}</b> alterados · <b>{diff.rows.length}</b> ativos no arquivo
                </p>
                <p className={styles.mudo} style={{ margin: '0 0 6px' }}>
                  Efeito no Lançamento: +{diff.addE} e −{diff.remE} efetivos, mais os temporários, nas listas dos gestores.
                </p>
                {diff.nomesAdd.length > 0 && (
                  <p className={styles.mudo} style={{ margin: '0 0 4px' }}>
                    Entram: {diff.nomesAdd.join(', ')}
                    {diff.add.length > 8 ? '…' : ''}
                  </p>
                )}
                {diff.nomesRem.length > 0 && (
                  <p className={styles.mudo} style={{ margin: '0 0 4px' }}>
                    Saem: {diff.nomesRem.join(', ')}
                    {diff.rem.length > 8 ? '…' : ''}
                  </p>
                )}
                <p className={styles.mudo} style={{ margin: '0 0 12px' }}>
                  Ignorados: {diff.inativos} inativos, {diff.semTurno} sem turno reconhecido, {diff.repetidos} repetidos. Quem sai do arquivo deixa de contar no painel, e as faltas já lançadas continuam guardadas.
                </p>
                <div className={styles.linhaBotoes}>
                  <button type="button" className={styles.botaoAmarelo} onClick={() => aplicar().catch(() => undefined)}>
                    Aplicar ao cadastro
                  </button>
                  <button type="button" className={styles.botao} onClick={() => setPlan(undefined)}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.aviso2} style={{ marginBottom: 10 }}>
                  Escolha acima as colunas de usuário, turno e gestor (marcadas com *) para ver a prévia.
                </p>
                <button type="button" className={styles.botao} onClick={() => setPlan(undefined)}>
                  Cancelar
                </button>
              </>
            )}
          </>
        )}
      </Cartao>

      {R.length > 0 && (
        <>
          <div className={styles.grade}>
            <div className={styles.indicador}>
              <span>Ativos</span>
              <b>{R.length}</b>
            </div>
            <div className={styles.indicador}>
              <span>Efetivos</span>
              <b>{efetivos.length}</b>
            </div>
            <div className={styles.indicador}>
              <span>Temporários</span>
              <b>{R.length - efetivos.length}</b>
            </div>
            <div className={styles.indicador}>
              <span>Efetivos por turno</span>
              <small style={{ fontSize: 13, color: '#1f2328', fontWeight: 600 }}>{TURNOS.map((t) => `${ROTULO_TURNO[t]} ${efetivos.filter((r) => r.t === t).length}`).join(' · ')}</small>
            </div>
          </div>

          <Cartao titulo="Span of control">
            <div className={styles.legenda}>
              <span>
                <i style={{ background: '#ffcc00' }} />
                Efetivos
              </span>
              <span>
                <i style={{ background: '#cbd1d9' }} />
                Temporários
              </span>
              <span>Total por gestor, temporários incluídos: {R.length}</span>
            </div>
            {gl.map((x) => (
              <div key={x.g || 'sem'} className={styles.linhaGestor}>
                <div>
                  <b>{x.g || 'Sem gestor'}</b>
                  <div className={styles.mudo}>
                    {x.e} efetivos · {x.t} temporários
                  </div>
                </div>
                <div className={styles.trilha}>
                  <div className={styles.spanBarra} style={{ width: `${((x.e + x.t) / max) * 100}%` }}>
                    <i style={{ width: `${(x.e / (x.e + x.t)) * 100}%`, background: '#ffcc00' }} />
                    <i style={{ width: `${(x.t / (x.e + x.t)) * 100}%`, background: '#cbd1d9' }} />
                  </div>
                </div>
                <div className={styles.valor}>{x.e + x.t}</div>
              </div>
            ))}
          </Cartao>

          <Cartao titulo="Cadastro">
            <label className={styles.campo} style={{ maxWidth: 360, marginBottom: 12 }}>
              Buscar
              <input type="search" value={busca} placeholder="Nome, usuário, gestor ou área" onChange={(e) => setBusca(e.target.value)} />
            </label>
            <p className={styles.mudo} style={{ margin: '0 0 8px' }}>
              {lista.length} colaborador{lista.length === 1 ? '' : 'es'}
              {lista.length > 80 ? ' · mostrando os 80 primeiros' : ''}
            </p>
            <div className={styles.tabelaRolagem}>
              <table className={styles.tabelaEsq}>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Usuário</th>
                    <th>Gestor</th>
                    <th>Área</th>
                    <th>Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 80).map((r) => (
                    <tr key={r.u}>
                      <td>
                        {r.n || '—'}
                        {ehTemp(r) && <span className={styles.seloTemp}>TEMP</span>}
                      </td>
                      <td>{r.u}</td>
                      <td>{r.g}</td>
                      <td>{r.a}</td>
                      <td>{ROTULO_TURNO[r.t]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>
        </>
      )}
    </Pagina>
  );
};
