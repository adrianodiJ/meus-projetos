import { type IPedido, type IUsuario, LISTA_PEDIDOS, LISTA_USUARIOS, type Perfil, PERFIS, type TipoPedido } from '../models';
import { nomeCombina } from '../lib/util';
import type { SpClient, SpError } from './SpClient';
import { ListaSp } from './ListaSp';

interface IUsuarioLista {
  Id: number;
  Title?: string;
  Nome?: string;
  Perfil?: string;
  Status?: string;
  Operacoes?: string;
}

interface IPedidoLista {
  Id: number;
  Title?: string;
  Nome?: string;
  Em?: string;
  Tipo?: string;
}

interface IEntidadePicker {
  Key?: string;
  DisplayText?: string;
  EntityData?: { Email?: string };
}

function lerJson<T>(texto: string | undefined, padrao: T): T {
  if (!texto) return padrao;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return padrao;
  }
}

/** Administradores e liberações extras de operação (PRES_Usuarios) e pedidos de acesso (PRES_Pedidos). */
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

  private _itensUsuarios(): Promise<IUsuarioLista[] | undefined> {
    return this._usuarios.itens<IUsuarioLista>('Id,Title,Nome,Perfil,Status,Operacoes', undefined, 'Title asc');
  }

  /** undefined = a lista ainda não existe. Cadastros do modelo antigo (coordenador, supervisor, gerente) ficam de fora. */
  public async usuarios(): Promise<IUsuario[] | undefined> {
    const itens = await this._itensUsuarios();
    if (!itens) return undefined;
    return itens
      .filter((i) => PERFIS.indexOf(i.Perfil as Perfil) >= 0 && i.Status !== 'bloqueado' && i.Status !== 'pendente')
      .map((i) => ({
        id: i.Id,
        email: (i.Title || '').trim().toLowerCase(),
        nome: i.Nome || '',
        perfil: i.Perfil as Perfil,
        ops: lerJson<string[]>(i.Operacoes, [])
      }));
  }

  /** Apaga os cadastros do modelo antigo (coordenador/supervisor/gerente criados à mão). Devolve quantos apagou. */
  public async limparLegados(): Promise<number> {
    const itens = (await this._itensUsuarios()) || [];
    const velhos = itens.filter((i) => PERFIS.indexOf(i.Perfil as Perfil) < 0 || i.Status === 'bloqueado' || i.Status === 'pendente');
    for (const v of velhos) await this._usuarios.excluir(v.Id);
    return velhos.length;
  }

  public async pedidos(): Promise<IPedido[]> {
    let itens: IPedidoLista[] | undefined;
    try {
      itens = await this._pedidos.itens<IPedidoLista>('Id,Title,Nome,Em,Tipo', undefined, 'Id asc');
    } catch (e) {
      // lista criada antes da coluna Tipo: lê sem ela (pedidos antigos, descartados pelo portal)
      if ((e as SpError).status !== 400) throw e;
      itens = await this._pedidos.itens<IPedidoLista>('Id,Title,Nome,Em', undefined, 'Id asc');
    }
    return (itens || []).map((i) => ({ id: i.Id, email: (i.Title || '').trim().toLowerCase(), nome: i.Nome || '', em: i.Em || '', tipo: i.Tipo || 'admin' }));
  }

  public async salvarUsuario(u: Omit<IUsuario, 'id'> & { id?: number }): Promise<void> {
    const corpo = {
      Title: u.email.trim().toLowerCase(),
      Nome: u.nome,
      Perfil: u.perfil,
      Status: 'aprovado',
      Operacoes: JSON.stringify(u.ops)
    };
    if (u.id) await this._usuarios.atualizar(u.id, corpo);
    else await this._usuarios.criar(corpo);
  }

  public excluirUsuario(id: number): Promise<void> {
    return this._usuarios.excluir(id);
  }

  public async pedirAcesso(email: string, nome: string, tipo: TipoPedido): Promise<void> {
    const ja = (await this.pedidos()).filter((p) => p.email === email.toLowerCase() && p.tipo === tipo);
    if (ja.length) return;
    await this._pedidos.criar({ Title: email.toLowerCase(), Nome: nome, Em: new Date().toISOString(), Tipo: tipo });
  }

  public excluirPedido(id: number): Promise<void> {
    return this._pedidos.excluir(id);
  }

  /**
   * Administrador do portal = quem administra o site do SharePoint (proprietário: permissão "Gerenciar site",
   * ou administrador do conjunto de sites).
   */
  public async donoDoSite(): Promise<boolean> {
    return (await this.permissoesNoSite()).gerenciar;
  }

  /**
   * O que a conta pode fazer no site das listas: ler itens (ViewListItems, bit 1) e gerenciar o site
   * (ManageWeb, bit 31). Quem só recebeu a página por link tem "acesso limitado": abre a página, mas não lê as
   * listas — e o SharePoint responde "lista não existe" em vez de "sem permissão".
   */
  public async permissoesNoSite(): Promise<{ ler: boolean; gerenciar: boolean }> {
    try {
      const p = await this._sp.get<{ High?: string | number; Low?: string | number }>('web/effectiveBasePermissions');
      const low = Number(p && p.Low) || 0;
      return { ler: low % 2 === 1, gerenciar: Math.floor(low / 0x40000000) % 2 === 1 };
    } catch {
      return { ler: false, gerenciar: false };
    }
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

  /**
   * Procura o gestor da planilha no diretório (seletor de pessoas do SharePoint) e devolve a conta
   * só quando há um único resultado com todas as palavras do nome. Sem certeza, devolve undefined.
   */
  public async buscarPorNome(nome: string): Promise<{ email: string; nome: string } | undefined> {
    try {
      const r = await this._sp.post<{ value?: string }>('SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser', {
        queryParams: {
          QueryString: nome,
          MaximumEntitySuggestions: 10,
          AllowEmailAddresses: false,
          AllowOnlyEmailAddresses: false,
          PrincipalSource: 15,
          PrincipalType: 1,
          SharePointGroupID: 0
        }
      });
      const lista = lerJson<IEntidadePicker[]>(r && r.value, []);
      const certos = lista
        .map((x) => ({ email: ((x.EntityData && x.EntityData.Email) || '').trim().toLowerCase(), nome: x.DisplayText || '' }))
        .filter((x) => x.email && nomeCombina(nome, x.nome));
      const unicos = certos.filter((x, i) => certos.findIndex((y) => y.email === x.email) === i);
      return unicos.length === 1 ? unicos[0] : undefined;
    } catch {
      return undefined;
    }
  }
}

