import * as React from 'react';
import { ContextualMenu, DirectionalHint, Icon, initializeIcons, MessageBar, MessageBarType, Panel, PanelType, Spinner, SpinnerSize } from '@fluentui/react';
import styles from './QualityPortal.module.scss';
import { LOGO_DHL } from '../assets/logo';
import {
  ABS_PADRAO,
  type IAbs,
  type IColab,
  type IHeadcount,
  type IHistorico,
  type ILancamento,
  type IOperacao,
  type IParametros,
  type IPedido,
  type IPerfilSp,
  type IUsuario,
  nomeCurto,
  OPERACAO_PADRAO,
  PARAMETROS_PADRAO
} from '../models';
import { periodoDoMes } from '../lib/calculo';
import { chave, iso } from '../lib/util';
import { Acompanhamento } from './Acompanhamento';
import { Administracao } from './Administracao';
import { Headcount } from './Headcount';
import { Home } from './Home';
import { Lancamento } from './Lancamento';
import { Painel } from './Painel';
import { Relatorios } from './Relatorios';
import { type IDados, type IPortalProps, MENU, type Visao } from './tipos';
import { Aviso, Avatar } from './ui';

initializeIcons(undefined, { disableWarnings: true });

// O portal cobre a área da página (position: fixed em .telaCheia), escondendo a barra do
// Microsoft 365/SharePoint e o cabeçalho do site; a página por baixo não rola.
const CSS_TELA_CHEIA = 'html, body { overflow: hidden !important; }';
const CHAVE_OP = 'presenteismo-operacao';

function lerOp(): string {
  try {
    return window.localStorage.getItem(CHAVE_OP) || '';
  } catch {
    return '';
  }
}

function mensagem(e: unknown): string {
  const x = e as { message?: string };
  return (x && x.message) || 'erro desconhecido';
}

export default function PresenteismoPortal(props: IPortalProps): JSX.Element {
  const { servicos, usuario } = props;
  const email = usuario.email;
  const ehAdminPrincipal = !!email && email === props.adminEmail;

  const hoje = new Date();
  const [fase, setFase] = React.useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [erro, setErro] = React.useState<string | undefined>(undefined);
  const [listasOk, setListasOk] = React.useState(true);
  const [operacoes, setOperacoes] = React.useState<IOperacao[]>([OPERACAO_PADRAO]);
  const [op, setOpEstado] = React.useState<string>(lerOp() || OPERACAO_PADRAO.id);
  const [hc, setHc] = React.useState<IHeadcount>({ rows: [] });
  const [params, setParams] = React.useState<IParametros>(PARAMETROS_PADRAO);
  const [abs, setAbs] = React.useState<IAbs>(ABS_PADRAO);
  const [absExiste, setAbsExiste] = React.useState(false);
  const [usuarios, setUsuarios] = React.useState<IUsuario[]>([]);
  const [pedidos, setPedidos] = React.useState<IPedido[]>([]);
  const [hist, setHist] = React.useState<IHistorico[]>([]);
  const [lancMes, setLancMes] = React.useState<ILancamento[]>([]);
  const [lancDia, setLancDia] = React.useState<ILancamento[]>([]);
  const [ym, setYm] = React.useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
  const [ldate, setLdate] = React.useState(iso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1)));
  const [atualizando, setAtualizando] = React.useState(false);
  const [atualizadoEm, setAtualizadoEm] = React.useState<Date | undefined>(undefined);
  const [visao, setVisao] = React.useState<Visao>('home');
  const [aviso, setAviso] = React.useState<{ tipo: MessageBarType; texto: string } | undefined>(undefined);
  const [busca, setBusca] = React.useState('');
  const [buscaAplicada, setBuscaAplicada] = React.useState('');
  const [gestorPre, setGestorPre] = React.useState('');
  const [menuLateral, setMenuLateral] = React.useState(false);
  const [notifAberto, setNotifAberto] = React.useState(false);
  const [menuUsuario, setMenuUsuario] = React.useState(false);
  const [perfilSp, setPerfilSp] = React.useState<IPerfilSp | undefined>(undefined);

  const botaoUsuario = React.useRef<HTMLButtonElement>(null);
  const reqRef = React.useRef(0);

  // ------------------------------------------------------------ usuário efetivo
  const cadastro = React.useMemo(() => usuarios.filter((u) => u.email === email)[0], [usuarios, email]);
  const eu: IUsuario = React.useMemo(() => {
    if (ehAdminPrincipal) {
      return { id: cadastro ? cadastro.id : 0, email, nome: usuario.nome, perfil: 'admin', status: 'aprovado', ops: [], gestores: [], perm: {} };
    }
    return cadastro || { id: 0, email, nome: usuario.nome, perfil: 'coordenador', status: 'pendente', ops: [], gestores: [], perm: {} };
  }, [ehAdminPrincipal, cadastro, email, usuario.nome]);
  const aprovado = eu.status === 'aprovado';
  const admin = aprovado && eu.perfil === 'admin';
  const completo = admin || (aprovado && eu.perfil === 'gerente');
  const pm = React.useCallback((k: string): boolean => admin || eu.perm[k] !== false, [admin, eu.perm]);
  const podeOperacao = React.useCallback((id: string): boolean => admin || eu.ops.indexOf(id) >= 0, [admin, eu.ops]);
  const equipe: IColab[] = React.useMemo(() => hc.rows.filter((r) => completo || eu.gestores.indexOf(r.g) >= 0), [hc.rows, completo, eu.gestores]);

  const nomeDe = React.useCallback(
    (e: string): string => {
      if (!e) return '';
      if (e === email) return usuario.nome;
      const u = usuarios.filter((x) => x.email === e)[0];
      return (u && u.nome) || e.split('@')[0];
    },
    [usuarios, email, usuario.nome]
  );
  const opNome = React.useCallback((id: string): string => (operacoes.filter((o) => o.id === id)[0] || { nome: id }).nome, [operacoes]);

  // ------------------------------------------------------------ dados
  const carregar = React.useCallback(
    async (silencioso: boolean = false): Promise<void> => {
      const id = ++reqRef.current;
      if (!silencioso) setAtualizando(true);
      try {
        const [us, ped, ops] = await Promise.all([servicos.acessos.usuarios(), servicos.acessos.pedidos(), servicos.dados.ler<{ list: IOperacao[] }>('cfg/ops')]);
        const lista = ops && ops.list && ops.list.length ? ops.list : [OPERACAO_PADRAO];
        const opAtual = lista.some((o) => o.id === op) ? op : lista[0].id;
        const [ini, fim] = periodoDoMes(ym);
        const [hcD, parD, absD, mes, dia] = await Promise.all([
          servicos.dados.ler<IHeadcount>(`hc/${opAtual}`),
          servicos.dados.ler<IParametros>(`cfg/params_${opAtual}`),
          servicos.dados.ler<IAbs>(`cfg/abs_${opAtual}`),
          servicos.lancamentos.periodo(opAtual, ini, fim),
          servicos.lancamentos.periodo(opAtual, ldate, ldate)
        ]);
        const h = admin ? await servicos.historico.recentes(15) : [];
        if (id !== reqRef.current) return;
        setListasOk(us !== undefined);
        setUsuarios(us || []);
        setPedidos(ped);
        setOperacoes(lista);
        if (opAtual !== op) setOpEstado(opAtual);
        setHc(hcD && Array.isArray(hcD.rows) ? hcD : { rows: [] });
        setParams({ h: { ...PARAMETROS_PADRAO.h, ...((parD && parD.h) || {}) }, meta: parD && parD.meta ? parD.meta : PARAMETROS_PADRAO.meta });
        setAbsExiste(!!absD);
        setAbs({ ...ABS_PADRAO, ...(absD || {}) });
        setLancMes(mes);
        setLancDia(dia);
        setHist(h);
        setAtualizadoEm(new Date());
        setFase('pronto');
        setErro(undefined);
      } catch (e) {
        if (id !== reqRef.current) return;
        if (!silencioso) {
          setErro(mensagem(e));
          setFase('erro');
        }
      } finally {
        if (id === reqRef.current) setAtualizando(false);
      }
    },
    [servicos, op, ym, ldate, admin]
  );

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  // confere de tempos em tempos se alguém alterou os dados (um GET leve por lista) e recarrega
  React.useEffect(() => {
    if (!props.intervaloAtualizacao) return;
    let ultimo = '';
    const conferir = async (): Promise<void> => {
      try {
        const [a, b, c] = await Promise.all([servicos.dados.assinatura(), servicos.acessos.assinatura(), servicos.lancamentos.assinatura()]);
        const s = `${a}|${b}|${c}`;
        if (ultimo && s !== ultimo) await carregar(true);
        ultimo = s;
      } catch {
        /* sem rede por um instante: tenta de novo no próximo ciclo */
      }
    };
    conferir().catch(() => undefined);
    const t = window.setInterval(() => {
      conferir().catch(() => undefined);
    }, props.intervaloAtualizacao * 1000);
    return () => window.clearInterval(t);
  }, [props.intervaloAtualizacao, servicos, carregar]);

  React.useEffect(() => {
    servicos.perfil
      .meuPerfil()
      .then(setPerfilSp)
      .catch(() => undefined);
  }, [servicos]);

  // a operação atual precisa estar liberada para o usuário
  React.useEffect(() => {
    if (fase !== 'pronto' || !aprovado || podeOperacao(op)) return;
    const livre = operacoes.filter((o) => podeOperacao(o.id))[0];
    if (livre) trocarOp(livre.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, aprovado, op, operacoes, podeOperacao]);

  const telaCheia = !props.modoEdicao && !admin;
  React.useEffect(() => {
    if (!telaCheia) return;
    const estilo = document.createElement('style');
    estilo.setAttribute('data-presenteismo', 'tela-cheia');
    estilo.textContent = CSS_TELA_CHEIA;
    document.head.appendChild(estilo);
    return () => {
      document.head.removeChild(estilo);
    };
  }, [telaCheia]);

  // ------------------------------------------------------------ ações
  const avisar = React.useCallback((tipo: 'ok' | 'erro' | 'info', texto: string): void => {
    setAviso({ tipo: tipo === 'erro' ? MessageBarType.error : tipo === 'ok' ? MessageBarType.success : MessageBarType.info, texto });
  }, []);

  const registrar = React.useCallback(
    (acao: string, detalhe: string): void => {
      servicos.historico.registrar({ a: acao, k: detalhe, por: email, op, em: new Date().toISOString() }).catch(() => undefined);
    },
    [servicos, email, op]
  );

  const gravar = React.useCallback(
    async (fn: () => Promise<void>, sucesso?: string): Promise<boolean> => {
      try {
        await fn();
        if (sucesso) avisar('ok', sucesso);
        await carregar(true);
        return true;
      } catch (e) {
        avisar('erro', `Não foi possível gravar: ${mensagem(e)}`);
        return false;
      }
    },
    [avisar, carregar]
  );

  function trocarOp(id: string): void {
    try {
      window.localStorage.setItem(CHAVE_OP, id);
    } catch {
      /* navegação privada */
    }
    setOpEstado(id);
    setGestorPre('');
    setBuscaAplicada('');
  }

  const permitida = React.useCallback(
    (v: Visao): boolean => {
      if (v === 'painel') return pm('painel');
      if (v === 'lancamento') return pm('lanc');
      if (v === 'acompanhamento') return pm('acomp');
      if (v === 'relatorios') return pm('exp');
      if (v === 'headcount' || v === 'administracao') return admin;
      return true;
    },
    [pm, admin]
  );

  const irPara = React.useCallback((v: Visao): void => {
    setVisao(v);
    setMenuLateral(false);
    setAviso(undefined);
    const el = document.querySelector('[data-presenteismo-principal]');
    if (el) el.scrollTop = 0;
  }, []);

  // sem a lista de usuários (ainda não criada): o administrador vai direto para a Administração
  const forcarAdmin = !listasOk && admin;
  const visaoAtual: Visao = forcarAdmin ? 'administracao' : permitida(visao) ? visao : 'home';

  // ------------------------------------------------------------ notificações
  const pendenciasDia = React.useMemo(() => {
    if (!aprovado || !pm('lanc')) return 0;
    const grupos: Record<string, boolean> = {};
    const doDia: Record<string, ILancamento> = {};
    lancDia.forEach((l) => (doDia[l.id] = l));
    equipe.forEach((r) => {
      const l = doDia[`${op}_${ldate}_${chave(r.g)}`];
      if (!l || !l.e[r.u]) grupos[`${r.t}|${r.g}`] = true;
    });
    return Object.keys(grupos).length;
  }, [aprovado, pm, lancDia, equipe, op, ldate]);
  const pedidosPendentes = admin ? pedidos.filter((p) => !usuarios.some((u) => u.email === p.email)).length : 0;
  const naoLidas = pedidosPendentes + pendenciasDia;

  const dados: IDados = {
    op,
    operacoes,
    hc,
    params,
    abs,
    absExiste,
    usuarios,
    pedidos,
    hist,
    lancMes,
    lancDia,
    ym,
    ldate,
    email,
    nome: usuario.nome,
    eu,
    admin,
    completo,
    pm,
    equipe,
    nomeDe,
    opNome,
    podeOperacao,
    setYm,
    setLdate,
    setOp: trocarOp,
    recarregar: () => carregar(),
    atualizando,
    atualizadoEm,
    avisar,
    registrar,
    gravar,
    servicos,
    irPara
  };

  const foto = perfilSp && perfilSp.temFoto ? servicos.perfil.urlFoto(perfilSp.email || email, 'M') : undefined;
  const nome = nomeCurto((perfilSp && perfilSp.nome) || usuario.nome);
  const rotuloPerfil = ehAdminPrincipal ? 'Administrador' : aprovado ? eu.perfil.charAt(0).toUpperCase() + eu.perfil.slice(1) : 'Sem acesso';
  const menu = MENU.filter((m) => (forcarAdmin ? m.visao === 'administracao' : permitida(m.visao)));

  function pesquisar(): void {
    setBuscaAplicada(busca.trim());
    setGestorPre('');
    if (permitida('lancamento')) irPara('lancamento');
  }

  // ------------------------------------------------------------ conteúdo
  let conteudo: JSX.Element;
  if (fase === 'carregando') {
    conteudo = (
      <div className={styles.centro}>
        <Spinner size={SpinnerSize.large} label="Carregando o portal…" />
      </div>
    );
  } else if (fase === 'erro') {
    conteudo = (
      <div className={styles.centro}>
        <Aviso titulo="Não foi possível carregar o portal" texto={`${erro || ''} Confira o site configurado nas propriedades do web part e se você tem acesso a ele.`} />
        <button type="button" className={styles.botaoAmarelo} onClick={() => carregar().catch(() => undefined)}>
          Tentar de novo
        </button>
      </div>
    );
  } else if (!listasOk && !admin) {
    conteudo = (
      <div className={styles.centro}>
        <Aviso titulo="Portal ainda não configurado" texto="As listas de dados do Presenteísmo ainda não foram criadas neste site. Peça ao administrador para abrir o portal e criar as listas em Administração." />
      </div>
    );
  } else if (!aprovado && !admin) {
    conteudo = <SolicitarAcesso d={dados} pedido={pedidos.filter((p) => p.email === email)[0]} bloqueado={eu.status === 'bloqueado'} />;
  } else {
    conteudo = (
      <>
        {visaoAtual === 'home' && <Home d={dados} titulo={props.titulo} frase={props.frase} imagemBanner={props.imagemBanner} />}
        {visaoAtual === 'painel' && <Painel d={dados} />}
        {visaoAtual === 'lancamento' && <Lancamento d={dados} gestorInicial={gestorPre} busca={buscaAplicada} onLimparBusca={() => setBuscaAplicada('')} />}
        {visaoAtual === 'acompanhamento' && (
          <Acompanhamento
            d={dados}
            onAbrirGestor={(g) => {
              setGestorPre(g);
              setBuscaAplicada('');
              irPara('lancamento');
            }}
          />
        )}
        {visaoAtual === 'relatorios' && <Relatorios d={dados} />}
        {visaoAtual === 'headcount' && <Headcount d={dados} />}
        {visaoAtual === 'administracao' && <Administracao d={dados} listasOk={listasOk} />}
      </>
    );
  }

  return (
    <div className={`${styles.app} ${telaCheia ? styles.telaCheia : ''}`}>
      <header className={styles.topo}>
        <button type="button" className={styles.botaoMenu} aria-label="Abrir menu" onClick={() => setMenuLateral((m) => !m)} style={{ border: 0, background: 'transparent', fontSize: 20, cursor: 'pointer' }}>
          <Icon iconName="GlobalNavButton" />
        </button>
        <button type="button" className={styles.marca} onClick={() => irPara('home')} title="Início">
          <img src={LOGO_DHL} alt="DHL" />
          <b>{props.titulo}</b>
          <span className={styles.marcaSub}>{props.subtitulo}</span>
        </button>
        {fase === 'pronto' && operacoes.length > 0 && (
          <label className={styles.operacao}>
            Operação
            <select value={op} onChange={(e) => trocarOp(e.target.value)} aria-label="Operação">
              {operacoes
                .filter((o) => podeOperacao(o.id) || !aprovado)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
            </select>
          </label>
        )}

        <div className={styles.busca}>
          <Icon iconName="Search" />
          <input
            type="search"
            placeholder="Pesquisar colaborador, usuário ou gestor…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pesquisar()}
            aria-label="Pesquisar colaborador"
          />
        </div>

        <div className={styles.topoAcoes}>
          <button type="button" className={styles.iconeTopo} onClick={() => setNotifAberto(true)} aria-label={`Pendências (${naoLidas})`} title="Pendências">
            <Icon iconName="Ringer" />
            {naoLidas > 0 && <span className={styles.badge}>{naoLidas > 9 ? '9+' : naoLidas}</span>}
          </button>
          <button type="button" className={styles.iconeTopo} onClick={() => carregar().catch(() => undefined)} aria-label="Atualizar" title="Atualizar os dados">
            <Icon iconName="Refresh" className={atualizando ? styles.girando : ''} />
          </button>
          <button ref={botaoUsuario} type="button" className={styles.usuario} onClick={() => setMenuUsuario(true)} aria-haspopup="menu">
            <Avatar nome={nome} foto={foto} tamanho={38} />
            <span className={styles.usuarioTexto}>
              <b>{nome}</b>
              <small>{rotuloPerfil}</small>
            </span>
            <Icon iconName="ChevronDown" />
          </button>
          {menuUsuario && (
            <ContextualMenu
              target={botaoUsuario}
              onDismiss={() => setMenuUsuario(false)}
              directionalHint={DirectionalHint.bottomRightEdge}
              items={[
                { key: 'quem', text: `${usuario.nome} · ${rotuloPerfil}`, disabled: true },
                { key: 'email', text: email, disabled: true },
                { key: 'atualizar', text: 'Atualizar dados', iconProps: { iconName: 'Refresh' }, onClick: () => {
                    carregar().catch(() => undefined);
                  }
                }
              ]}
            />
          )}
        </div>
      </header>

      <div className={styles.corpo}>
        <nav className={`${styles.lateral} ${menuLateral ? styles.lateralAberta : ''}`} aria-label="Navegação do portal">
          <ul>
            {menu.map((m) => (
              <li key={m.visao}>
                <button type="button" className={m.visao === visaoAtual ? styles.lateralAtivo : ''} onClick={() => irPara(m.visao)} aria-current={m.visao === visaoAtual ? 'page' : undefined}>
                  <Icon iconName={m.icone} />
                  <span>{m.texto}</span>
                  {m.visao === 'administracao' && pedidosPendentes > 0 && (
                    <span className={styles.lateralBadge} title={`${pedidosPendentes} pedido(s) de acesso`} aria-label={`${pedidosPendentes} pedidos de acesso`}>
                      {pedidosPendentes > 99 ? '99+' : pedidosPendentes}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.lema}>
            <i />
            <p>
              Qualidade.
              <br />
              Pessoas.
              <br />
              Processos.
              <br />
              Um futuro melhor.
            </p>
          </div>
        </nav>

        <main className={styles.principal} data-presenteismo-principal="1" style={{ overflowY: telaCheia ? 'auto' : undefined }}>
          {aviso && (
            <MessageBar messageBarType={aviso.tipo} onDismiss={() => setAviso(undefined)} className={styles.aviso}>
              {aviso.texto}
            </MessageBar>
          )}
          {conteudo}
        </main>
      </div>

      <Panel isOpen={notifAberto} onDismiss={() => setNotifAberto(false)} type={PanelType.smallFixedFar} headerText="Pendências" closeButtonAriaLabel="Fechar">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pedidosPendentes > 0 && (
            <li>
              <button
                type="button"
                className={styles.botao}
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setNotifAberto(false);
                  irPara('administracao');
                }}
              >
                <Icon iconName="AddFriend" /> {pedidosPendentes} pedido{pedidosPendentes > 1 ? 's' : ''} de acesso aguardando aprovação
              </button>
            </li>
          )}
          {pendenciasDia > 0 && (
            <li>
              <button
                type="button"
                className={styles.botao}
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => {
                  setNotifAberto(false);
                  irPara(permitida('acompanhamento') ? 'acompanhamento' : 'lancamento');
                }}
              >
                <Icon iconName="Clock" /> {pendenciasDia} equipe{pendenciasDia > 1 ? 's' : ''} sem lançamento completo em {ldate.slice(8)}/{ldate.slice(5, 7)}
              </button>
            </li>
          )}
          {naoLidas === 0 && <li className={styles.suave}>Nenhuma pendência por enquanto.</li>}
        </ul>
      </Panel>
    </div>
  );
}

/** Tela de quem ainda não tem acesso: pedido com nome e e-mail corporativo. */
const SolicitarAcesso: React.FC<{ d: IDados; pedido?: IPedido; bloqueado: boolean }> = ({ d, pedido, bloqueado }) => {
  const [nome, setNome] = React.useState(d.nome);
  const [enviando, setEnviando] = React.useState(false);
  if (bloqueado) return <Aviso titulo="Acesso bloqueado" texto="O administrador bloqueou o seu acesso. Fale com ele para saber mais." />;
  if (pedido) return <Aviso titulo="Aguardando aprovação" texto={`Seu pedido foi registrado com o e-mail ${pedido.email}. O administrador precisa aprovar e definir seu perfil e sua equipe.`} />;
  const enviar = async (): Promise<void> => {
    if (nome.trim().length < 3) {
      d.avisar('erro', 'Informe seu nome completo.');
      return;
    }
    setEnviando(true);
    await d.gravar(() => d.servicos.acessos.pedirAcesso(d.email, nome.trim()), 'Pedido enviado. Aguarde a aprovação do administrador.');
    setEnviando(false);
  };
  return (
    <div className={styles.cartao} style={{ maxWidth: 460, margin: '28px auto' }}>
      <div className={styles.cartaoTopo}>
        <h3>Solicitar acesso</h3>
      </div>
      <p className={styles.mudo} style={{ margin: '0 0 12px' }}>
        Você ainda não tem acesso ao portal de Presenteísmo. O administrador aprova e define seu perfil e sua equipe.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className={styles.campo}>
          Nome completo
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className={styles.campo}>
          E-mail
          <input type="text" value={d.email} readOnly />
        </label>
        <button type="button" className={styles.botaoAmarelo} disabled={enviando} onClick={() => enviar().catch(() => undefined)}>
          Solicitar acesso
        </button>
      </div>
    </div>
  );
};
