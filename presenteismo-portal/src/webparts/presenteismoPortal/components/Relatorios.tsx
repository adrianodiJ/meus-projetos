import * as React from 'react';
import styles from './QualityPortal.module.scss';
import { baixarArquivo, gerarXlsx, TIPO_XLSX } from '../lib/xlsx';
import { relatorioAbs, relatorioResumo } from '../lib/relatorios';
import { dias, fmt, iso, ordenarPt, unicos } from '../lib/util';
import { periodoDoMes } from '../lib/calculo';
import { contadorDeDias } from '../lib/calendario';
import { ROTULO_TURNO, TURNOS } from '../models';
import type { IDados } from './tipos';
import { Aviso, Pagina } from './ui';

type Tipo = 'abs' | 'res';

export const Relatorios: React.FC<{ d: IDados }> = ({ d }) => {
  const td = iso(new Date());
  const [ini0, fim0] = periodoDoMes(d.ym, d.params);
  const [tipo, setTipo] = React.useState<Tipo>('abs');
  const [r0, setR0] = React.useState(ini0 > td ? td : ini0);
  const [r1, setR1] = React.useState(fim0 > td ? td : fim0);
  const [rt, setRt] = React.useState('');
  const [ra, setRa] = React.useState('');
  const [rg, setRg] = React.useState('');
  const [gerando, setGerando] = React.useState(false);

  if (!d.hc.rows.length) {
    return (
      <Pagina titulo="Relatórios">
        <Aviso titulo="Nenhum headcount carregado" texto={d.admin ? 'Importe a planilha na aba Headcount primeiro.' : 'O administrador ainda não carregou o headcount.'} />
      </Pagina>
    );
  }

  const gestores = unicos(d.equipe.map((r) => r.g)).sort(ordenarPt);
  const areas = unicos(d.equipe.map((r) => r.a).filter(Boolean)).sort(ordenarPt);

  const exportar = async (): Promise<void> => {
    const fim = r1 > td ? td : r1;
    if (!r0 || !r1 || r0 > fim) {
      d.avisar('erro', 'Informe a data mínima e a data máxima, até hoje.');
      return;
    }
    if (dias(r0, fim).length > 366) {
      d.avisar('erro', 'O período máximo é de 366 dias.');
      return;
    }
    setGerando(true);
    d.avisar('info', 'Gerando o relatório…');
    try {
      const colabs = d.equipe.filter((r) => (!rt || r.t === rt) && (!ra || r.a === ra) && (!rg || r.g === rg));
      // busca em janelas de 31 dias para não estourar o limite de itens da consulta
      const docs = [];
      for (let s = r0; s <= fim; ) {
        const fimJanela = iso(new Date(new Date(`${s}T12:00:00`).getTime() + 30 * 864e5));
        const e = fimJanela > fim ? fim : fimJanela;
        docs.push(...(await d.servicos.lancamentos.periodo(d.op, s, e)));
        s = iso(new Date(new Date(`${e}T12:00:00`).getTime() + 864e5));
      }
      const esc = { colabs, inicio: r0, fim, op: d.op, conta: contadorDeDias(d.params) };
      const rel = tipo === 'abs' ? relatorioAbs(docs, esc, d.abs, d.nomeDe) : relatorioResumo(docs, esc, d.nomeDe);
      baixarArquivo(gerarXlsx(rel.planilhas), rel.arquivo, TIPO_XLSX);
      d.avisar('ok', rel.mensagem);
      d.registrar('exportou', `${fmt(r0)} a ${fmt(fim)} · ${rel.resumoLog}`);
    } catch (e) {
      d.avisar('erro', `Não foi possível gerar o relatório: ${(e as Error).message || 'erro'}`);
    } finally {
      setGerando(false);
    }
  };

  return (
    <Pagina titulo="Relatórios" subtitulo="Exportação dos lançamentos em Excel (somente a sua equipe)">
      <section className={styles.cartao}>
        <div className={styles.cartaoTopo}>
          <h3>Relatório de lançamentos em Excel</h3>
        </div>
        <div className={styles.fileira}>
          <label className={styles.campo}>
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              <option value="abs">Histórico ABS (formato ABS+)</option>
              <option value="res">Resumo e lançamentos (com pendências)</option>
            </select>
          </label>
          <label className={styles.campo}>
            Data mínima
            <input type="date" value={r0} max={td} onChange={(e) => setR0(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Data máxima
            <input type="date" value={r1} max={td} onChange={(e) => setR1(e.target.value)} />
          </label>
          <label className={styles.campo}>
            Turno
            <select value={rt} onChange={(e) => setRt(e.target.value)}>
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
            <select value={ra} onChange={(e) => setRa(e.target.value)}>
              <option value="">Todas</option>
              {areas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className={styles.campo}>
            Gestor
            <select value={rg} onChange={(e) => setRg(e.target.value)}>
              <option value="">Todos</option>
              {gestores.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.botaoVermelho} disabled={gerando || !d.pm('exp')} onClick={() => exportar().catch(() => undefined)}>
            {gerando ? 'Gerando…' : 'Exportar Excel'}
          </button>
        </div>
        <p className={styles.mudo} style={{ margin: '10px 0 0' }}>
          {tipo === 'abs'
            ? 'Uma aba no mesmo formato do histórico do ABS+, com uma linha por ausência (falta injustificada e atestado), incluindo temporários. Gestor, setor e função usam o cadastro da Administração.'
            : 'Duas abas: Resumo por gestor (dia a dia, com as pendências) e Lançamentos (um colaborador por linha, com motivo, observação e quem lançou).'}
        </p>
      </section>
    </Pagina>
  );
};
