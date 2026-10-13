import { SPHttpClient, type ISPHttpClientOptions } from '@microsoft/sp-http';

export class SpError extends Error {
  public readonly status: number;

  public constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

interface IPagina<T> {
  value: T[];
  'odata.nextLink'?: string;
  '@odata.nextLink'?: string;
}

const ACCEPT = 'application/json;odata=nometadata';

export function aspas(valor: string): string {
  return valor.replace(/'/g, "''");
}

/** Cliente REST do SharePoint com a sessão do usuário (sem MSAL nem consentimento extra). */
export class SpClient {
  public readonly webUrl: string;
  private readonly _http: SPHttpClient;

  public constructor(http: SPHttpClient, webUrl: string) {
    this._http = http;
    this.webUrl = webUrl.replace(/\/$/, '');
  }

  private _url(caminho: string): string {
    if (caminho.indexOf('http') === 0) return caminho;
    return `${this.webUrl}/_api/${caminho.replace(/^\//, '')}`;
  }

  private async _erro(resp: { status: number; statusText: string; text: () => Promise<string> }): Promise<SpError> {
    let detalhe = resp.statusText;
    try {
      const texto = await resp.text();
      const j = texto ? JSON.parse(texto) : undefined;
      detalhe = j?.error?.message?.value || j?.error?.message || j?.['odata.error']?.message?.value || detalhe;
    } catch {
      /* corpo vazio */
    }
    if (resp.status === 403) detalhe = `Sem permissão no SharePoint para esta ação. ${detalhe}`;
    return new SpError(resp.status, `SharePoint ${resp.status}: ${detalhe}`);
  }

  public async get<T>(caminho: string): Promise<T> {
    const resp = await this._http.get(this._url(caminho), SPHttpClient.configurations.v1, {
      headers: { Accept: ACCEPT, 'odata-version': '' }
    });
    if (!resp.ok) throw await this._erro(resp);
    return (await resp.json()) as T;
  }

  /** Lê todas as páginas de uma consulta de itens/coleções. */
  public async getAll<T>(caminho: string): Promise<T[]> {
    const itens: T[] = [];
    let proximo: string | undefined = caminho;
    while (proximo) {
      const pagina: IPagina<T> = await this.get<IPagina<T>>(proximo);
      itens.push(...(pagina.value || []));
      proximo = pagina['odata.nextLink'] || pagina['@odata.nextLink'];
    }
    return itens;
  }

  public async post<T>(
    caminho: string,
    corpo?: unknown,
    extra?: { metodo?: 'MERGE' | 'DELETE' | 'PUT'; binario?: ArrayBuffer }
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: ACCEPT, 'odata-version': '' };
    if (extra?.metodo) {
      headers['X-HTTP-Method'] = extra.metodo;
      headers['IF-MATCH'] = '*';
    }
    // Content-Type sempre explícito: sem ele, o SPHttpClient (jsonRequest) exige OData-Version 3.0/4.0
    // e recusa a requisição antes de enviá-la. Em odata=nometadata o corpo não leva "__metadata".
    const opcoes: ISPHttpClientOptions = { headers };
    if (extra?.binario) {
      headers['Content-Type'] = 'application/octet-stream';
      opcoes.body = extra.binario;
    } else {
      headers['Content-Type'] = 'application/json;odata=nometadata';
      if (corpo !== undefined) opcoes.body = JSON.stringify(corpo);
    }
    const resp = await this._http.post(this._url(caminho), SPHttpClient.configurations.v1, opcoes);
    if (!resp.ok) throw await this._erro(resp);
    if (resp.status === 204) return undefined as unknown as T;
    const texto = await resp.text();
    return (texto ? JSON.parse(texto) : undefined) as T;
  }
}

/** Nome de arquivo seguro para anexos do SharePoint. */
export function nomeArquivoSeguro(nome: string): string {
  const limpo = nome.replace(/[\\/:*?"<>|#%&{}~]/g, '_').replace(/\s+/g, ' ').trim();
  return limpo.length > 120 ? limpo.slice(-120) : limpo;
}

export function lerArquivo(arquivo: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = (): void => resolve(leitor.result as ArrayBuffer);
    leitor.onerror = (): void => reject(new Error(`Não foi possível ler ${arquivo.name}.`));
    leitor.readAsArrayBuffer(arquivo);
  });
}
