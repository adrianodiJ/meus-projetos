import { type IPedido, type IUsuario, LISTA_PEDIDOS, LISTA_USUARIOS, type Perfil, PERFIS, STATUS_USUARIO, type StatusUsuario } from '../models';
import { aspas, type SpClient } from './SpClient';
import { ListaSp } from './ListaSp';

interface IUsuarioLista {
  Id: number;
  Title?: string;
  Nome?: string;
  Perfil?: string;
  Status?: string;
  Operacoes?: string;
  Permissoes?: string;
  Gestores?: string;
}

interface IPedidoLista {
  Id: number;
  Title?: string;
  Nome?: string;
  Em?: string;
}

function lerJson<T>(texto: string | undefined, padrao: T): T {
  if (!texto) return padrao;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return padrao;
  }
}

/** Usuários do portal (perfil, equipes, permissões) e pedidos de acesso. */
export class AcessosService {
  private readonly _sp: SpClient;
  private readonly _usuarios: ListaSp;
  private readonly _pedidos: ListaSp;

  public constructor(sp: SpClient) {
    this._sp = sp;
    this._usuarios = new ListaSp(sp, LISTA_USUARIOS);
    this._pedidos = new ListaSp(sp, LISTA_PEDIDOS);
  }

  public async assinatura(): Promise<string> {
    const [a, b] = await Promise.all([this._usuarios.assinatura(), this._pedidos.assinatura()]);
    return `${a}#${b}`;
  }

  /** undefined = a lista ainda não existe. */
  public async usuarios(): Promise<IUsuario[] | undefined> {
    const itens = await this._usuarios.itens<IUsuarioLista>('Id,Title,Nome,Perfil,Status,Operacoes,Permissoes,Gestores', undefined, 'Title asc');
    if (!itens) return undefined;
    return itens.map((i) => ({
      id: i.Id,
      email: (i.Title || '').trim().toLowerCase(),
      nome: i.Nome || '',
      perfil: (PERFIS.indexOf(i.Perfil as Perfil) >= 0 ? i.Perfil : 'coordenador') as Perfil,
      status: (STATUS_USUARIO.indexOf(i.Status as StatusUsuario) >= 0 ? i.Status : 'pendente') as StatusUsuario,
      ops: lerJson<string[]>(i.Operacoes, []),
      perm: lerJson<Record<string, boolean>>(i.Permissoes, {}),
      gestores: lerJson<string[]>(i.Gestores, [])
    }));
  }

  public async pedidos(): Promise<IPedido[]> {
    const itens = await this._pedidos.itens<IPedidoLista>('Id,Title,Nome,Em', undefined, 'Id asc');
    return (itens || []).map((i) => ({ id: i.Id, email: (i.Title || '').trim().toLowerCase(), nome: i.Nome || '', em: i.Em || '' }));
  }

  public async salvarUsuario(u: Omit<IUsuario, 'id'> & { id?: number }): Promise<void> {
    const corpo = {
      Title: u.email.trim().toLowerCase(),
      Nome: u.nome,
      Perfil: u.perfil,
      Status: u.status,
      Operacoes: JSON.stringify(u.ops),
      Permissoes: JSON.stringify(u.perm),
      Gestores: JSON.stringify(u.gestores)
    };
    if (u.id) await this._usuarios.atualizar(u.id, corpo);
    else await this._usuarios.criar(corpo);
  }

  /** Altera só alguns campos do usuário (já convertidos para o formato da lista). */
  public async alterarUsuario(id: number, campos: Partial<Pick<IUsuario, 'perfil' | 'status' | 'ops' | 'perm' | 'gestores'>>): Promise<void> {
    const c: Record<string, unknown> = {};
    if (campos.perfil !== undefined) c.Perfil = campos.perfil;
    if (campos.status !== undefined) c.Status = campos.status;
    if (campos.ops !== undefined) c.Operacoes = JSON.stringify(campos.ops);
    if (campos.perm !== undefined) c.Permissoes = JSON.stringify(campos.perm);
    if (campos.gestores !== undefined) c.Gestores = JSON.stringify(campos.gestores);
    await this._usuarios.atualizar(id, c);
  }

  public excluirUsuario(id: number): Promise<void> {
    return this._usuarios.excluir(id);
  }

  public async pedirAcesso(email: string, nome: string): Promise<void> {
    const ja = await this._pedidos.itens<IPedidoLista>('Id', `Title eq '${aspas(email.toLowerCase())}'`);
    if (ja && ja.length) return;
    await this._pedidos.criar({ Title: email.toLowerCase(), Nome: nome, Em: new Date().toISOString() });
  }

  public excluirPedido(id: number): Promise<void> {
    return this._pedidos.excluir(id);
  }

  /** Nome de exibição no diretório (também confirma que a conta existe). */
  public async resolverNome(email: string): Promise<string | undefined> {
    try {
      const r = await this._sp.post<{ Title?: string }>('web/ensureuser', { logonName: `i:0#.f|membership|${email.trim().toLowerCase()}` });
      return r && r.Title ? r.Title : undefined;
    } catch {
      return undefined;
    }
  }
}
