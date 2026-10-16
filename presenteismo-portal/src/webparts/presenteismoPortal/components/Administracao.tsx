import * as React from 'react';
import { Icon } from '@fluentui/react';
import styles from './QualityPortal.module.scss';
import { chave, dataHora, ordenarPt, unicos } from '../lib/util';
import { type IAbs, ROTULO_TURNO, TURNOS } from '../models';
import { provisionarListas } from '../services/Provisionamento';
import type { IDados } from './tipos';
import { Cartao, Pagina } from './ui';

export const Administracao: React.FC<{ d: IDados; listasOk: boolean }> = ({ d, listasOk }) => {
  const [log, setLog] = React.useState<string[]>([]);
  const [progresso, setProgresso] = React.useState('');
  const [criando, setCriando] = React.useState(false);
  const [novaOp, setNovaOp] = React.useState('');

  const criarListas = async (): Promise<void> => {
    setCriando(true);
    setLog([]);
    try {
      const r = await provisionarListas(d.servicos.sp, setProgresso);
      setLog(r.length ? r : ['Tudo já estava criado: nada a fazer.']);
      d.avisar('ok', 'Listas conferidas.');
      await d.recarregar();
    } catch (e) {
      d.avisar('erro', `Não foi possível criar as listas: ${(e as Error).message}`);
    } finally {
      setCriando(false);
      setProgresso('');
    }
  };

  // ---------------------------------------------------------------- parâmetros e operações
  const salvarParametros = (h: Record<string, number>, meta: number, detalhe: string, ini?: number): void => {
    d.gravar(async () => {
      // mantém o calendário (ajustes de dias) e o início do período já gravados
      await d.servicos.dados.gravar(`cfg/params_${d.op}`, { ...d.params, h, meta, ini: ini === undefined ? d.params.ini : ini });
      d.registrar('parâmetro', detalhe);
    }, 'Parâmetro salvo.').catch(() => undefined);
  };

  const adicionarOp = (): void => {
    const nome = novaOp.trim().toUpperCase();
    const id = chave(nome);
    if (!nome) {
      d.avisar('erro', 'Digite o nome da operação.');
      return;
    }
    if (d.operacoes.some((o) => o.id === id)) {
      d.avisar('erro', 'Essa operação já existe.');
      return;
    }
    d.gravar(async () => {
      await d.servicos.dados.gravar('cfg/ops', { list: [...d.operacoes, { id, nome }] });
      d.registrar('operação', `adicionou ${nome}`);
    }, 'Operação adicionada. Selecione-a na barra superior e importe o headcount dela.').then((ok) => ok && setNovaOp('')).catch(() => undefined);
  };

  // ---------------------------------------------------------------- cadastro ABS
  const salvarAbs = (novo: IAbs, detalhe: string): void => {
    d.gravar(async () => {
      await d.servicos.dados.gravar(`cfg/abs_${d.op}`, novo);
      d.registrar('relatório ABS', detalhe);
    }, 'Salvo.').catch(() => undefined);
  };
  const setAbsGestor = (k: string, campo: 'nome' | 'ldap', v: string): void => {
    const atual = d.abs.gest[k] || {};
    if ((atual[campo] || '') === v.trim()) return;
    salvarAbs({ ...d.abs, gest: { ...d.abs.gest, [k]: { ...atual, [campo]: v.trim() } } }, `gestor · ${k}`);
  };
  const setAbsMapa = (tipo: 'setor' | 'funcao', k: string, v: string, padrao: string): void => {
    if ((d.abs[tipo][k] || padrao) === v.trim()) return;
    salvarAbs({ ...d.abs, [tipo]: { ...d.abs[tipo], [k]: v.trim() } }, `${tipo} · ${k}`);
  };

  const gestoresAbs = Array.from(new Map(d.hc.rows.map((r) => [chave(r.g), r.g] as [string, string])).entries()).sort((a, b) => ordenarPt(a[1], b[1]));
  const areasAbs = unicos(d.hc.rows.map((r) => String(r.a || '').replace(/TEMP\s*$/i, '').trim()).filter(Boolean)).sort();
  const cargos = unicos(d.hc.rows.map((r) => r.c).filter(Boolean)).sort();
  const campoTexto = (valor: string, ph: string, largura: number, onSalvar: (v: string) => void): JSX.Element => (
    <input
      key={valor}
      type="text"
      defaultValue={valor}
      placeholder={ph}
      aria-label={ph}
      style={{ width: largura, padding: '6px 8px', border: '1px solid #c9ced6', borderRadius: 6 }}
      onBlur={(e) => onSalvar(e.target.value)}
    />
  );

  return (
    <Pagina titulo="Administração" subtitulo={`Listas, operações, parâmetros e cadastros · operação ${d.opNome(d.op)}`}>
      <Cartao titulo="Listas do SharePoint">
        <p className={styles.mudo} style={{ margin: '0 0 10px' }}>
          {listasOk
            ? 'As listas de dados do portal estão criadas neste site. Rode de novo se uma coluna tiver sido apagada: só o que falta é recriado.'
            : 'As listas de dados ainda não existem neste site. Crie-as agora (é preciso ser proprietário do site). As listas criadas são PRES_Dados, PRES_Usuarios, PRES_Pedidos, PRES_Lancamentos e PRES_Historico.'}
        </p>
        <button type="button" className={listasOk ? styles.botao : styles.botaoAmarelo} disabled={criando} onClick={() => criarListas().catch(() => undefined)}>
          {criando ? progresso || 'Criando…' : listasOk ? 'Conferir listas e colunas' : 'Criar listas e colunas'}
        </button>
        {log.length > 0 && (
          <ul className={styles.mudo} style={{ margin: '10px 0 0', paddingLeft: 18 }}>
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </Cartao>

      {listasOk && (
        <>
          <Cartao
            titulo="Usuários e acessos"
            acao={
              <button type="button" className={styles.botaoAmarelo} onClick={() => d.irPara('usuarios')}>
                <Icon iconName="AddFriend" /> Abrir Usuários e acessos
              </button>
            }
          >
            <p className={styles.mudo} style={{ margin: 0 }}>
              {d.gestores.length} coordenador{d.gestores.length === 1 ? '' : 'es'} vindos do headcount
              {d.pedidos.length ? ` · ${d.pedidos.length} pedido${d.pedidos.length > 1 ? 's' : ''} de acesso aguardando análise` : ''}. Todos veem os indicadores; os coordenadores são criados e atualizados a cada upload do headcount.
            </p>
          </Cartao>

          <Cartao titulo="Operações">
            <p className={styles.mudo} style={{ margin: '0 0 10px' }}>
              Cada operação tem o próprio headcount, parâmetros e lançamentos. Atual: <b>{d.opNome(d.op)}</b>. Existentes: {d.operacoes.map((o) => o.nome).join(', ')}.
            </p>
            <div className={styles.fileira}>
              <label className={styles.campo}>
                Nova operação
                <input type="text" value={novaOp} placeholder="Nome da operação" onChange={(e) => setNovaOp(e.target.value)} />
              </label>
              <button type="button" className={styles.botaoAmarelo} onClick={adicionarOp}>
                Adicionar operação
              </button>
            </div>
          </Cartao>

          <Cartao titulo="Parâmetros">
            <div className={styles.fileira}>
              {TURNOS.map((t) => (
                <label key={t} className={styles.campo}>
                  {ROTULO_TURNO[t]} (h por dia)
                  <input
                    key={`${t}${d.params.h[t]}`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={d.params.h[t]}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (isNaN(v) || v === d.params.h[t]) return;
                      salvarParametros({ ...d.params.h, [t]: v }, d.params.meta, `${t} = ${v}`);
                    }}
                  />
                </label>
              ))}
              <label className={styles.campo}>
                Meta (%)
                <input
                  key={`meta${d.params.meta}`}
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={d.params.meta}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (isNaN(v) || v === d.params.meta) return;
                    salvarParametros(d.params.h, v, `meta = ${v}`);
                  }}
                />
              </label>
              <label className={styles.campo}>
                Início do período (dia da folha ponto)
                <input
                  key={`ini${d.params.ini || 1}`}
                  type="number"
                  step="1"
                  min="1"
                  max="28"
                  defaultValue={d.params.ini || 1}
                  onBlur={(e) => {
                    const v = Math.round(Number(e.target.value));
                    if (isNaN(v) || v < 1 || v > 28 || v === (d.params.ini || 1)) return;
                    salvarParametros(d.params.h, d.params.meta, `início do período = dia ${v}`, v);
                  }}
                />
              </label>
            </div>
            <p className={styles.mudo} style={{ margin: '10px 0 0' }}>
              Início do período: 1 = mês-calendário; 13 = de 13 a 12 do mês seguinte (folha ponto). Os dias que contam (sábados, feriados) ficam no calendário do Painel.
            </p>
          </Cartao>

          {d.hc.rows.length > 0 && (
            <Cartao titulo="Cadastro para o relatório ABS">
              <p className={styles.mudo} style={{ margin: '0 0 12px' }}>
                Estes campos aparecem no relatório “Histórico ABS” e não existem no headcount. Confira os nomes e LDAPs dos gestores antes de exportar.
              </p>
              <label className={styles.campo} style={{ width: 160, marginBottom: 14 }}>
                Contrato
                {campoTexto(d.abs.contract || '', 'Contrato', 120, (v) => v.trim() !== d.abs.contract && salvarAbs({ ...d.abs, contract: v.trim() }, 'contrato'))}
              </label>
              <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>Gestores</h4>
              <div className={styles.tabelaRolagem}>
                <table className={styles.tabelaEsq}>
                  <thead>
                    <tr>
                      <th>Gestor no headcount</th>
                      <th>Nome completo no ABS</th>
                      <th>LDAP</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {gestoresAbs.map(([k, g]) => {
                      const x = d.abs.gest[k] || {};
                      return (
                        <tr key={k}>
                          <td>{g}</td>
                          <td>{campoTexto(x.nome || '', 'Nome completo', 300, (v) => setAbsGestor(k, 'nome', v))}</td>
                          <td>{campoTexto(x.ldap || '', 'LDAP', 110, (v) => setAbsGestor(k, 'ldap', v))}</td>
                          <td>{x.ldap && x.nome ? '' : <span className={styles.selo}>PREENCHER</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={styles.grade} style={{ marginTop: 16, alignItems: 'start', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>Setor (área sem TEMP)</h4>
                  <table className={styles.tabelaEsq}>
                    <tbody>
                      {areasAbs.map((a) => (
                        <tr key={a}>
                          <td>{a}</td>
                          <td>{campoTexto(d.abs.setor[chave(a)] || a, 'Setor no ABS', 190, (v) => setAbsMapa('setor', chave(a), v, a))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>Função (cargo)</h4>
                  <table className={styles.tabelaEsq}>
                    <tbody>
                      {cargos.map((c) => (
                        <tr key={c}>
                          <td>{c}</td>
                          <td>{campoTexto(d.abs.funcao[chave(c)] || c, 'Função no ABS', 190, (v) => setAbsMapa('funcao', chave(c), v, c))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Cartao>
          )}

          <Cartao titulo="Histórico recente">
            {d.hist.length ? (
              <div className={styles.tabelaRolagem}>
                <table className={styles.tabelaEsq}>
                  <tbody>
                    {d.hist.map((x, i) => (
                      <tr key={i}>
                        <td className={styles.mudo}>{dataHora(x.em)}</td>
                        <td className={styles.mudo}>{d.opNome(x.op)}</td>
                        <td>{d.nomeDe(x.por)}</td>
                        <td>{x.a}</td>
                        <td>{x.k}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.mudo} style={{ margin: 0 }}>
                As ações aparecem aqui conforme acontecem.
              </p>
            )}
          </Cartao>
        </>
      )}
    </Pagina>
  );
};
