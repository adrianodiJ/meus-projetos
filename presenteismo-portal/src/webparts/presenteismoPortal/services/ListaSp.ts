import { aspas, type SpClient, type SpError } from './SpClient';

/** Acesso REST a uma lista do SharePoint pelo título. */
export class ListaSp {
  public readonly titulo: string;
  private readonly _sp: SpClient;

  public constructor(sp: SpClient, titulo: string) {
    this._sp = sp;
    this.titulo = titulo;
  }

  private get _base(): string {
    return `web/lists/getbytitle('${aspas(this.titulo)}')`;
  }

  /** "Impressão digital" da lista: muda quando alguém cria, altera ou exclui itens ('' se a lista não existe). */
  public async assinatura(): Promise<string> {
    try {
      const r = await this._sp.get<{ ItemCount?: number; LastItemModifiedDate?: string; LastItemDeletedDate?: string }>(
        `${this._base}?$select=ItemCount,LastItemModifiedDate,LastItemDeletedDate`
      );
      return `${r.ItemCount ?? ''}|${r.LastItemModifiedDate ?? ''}|${r.LastItemDeletedDate ?? ''}`;
    } catch (e) {
      if ((e as SpError).status === 404) return '';
      throw e;
    }
  }

  public async existe(): Promise<boolean> {
    try {
      await this._sp.get(`${this._base}?$select=Id`);
      return true;
    } catch (e) {
      if ((e as SpError).status === 404) return false;
      throw e;
    }
  }

  /** Itens da lista; devolve undefined se a lista ainda não existe. */
  public async itens<T>(select: string, filtro?: string, ordem?: string): Promise<T[] | undefined> {
    const q = [`$select=${select}`, '$top=2000'];
    if (filtro) q.push(`$filter=${filtro}`);
    if (ordem) q.push(`$orderby=${ordem}`);
    try {
      return await this._sp.getAll<T>(`${this._base}/items?${q.join('&')}`);
    } catch (e) {
      if ((e as SpError).status === 404) return undefined;
      throw e;
    }
  }

  public async criar(corpo: Record<string, unknown>): Promise<number> {
    const r = await this._sp.post<{ Id: number }>(`${this._base}/items`, corpo);
    return r.Id;
  }

  public async atualizar(id: number, corpo: Record<string, unknown>): Promise<void> {
    await this._sp.post<void>(`${this._base}/items(${id})`, corpo, { metodo: 'MERGE' });
  }

  public async excluir(id: number): Promise<void> {
    await this._sp.post<void>(`${this._base}/items(${id})`, undefined, { metodo: 'DELETE' });
  }
}
