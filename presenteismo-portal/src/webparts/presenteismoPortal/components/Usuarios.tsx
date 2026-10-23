import * as React from 'react';
import { Icon } from '@fluentui/react';
import styles from './QualityPortal.module.scss';
import { chave, dataHora, emailDhl, int, nz, ordenarPt, unicos } from '../lib/util';
import { type IGestor, type IPedido, type IUsuario, pedidoOp } from '../models';
import { DOC_GESTORES } from '../services/Coordenadores';
import { LogoOperacao, rotuloOperacao } from './SeletorOperacao';
import type { IDados } from './tipos';
import { Aviso, Avatar, Cartao, Kpi, Pagina, Vazio } from './ui';

/**
 * Usuários e acessos (administradores = proprietários do site do SharePoint):
 * - coordenadores vêm do headcount (um por GESTOR) e aqui só se ajusta o e-mail vinculado;
 * - pedidos de coordenadores para ver outra operação e as liberações já feitas.
 */
export const Usuarios: React.FC<{ d: IDados; listasOk: boolean }> = ({ d, listasOk }) => {
  const [busca, setBusca] = React.useState('');
  const [filtroOp, setFiltroOp] = React.useState('');
  const [soSemEmail, setSoSemEmail] = React.useState(false);
  const [buscando, setBuscando] = React.useState('');
  /** operações recolhidas na lista de coordenadores */
  const [fechados, setFechados] = React.useState<Record<string, boolean>>({});

  if (!listasOk) {
    return (
      <Pagina titulo="Usuários e acessos">
        <Aviso titulo="Listas ainda não criadas" texto="Crie as listas do portal em Administração antes de liberar acessos." />
      </Pagina>
    );
  }

  const liberacoes = d.usuarios.filter((u) => u.perfil === 'acesso' && u.ops.length).sort((a, b) => ordenarPt(a.nome || a.email, b.nome || b.email));
  const semEmail = d.gestores.filter((g) => !g.email).length;
  const nomeGestor = (email: string): string => (d.gestores.filter((g) => g.email === email)[0] || { g: '' }).g;

  // ---------------------------------------------------------------- coordenadores (cfg/gestores)
  const gravarGestores = (lista: IGestor[], detalhe: string, ok: string): Promise<boolean> =>
    d.gravar(async () => {
      await d.servicos.dados.gravar(DOC_GESTORES, { list: lista, em: new Date().toISOString() });
      d.registrar('coordenador', detalhe);
    }, ok);

  const vincular = async (x: IGestor, valor: string): Promise<void> => {
    const email = valor.trim().toLowerCase();
    if (email === x.email) return;
    if (email && !emailDhl(email)) {
      d.avisar('erro', 'Use o e-mail corporativo (@dhl.com).');
      return;
    }
    const nome = email ? (await d.servicos.acessos.resolverNome(email)) || '' : '';
    if (email && !nome) {
      d.avisar('erro', `Não encontrei ${email} no diretório.`);
      return;
    }
    // o mesmo gestor em outras operações também recebe o e-mail
    const lista = d.gestores.map((g) => (chave(g.g) === chave(x.g) && (g.op === x.op || !g.email) ? { ...g, email, nome } : g));
    await gravarGestores(lista, `${x.g} → ${email || 'sem e-mail'}`, email ? `${x.g} vinculado a ${nome}.` : `Vínculo de ${x.g} removido.`);
  };

  const buscarFaltantes = async (): Promise<void> => {
    const lista = d.gestores.slice();
    let achados = 0;
    const faltam = lista.filter((g) => !g.email);
    for (let i = 0; i < faltam.length; i++) {
      setBuscando(`Buscando ${faltam[i].g} (${i + 1}/${faltam.length})…`);
      const r = await d.servicos.acessos.buscarPorNome(faltam[i].g);
      if (!r) continue;
      achados++;
      lista.forEach((g, k) => {
        if (!g.email && chave(g.g) === chave(faltam[i].g)) lista[k] = { ...g, email: r.email, nome: r.nome };
      });
    }
    setBuscando('');
    if (!achados) {
      d.avisar('info', 'Nenhum e-mail novo encontrado com certeza. Informe os que faltam na tabela.');
      return;
    }
    await gravarGestores(lista, `busca no diretório: ${achados} encontrados`, `${achados} coordenador${achados > 1 ? 'es' : ''} vinculado${achados > 1 ? 's' : ''}.`);
  };

  // ---------------------------------------------------------------- pedidos
  const aprovar = (p: IPedido): void => {
    const op = pedidoOp(p.tipo);
    const atual = d.usuarios.filter((u) => u.email === p.email && u.perfil === 'acesso')[0];
    const nome = p.nome || p.email;
    d.gravar(async () => {
      await d.servicos.acessos.salvarUsuario({ id: atual ? atual.id : undefined, email: p.email, nome, perfil: 'acesso', ops: unicos([...(atual ? atual.ops : []), op]) });
      d.registrar('liberou operação', `${nome} → ${d.opNome(op)}`);
      await d.servicos.acessos.excluirPedido(p.id);
    }, `${nome} pode ver ${d.opNome(op)}.`).catch(() => undefined);
  };

  const recusar = (p: IPedido): void => {
    d.gravar(async () => {
      await d.servicos.acessos.excluirPedido(p.id);
      d.registrar('recusou pedido', `${p.nome || p.email} · ${p.tipo}`);
    }, 'Pedido recusado.').catch(() => undefined);
  };

  // ---------------------------------------------------------------- liberações
  const tirarOp = (u: IUsuario, op: string): void => {
    const ops = u.ops.filter((o) => o !== op);
    d.gravar(async () => {
      if (ops.length) await d.servicos.acessos.salvarUsuario({ ...u, ops });
      else await d.servicos.acessos.excluirUsuario(u.id);
      d.registrar('retirou operação', `${u.nome || u.email} → ${d.opNome(op)}`);
    }, 'Acesso retirado.').catch(() => undefined);
  };

  // ---------------------------------------------------------------- tabela de coordenadores
  const q = nz(busca);
  const coordenadores = d.gestores
    .filter((g) => (!filtroOp || g.op === filtroOp) && (!soSemEmail || !g.email) && (!q || nz(`${g.g} ${g.email} ${g.nome || ''}`).indexOf(q) >= 0))
    .sort((a, b) => ordenarPt(a.g, b.g));
  // um bloco por operação: a operação aberta no portal primeiro, depois as outras em ordem alfabética
  const idsOp = unicos(coordenadores.map((g) => g.op)).sort((a, b) => (a === d.op ? -1 : b === d.op ? 1 : ordenarPt(d.opNome(a), d.opNome(b))));
  const operacaoDe = (id: string): { id: string; nome: string; codigo?: string; logo?: string } => d.operacoes.filter((o) => o.id === id)[0] || { id, nome: d.opNome(id) };
  const alternarGrupo = (id: string): void => setFechados((f) => ({ ...f, [id]: !f[id] }));

  const rotuloPedido = (p: IPedido): string => `Ver a operação ${d.opNome(pedidoOp(p.tipo))}`;

  return (
    <Pagina titulo="Usuários e acessos">
      <div className={styles.kpis}>
        <Kpi valor={int(d.gestores.length)} legenda="Coordenadores" icone="People" cor="#1F6FD1" detalhe="gestores no headcount" />
        <Kpi valor={int(semEmail)} legenda="Sem e-mail vinculado" icone="Unknown" cor="#F28C00" detalhe={semEmail ? 'vinculam pelo nome no 1º acesso' : 'todos vinculados'} />
        <Kpi valor={int(liberacoes.length)} legenda="Com operação extra" icone="Unlock" cor="#4B5563" detalhe="coordenadores liberados" />
        <Kpi valor={int(d.pedidos.length)} legenda="Pedidos de acesso" icone="AddFriend" cor="#D40511" detalhe={d.pedidos.length ? 'aguardando análise' : 'nenhum pendente'} />
      </div>

      {d.pedidos.length > 0 && (
        <Cartao titulo={`Pedidos de acesso (${d.pedidos.length})`}>
          <div className={styles.pedidos}>
            {d.pedidos.map((p) => {
              const gestor = nomeGestor(p.email);
              return (
                <div key={p.id} className={styles.pedido}>
                  <Avatar nome={p.nome || p.email} tamanho={40} />
                  <div className={styles.pedidoTexto}>
                    <b>{p.nome || p.email}</b>
                    <span>
                      {p.email}
                      {gestor ? ` · coordenador (${gestor})` : ''}
                    </span>
                    <small>
                      {rotuloPedido(p)} · pedido em {dataHora(p.em)}
                    </small>
                  </div>
                  <div className={styles.pedidoAcoes}>
                    <button type="button" className={styles.botaoAmarelo} onClick={() => aprovar(p)}>
                      Aprovar
                    </button>
                    <button type="button" className={styles.botao} onClick={() => recusar(p)}>
                      Recusar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Cartao>
      )}

      <Cartao
        titulo={`Coordenadores do headcount por operação (${coordenadores.length})`}
        acao={
          semEmail > 0 ? (
            <button type="button" className={styles.botao} disabled={!!buscando} onClick={() => buscarFaltantes().catch(() => undefined)}>
              <Icon iconName="Search" /> {buscando || 'Buscar e-mails que faltam'}
            </button>
          ) : undefined
        }
      >
        <div className={styles.filtros}>
          <div className={`${styles.buscaCampo} ${styles.filtroBusca}`}>
            <Icon iconName="Search" />
            <input type="search" value={busca} placeholder="Buscar gestor ou e-mail" aria-label="Buscar coordenador" onChange={(e) => setBusca(e.target.value)} />
          </div>
          <label className={styles.campo}>
            <select value={filtroOp} aria-label="Filtrar por operação" onChange={(e) => setFiltroOp(e.target.value)}>
              <option value="">Todas as operações</option>
              {d.operacoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={soSemEmail} onChange={(e) => setSoSemEmail(e.target.checked)} />
            Só sem e-mail
          </label>
        </div>
        {coordenadores.length === 0 ? (
          <Vazio icone="People" titulo={d.gestores.length ? 'Nenhum coordenador com esses filtros' : 'Nenhum coordenador ainda'} texto={d.gestores.length ? undefined : 'Importe o headcount em Headcount: os gestores da planilha viram coordenadores.'} />
        ) : (
          <div className={styles.gruposOp}>
            {idsOp.map((id) => {
              const o = operacaoDe(id);
              const lista = coordenadores.filter((g) => g.op === id);
              const todos = d.gestores.filter((g) => g.op === id);
              const faltam = todos.filter((g) => !g.email).length;
              const aberto = !fechados[id];
              return (
                <section key={id} className={styles.grupoOp}>
                  <button type="button" className={styles.grupoOpTopo} aria-expanded={aberto} onClick={() => alternarGrupo(id)}>
                    <span className={styles.grupoOpLogo}>
                      <LogoOperacao op={o} className={styles.grupoOpMono} />
                    </span>
                    <span className={styles.grupoOpTexto}>
                      <b>{rotuloOperacao(o)}</b>
                      <small>
                        {int(todos.length)} coordenador{todos.length === 1 ? '' : 'es'} · {int(todos.reduce((t, g) => t + (g.n || 0), 0))} colaboradores
                        {id === d.op ? ' · operação aberta no portal' : ''}
                      </small>
                    </span>
                    <span className={styles.grupoOpNumeros}>
                      {faltam > 0 ? <span className={styles.selo}>{faltam} SEM E-MAIL</span> : <span className={styles.seloOk}>TODOS VINCULADOS</span>}
                    </span>
                    <Icon iconName={aberto ? 'ChevronUp' : 'ChevronDown'} className={styles.grupoOpSeta} />
                  </button>
                  {aberto && (
                    <div className={styles.tabelaRolagem}>
                      <table className={styles.tabelaEsq}>
                        <thead>
                          <tr>
                            <th>Gestor no headcount</th>
                            <th className={styles.num}>Colaboradores</th>
                            <th>E-mail vinculado</th>
                            <th>No diretório</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lista.map((g) => (
                            <tr key={`${g.op}|${g.g}`}>
                              <td>
                                <b>{g.g}</b>
                              </td>
                              <td className={styles.num}>{int(g.n)}</td>
                              <td>
                                <input
                                  key={g.email}
                                  type="email"
                                  defaultValue={g.email}
                                  placeholder="nome.sobrenome@dhl.com"
                                  aria-label={`E-mail de ${g.g}`}
                                  style={{ width: 260, padding: '6px 8px', border: '1px solid #c9ced6', borderRadius: 6 }}
                                  onBlur={(e) => vincular(g, e.target.value).catch(() => undefined)}
                                />
                              </td>
                              <td>{g.email ? g.nome || '—' : <span className={styles.selo}>SEM E-MAIL</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Cartao>

      <Cartao titulo={`Operações liberadas a coordenadores (${liberacoes.length})`}>
        {liberacoes.length === 0 ? (
          <p className={styles.mudo} style={{ margin: 0 }}>
            Nenhuma liberação extra.
          </p>
        ) : (
          <table className={styles.tabelaEsq}>
            <tbody>
              {liberacoes.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.nome || u.email}</b>
                    <div className={styles.mudo}>{u.email}</div>
                  </td>
                  <td>
                    <div className={styles.chips}>
                      {u.ops.map((o) => (
                        <button key={o} type="button" className={`${styles.chip} ${styles.chipAtivo}`} title={`Retirar ${d.opNome(o)}`} onClick={() => tirarOp(u, o)}>
                          {d.opNome(o)} <Icon iconName="Cancel" />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>
    </Pagina>
  );
};
