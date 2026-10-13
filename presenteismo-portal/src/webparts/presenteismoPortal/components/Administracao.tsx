import * as React from 'react';
import styles from './QualityPortal.module.scss';
import { chave, dataHora, emailDhl, ordenarPt, unicos } from '../lib/util';
import { type IAbs, type IPedido, type IUsuario, PERFIS, PERMISSOES, type Perfil, ROTULO_TURNO, STATUS_USUARIO, type StatusUsuario, TURNOS } from '../models';
import { provisionarListas } from '../services/Provisionamento';
import type { IDados } from './tipos';
import { Cartao, Pagina } from './ui';

interface IFormPedido {
  perfil: Perfil;
  ops: string[];
  perm: Record<string, boolean>;
  g: string[];
}

const alternar = (lista: string[], valor: string, ligado: boolean): string[] => {
  const s = new Set(lista);
  if (ligado) s.add(valor);
  else s.delete(valor);
  return Array.from(s);
};

export const Administracao: React.FC<{ d: IDados; listasOk: boolean }> = ({ d, listasOk }) => {
  const [log, setLog] = React.useState<string[]>([]);
  const [progresso, setProgresso] = React.useState('');
  const [criando, setCriando] = React.useState(false);
  const [forms, setForms] = React.useState<Record<string, IFormPedido>>({});
  const [novoEmail, setNovoEmail] = React.useState('');
  const [novaOp, setNovaOp] = React.useState('');

  const gestores = unicos(d.hc.rows.map((r) => r.g)).sort(ordenarPt);
  const conhecidos = new Set(d.usuarios.map((u) => u.email));
  const pedidos = d.pedidos.filter((p) => !conhecidos.has(p.email));
  const form = (p: IPedido): IFormPedido => forms[p.email] || { perfil: 'coordenador', ops: [d.op], perm: {}, g: [] };
  const mudarForm = (p: IPedido, f: Partial<IFormPedido>): void => setForms((x) => ({ ...x, [p.email]: { ...form(p), ...f } }));

  /** Gestores já vinculados a outro coordenador (cada equipe tem um único coordenador). */
  const ocupados = (exceto: string): Set<string> => {
    const s = new Set<string>();
    d.usuarios.forEach((x) => {
      if (x.perfil === 'coordenador' && x.status !== 'bloqueado' && x.email !== exceto) x.gestores.forEach((g) => s.add(g));
    });
    return s;
  };

  /** Equipes por perfil: coordenador = a própria equipe (1 gestor); supervisor = várias; gerente/admin = todas. */
  const escolhaEquipes = (perfil: Perfil, sel: string[], exceto: string, mudar: (g: string[]) => void): JSX.Element => {
    if (perfil === 'admin' || perfil === 'gerente') return <span className={styles.mudo}>Vê todas as equipes (não precisa escolher).</span>;
    if (!gestores.length) return <span className={styles.mudo}>Importe o headcount primeiro.</span>;
    if (perfil === 'coordenador') {
      const oc = ocupados(exceto);
      const atual = sel.filter((g) => gestores.indexOf(g) >= 0)[0] || '';
      return (
        <select value={atual} onChange={(e) => mudar(e.target.value ? [e.target.value] : [])}>
          <option value="">Selecione o gestor (equipe dele)</option>
          {gestores
            .filter((g) => g === atual || !oc.has(g))
            .map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
        </select>
      );
    }
    return caixa(
      `Equipes supervisionadas: ${sel.filter((g) => gestores.indexOf(g) >= 0).length} de ${gestores.length}`,
      <>
        {gestores.map((g) => (
          <label key={g}>
            <input type="checkbox" checked={sel.indexOf(g) >= 0} onChange={(e) => mudar(alternar(sel, g, e.target.checked))} />
            {g}
          </label>
        ))}
      </>
    );
  };

  /** Operações por perfil: coordenador = uma só (a do gestor dele); demais = quantas precisar. */
  const escolhaOps = (perfil: Perfil, ops: string[], nome: string, mudar: (o: string[]) => void, travado?: boolean): JSX.Element => (
    <>
      {d.operacoes.map((o) => (
        <label key={o.id} style={{ display: 'block', whiteSpace: 'nowrap' }}>
          {perfil === 'coordenador' ? (
            <input type="radio" name={`op-${nome}`} checked={ops.indexOf(o.id) >= 0} disabled={travado} onChange={() => mudar([o.id])} />
          ) : (
            <input type="checkbox" checked={travado ? true : ops.indexOf(o.id) >= 0} disabled={travado} onChange={(e) => mudar(alternar(ops, o.id, e.target.checked))} />
          )}{' '}
          {o.nome}
        </label>
      ))}
    </>
  );

  /** Ao trocar o perfil, ajusta o que deixou de fazer sentido (coordenador = 1 equipe, 1 operação). */
  const ajustePerfil = (perfil: Perfil, ops: string[], g: string[]): { ops: string[]; g: string[] } => ({
    ops: perfil === 'coordenador' ? ops.slice(0, 1) : ops,
    g: perfil === 'gerente' || perfil === 'admin' ? [] : perfil === 'coordenador' ? g.slice(0, 1) : g
  });

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

  // ---------------------------------------------------------------- usuários
  const alterar = (u: IUsuario, campos: Parameters<typeof d.servicos.acessos.alterarUsuario>[1], detalhe: string, ok?: string): void => {
    d.gravar(async () => {
      await d.servicos.acessos.alterarUsuario(u.id, campos);
      d.registrar('permissão', `${u.nome || u.email} · ${detalhe}`);
    }, ok).catch(() => undefined);
  };

  const permDe = (u: IUsuario, chaveP: string): boolean => u.perfil === 'admin' || u.perm[chaveP] !== false;
  const permCompleta = (u: IUsuario, chaveP: string, valor: boolean): Record<string, boolean> => {
    const pr: Record<string, boolean> = {};
    PERMISSOES.forEach((m) => (pr[m.chave] = u.perm[m.chave] !== false));
    pr[chaveP] = valor;
    return pr;
  };

  const aprovar = (p: IPedido): void => {
    const f = form(p);
    if (f.perfil === 'coordenador' && (f.g.length !== 1 || f.ops.length !== 1)) {
      d.avisar('erro', 'Coordenador precisa de uma operação e do gestor da própria equipe.');
      return;
    }
    if (f.perfil === 'supervisor' && !f.g.length) {
      d.avisar('erro', 'Marque ao menos uma equipe para o supervisor.');
      return;
    }
    if (f.perfil !== 'admin' && !f.ops.length) {
      d.avisar('erro', 'Libere ao menos uma operação.');
      return;
    }
    const perm: Record<string, boolean> = {};
    PERMISSOES.forEach((m) => (perm[m.chave] = f.perm[m.chave] !== false));
    d.gravar(async () => {
      await d.servicos.acessos.salvarUsuario({ email: p.email, nome: p.nome, perfil: f.perfil, status: 'aprovado', ops: f.ops, gestores: f.g, perm });
      await d.servicos.acessos.excluirPedido(p.id);
      d.registrar('aprovou', `${p.nome || p.email} como ${f.perfil}`);
    }, 'Acesso aprovado com as permissões escolhidas.').catch(() => undefined);
  };

  const recusar = (p: IPedido): void => {
    d.gravar(async () => {
      await d.servicos.acessos.salvarUsuario({ email: p.email, nome: p.nome, perfil: 'coordenador', status: 'bloqueado', ops: [], gestores: [], perm: {} });
      await d.servicos.acessos.excluirPedido(p.id);
      d.registrar('bloqueou', p.nome || p.email);
    }).catch(() => undefined);
  };

  const redefinir = (u: IUsuario): void => {
    d.gravar(async () => {
      await d.servicos.acessos.excluirUsuario(u.id);
      d.registrar('redefiniu acesso', u.nome || u.email);
    }, 'Acesso redefinido. A pessoa precisará pedir acesso de novo.').catch(() => undefined);
  };

  const adicionar = async (): Promise<void> => {
    const email = novoEmail.trim().toLowerCase();
    if (!emailDhl(email)) {
      d.avisar('erro', 'Use o e-mail corporativo DHL (@dhl.com).');
      return;
    }
    if (conhecidos.has(email)) {
      d.avisar('erro', 'Essa pessoa já está cadastrada.');
      return;
    }
    const nome = (await d.servicos.acessos.resolverNome(email)) || email.split('@')[0];
    const ok = await d.gravar(async () => {
      await d.servicos.acessos.salvarUsuario({ email, nome, perfil: 'coordenador', status: 'aprovado', ops: [d.op], gestores: [], perm: {} });
      d.registrar('adicionou', `${nome} (${email})`);
    }, 'Pessoa adicionada como coordenador. Ajuste o perfil e as equipes.');
    if (ok) setNovoEmail('');
  };

  // ---------------------------------------------------------------- parâmetros e operações
  const salvarParametros = (h: Record<string, number>, meta: number, detalhe: string): void => {
    d.gravar(async () => {
      await d.servicos.dados.gravar(`cfg/params_${d.op}`, { h, meta });
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

  const caixa = (resumo: string, itens: JSX.Element): JSX.Element => (
    <details className={styles.caixaDrop}>
      <summary>{resumo}</summary>
      <div className={styles.caixaLista}>{itens}</div>
    </details>
  );

  return (
    <Pagina titulo="Administração" subtitulo={`Usuários, equipes, parâmetros e cadastros · operação ${d.opNome(d.op)}`}>
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
          {pedidos.length > 0 && (
            <Cartao titulo={`Pedidos de acesso (${pedidos.length})`}>
              {pedidos.map((p) => {
                const f = form(p);
                return (
                  <div key={p.email} className={styles.cartaoPedido}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                      <div>
                        <b>{p.nome || p.email}</b>
                        <div className={styles.mudo}>{p.email}</div>
                      </div>
                      <span className={styles.mudo}>{dataHora(p.em)}</span>
                    </div>
                    <div className={styles.grade} style={{ margin: '12px 0' }}>
                      <label className={styles.campo}>
                        Perfil
                        <select value={f.perfil} onChange={(e) => mudarForm(p, { perfil: e.target.value as Perfil, ...ajustePerfil(e.target.value as Perfil, f.ops, f.g) })}>
                          {PERFIS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <div className={styles.mudo}>Operações liberadas</div>
                        {escolhaOps(f.perfil, f.ops, p.email, (o) => mudarForm(p, { ops: o }))}
                      </div>
                      <div>
                        <div className={styles.mudo}>O que pode ver e fazer</div>
                        {PERMISSOES.map((m) => (
                          <label key={m.chave} style={{ display: 'block' }}>
                            <input type="checkbox" checked={f.perm[m.chave] !== false} onChange={(e) => mudarForm(p, { perm: { ...f.perm, [m.chave]: e.target.checked } })} /> {m.texto}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <div className={styles.mudo}>{f.perfil === 'coordenador' ? `Equipe do coordenador (gestor de ${d.opNome(d.op)})` : `Equipes (gestores de ${d.opNome(d.op)})`}</div>
                      {escolhaEquipes(f.perfil, f.g, p.email, (g) => mudarForm(p, { g }))}
                    </div>
                    <div className={styles.linhaBotoes} style={{ marginTop: 12 }}>
                      <button type="button" className={styles.botaoAmarelo} onClick={() => aprovar(p)}>
                        Aprovar com essas permissões
                      </button>
                      <button type="button" className={styles.botao} onClick={() => recusar(p)}>
                        Recusar
                      </button>
                    </div>
                  </div>
                );
              })}
            </Cartao>
          )}

          <Cartao titulo="Usuários e equipes">
            <div className={styles.fileira} style={{ marginBottom: 12 }}>
              <label className={styles.campo} style={{ minWidth: 300 }}>
                Adicionar pessoa pelo e-mail DHL
                <input type="email" value={novoEmail} placeholder="nome.sobrenome@dhl.com" onChange={(e) => setNovoEmail(e.target.value)} />
              </label>
              <button type="button" className={styles.botaoAmarelo} onClick={() => adicionar().catch(() => undefined)}>
                Adicionar
              </button>
            </div>
            {d.usuarios.length ? (
              <div className={styles.tabelaRolagem}>
                <table className={styles.tabelaEsq}>
                  <thead>
                    <tr>
                      <th>Pessoa</th>
                      <th>Perfil</th>
                      <th>Status</th>
                      <th>Operações</th>
                      <th>Permissões</th>
                      <th>Equipes ({d.opNome(d.op)})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.usuarios.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <b>{u.nome || u.email}</b>
                          <div className={styles.mudo}>{u.email}</div>
                          {u.email !== d.email && (
                            <button type="button" className={styles.botao} style={{ fontSize: 12, marginTop: 4, minHeight: 26, padding: '2px 10px' }} onClick={() => redefinir(u)}>
                              Redefinir acesso
                            </button>
                          )}
                        </td>
                        <td>
                          <select value={u.perfil} onChange={(e) => alterar(u, { perfil: e.target.value as Perfil, ...ajustePerfil(e.target.value as Perfil, u.ops, u.gestores) }, `perfil = ${e.target.value}`)}>
                            {PERFIS.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select value={u.status} onChange={(e) => alterar(u, { status: e.target.value as StatusUsuario }, `status = ${e.target.value}`)}>
                            {STATUS_USUARIO.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {escolhaOps(u.perfil, u.ops, u.email, (o) => alterar(u, { ops: o }, `operações`, 'Operações salvas.'), u.perfil === 'admin')}
                        </td>
                        <td>
                          {caixa(
                            u.perfil === 'admin' ? 'Tudo' : `${PERMISSOES.filter((m) => permDe(u, m.chave)).length} de ${PERMISSOES.length}`,
                            <>
                              {PERMISSOES.map((m) => (
                                <label key={m.chave}>
                                  <input
                                    type="checkbox"
                                    checked={permDe(u, m.chave)}
                                    disabled={u.perfil === 'admin'}
                                    onChange={(e) => alterar(u, { perm: permCompleta(u, m.chave, e.target.checked) }, `${m.chave} = ${e.target.checked}`, 'Permissões salvas.')}
                                  />
                                  {m.texto}
                                </label>
                              ))}
                            </>
                          )}
                        </td>
                        <td>
                          {escolhaEquipes(u.perfil, u.gestores, u.email, (g) => alterar(u, { gestores: g }, `equipes`, 'Equipes salvas.'))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.mudo} style={{ margin: 0 }}>
                Nenhum usuário cadastrado além do administrador principal. Quem abrir o portal sem acesso aparece em Pedidos de acesso.
              </p>
            )}
            <p className={styles.mudo} style={{ margin: '10px 0 0' }}>
              Coordenador vê só a equipe do próprio gestor (uma operação e um gestor, sem repetir entre coordenadores). Supervisor vê as equipes marcadas. Gerente e administrador veem todas. Cada pessoa também precisa de acesso ao site do SharePoint (Membro para lançar, Proprietário para administrar).
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
            </div>
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
