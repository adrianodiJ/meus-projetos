import * as React from 'react';
import { Icon } from '@fluentui/react';
import styles from './QualityPortal.module.scss';
import { chave, dataHora, emailDhl, int, nz, ordenarPt, unicos } from '../lib/util';
import { type IGestor, type IPedido, type IUsuario, pedidoOp } from '../models';
import { DOC_GESTORES } from '../services/Coordenadores';
import type { IDados } from './tipos';
import { Aviso, Avatar, Cartao, Kpi, Pagina, Vazio } from './ui';

/**
 * Usuários e acessos (administradores):
 * - coordenadores vêm do headcount (um por GESTOR) e aqui só se ajusta o e-mail vinculado;
 * - pedidos de acesso: administrador (só o administrador principal aprova) ou outra operação;
 * - administradores e liberações extras de operação.
 */
export const Usuarios: React.FC<{ d: IDados; listasOk: boolean; adminPrincipal: string }> = ({ d, listasOk, adminPrincipal }) => {
  const [busca, setBusca] = React.useState('');
  const [filtroOp, setFiltroOp] = React.useState('');
  const [soSemEmail, setSoSemEmail] = React.useState(false);
  const [novoAdmin, setNovoAdmin] = React.useState('');
  const [buscando, setBuscando] = React.useState('');

  if (!listasOk) {
    return (
      <Pagina titulo="Usuários e acessos">
        <Aviso titulo="Listas ainda não criadas" texto="Crie as listas do portal em Administração antes de liberar acessos." />
      </Pagina>
    );
  }

  const principal = d.acesso.principal;
  const admins = d.usuarios.filter((u) => u.perfil === 'admin' && u.email !== adminPrincipal).sort((a, b) => ordenarPt(a.nome || a.email, b.nome || b.email));
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
      if (p.tipo === 'admin') {
        await d.servicos.acessos.salvarUsuario({ email: p.email, nome, perfil: 'admin', ops: [] });
        d.registrar('aprovou administrador', `${nome} (${p.email})`);
      } else {
        await d.servicos.acessos.salvarUsuario({ id: atual ? atual.id : undefined, email: p.email, nome, perfil: 'acesso', ops: unicos([...(atual ? atual.ops : []), op]) });
        d.registrar('liberou operação', `${nome} → ${d.opNome(op)}`);
      }
      await d.servicos.acessos.excluirPedido(p.id);
    }, p.tipo === 'admin' ? `${nome} agora é administrador.` : `${nome} pode ver ${d.opNome(op)}.`).catch(() => undefined);
  };

  const recusar = (p: IPedido): void => {
    d.gravar(async () => {
      await d.servicos.acessos.excluirPedido(p.id);
      d.registrar('recusou pedido', `${p.nome || p.email} · ${p.tipo}`);
    }, 'Pedido recusado.').catch(() => undefined);
  };

  // ---------------------------------------------------------------- administradores e liberações
  const adicionarAdmin = async (): Promise<void> => {
    const email = novoAdmin.trim().toLowerCase();
    if (!emailDhl(email)) {
      d.avisar('erro', 'Use o e-mail corporativo (@dhl.com).');
      return;
    }
    if (email === adminPrincipal || admins.some((u) => u.email === email)) {
      d.avisar('erro', 'Essa pessoa já é administradora.');
      return;
    }
    const nome = await d.servicos.acessos.resolverNome(email);
    if (!nome) {
      d.avisar('erro', `Não encontrei ${email} no diretório.`);
      return;
    }
    const ok = await d.gravar(async () => {
      await d.servicos.acessos.salvarUsuario({ email, nome, perfil: 'admin', ops: [] });
      const pedido = d.pedidos.filter((p) => p.email === email && p.tipo === 'admin')[0];
      if (pedido) await d.servicos.acessos.excluirPedido(pedido.id);
      d.registrar('adicionou administrador', `${nome} (${email})`);
    }, `${nome} agora é administrador.`);
    if (ok) setNovoAdmin('');
  };

  const removerAdmin = (u: IUsuario): void => {
    if (!window.confirm(`Remover ${u.nome || u.email} dos administradores?`)) return;
    d.gravar(async () => {
      await d.servicos.acessos.excluirUsuario(u.id);
      d.registrar('removeu administrador', u.nome || u.email);
    }, 'Administrador removido.').catch(() => undefined);
  };

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
    .sort((a, b) => ordenarPt(d.opNome(a.op), d.opNome(b.op)) || ordenarPt(a.g, b.g));

  const rotuloPedido = (p: IPedido): string => (p.tipo === 'admin' ? 'Administrador' : `Ver a operação ${d.opNome(pedidoOp(p.tipo))}`);

  return (
    <Pagina titulo="Usuários e acessos" subtitulo="Coordenadores vêm do headcount; aqui ficam os vínculos de e-mail, os pedidos de acesso e os administradores">
      <div className={styles.kpis}>
        <Kpi valor={int(d.gestores.length)} legenda="Coordenadores" icone="People" cor="#1F6FD1" detalhe="gestores no headcount" />
        <Kpi valor={int(semEmail)} legenda="Sem e-mail vinculado" icone="Unknown" cor="#F28C00" detalhe={semEmail ? 'vinculam pelo nome no 1º acesso' : 'todos vinculados'} />
        <Kpi valor={int(admins.length + 1)} legenda="Administradores" icone="Permissions" cor="#4B5563" detalhe="contando o principal" />
        <Kpi valor={int(d.pedidos.length)} legenda="Pedidos de acesso" icone="AddFriend" cor="#D40511" detalhe={d.pedidos.length ? 'aguardando análise' : 'nenhum pendente'} />
      </div>

      {d.pedidos.length > 0 && (
        <Cartao titulo={`Pedidos de acesso (${d.pedidos.length})`}>
          <div className={styles.pedidos}>
            {d.pedidos.map((p) => {
              const podeAprovar = p.tipo !== 'admin' || principal;
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
                    {podeAprovar ? (
                      <>
                        <button type="button" className={styles.botaoAmarelo} onClick={() => aprovar(p)}>
                          Aprovar
                        </button>
                        <button type="button" className={styles.botao} onClick={() => recusar(p)}>
                          Recusar
                        </button>
                      </>
                    ) : (
                      <span className={styles.mudo}>Só o administrador principal aprova</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Cartao>
      )}

      <Cartao
        titulo={`Coordenadores do headcount (${coordenadores.length})`}
        acao={
          semEmail > 0 ? (
            <button type="button" className={styles.botao} disabled={!!buscando} onClick={() => buscarFaltantes().catch(() => undefined)}>
              <Icon iconName="Search" /> {buscando || 'Buscar e-mails que faltam'}
            </button>
          ) : undefined
        }
      >
        <p className={styles.mudo} style={{ margin: '0 0 12px' }}>
          A cada upload do headcount esta lista é refeita a partir da coluna GESTOR: quem entra vira coordenador, quem sai deixa de ser, e a equipe segue a planilha. O e-mail é buscado no
          diretório pelo nome; se ficar vazio, a pessoa é reconhecida pelo nome ao abrir o portal. O coordenador lança só a própria equipe e vê só as operações em que aparece.
        </p>
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
          <div className={styles.tabelaRolagem}>
            <table className={styles.tabelaEsq}>
              <thead>
                <tr>
                  <th>Operação</th>
                  <th>Gestor no headcount</th>
                  <th className={styles.num}>Colaboradores</th>
                  <th>E-mail vinculado</th>
                  <th>No diretório</th>
                </tr>
              </thead>
              <tbody>
                {coordenadores.map((g) => (
                  <tr key={`${g.op}|${g.g}`}>
                    <td>{d.opNome(g.op)}</td>
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
      </Cartao>

      <div className={styles.usuariosGrade}>
        <Cartao titulo={`Administradores (${admins.length + 1})`}>
          <p className={styles.mudo} style={{ margin: '0 0 12px' }}>
            Têm os mesmos acessos do administrador principal. Só ele aprova novos administradores. Para gravar cadastros também precisam ser proprietários do site.
          </p>
          <div className={styles.tabelaRolagem}>
            <table className={styles.tabelaEsq}>
              <tbody>
                <tr>
                  <td>
                    <div className={styles.pessoa}>
                      <Avatar nome={adminPrincipal} tamanho={34} />
                      <div>
                        <b>{d.nomeDe(adminPrincipal)}</b>
                        <div className={styles.mudo}>{adminPrincipal}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.selo}>PRINCIPAL</span>
                  </td>
                </tr>
                {admins.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className={styles.pessoa}>
                        <Avatar nome={u.nome || u.email} tamanho={34} />
                        <div>
                          <b>{u.nome || u.email}</b>
                          <div className={styles.mudo}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {principal ? (
                        <button type="button" className={styles.botaoIcone} title="Remover administrador" aria-label={`Remover ${u.nome || u.email}`} onClick={() => removerAdmin(u)}>
                          <Icon iconName="UserRemove" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {principal && (
            <div className={styles.fileira} style={{ marginTop: 12 }}>
              <label className={styles.campo}>
                Adicionar administrador
                <input type="email" value={novoAdmin} placeholder="nome.sobrenome@dhl.com" onChange={(e) => setNovoAdmin(e.target.value)} />
              </label>
              <button type="button" className={styles.botaoAmarelo} onClick={() => adicionarAdmin().catch(() => undefined)}>
                <Icon iconName="Permissions" /> Adicionar
              </button>
            </div>
          )}
        </Cartao>

        <Cartao titulo={`Operações liberadas a coordenadores (${liberacoes.length})`}>
          <p className={styles.mudo} style={{ margin: '0 0 12px' }}>
            Coordenador só vê as operações em que aparece no headcount. Aqui ficam as outras que um administrador liberou a pedido dele.
          </p>
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
      </div>
    </Pagina>
  );
};
