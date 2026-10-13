import { LISTA_DADOS } from '../models';
import { aspas, type SpClient } from './SpClient';
import { ListaSp } from './ListaSp';

interface IParte {
  Id: number;
  Parte?: number;
  Json?: string;
}

/** Tamanho de cada pedaço de JSON gravado num item (campo de texto de várias linhas). */
const TAMANHO_PARTE = 30000;

/**
 * Armazém de documentos JSON na lista PRES_Dados: cada documento (headcount, parâmetros, cadastro ABS,
 * operações) ocupa um ou mais itens com o mesmo título (a chave) e a coluna Parte (0, 1, 2…).
 */
export class DadosService {
  private readonly _lista: ListaSp;

  public constructor(sp: SpClient) {
    this._lista = new ListaSp(sp, LISTA_DADOS);
  }

  public assinatura(): Promise<string> {
    return this._lista.assinatura();
  }

  private _partes(chave: string): Promise<IParte[] | undefined> {
    return this._lista.itens<IParte>('Id,Parte,Json', `Title eq '${aspas(chave)}'`, 'Parte asc');
  }

  public async ler<T>(chave: string): Promise<T | undefined> {
    const partes = await this._partes(chave);
    if (!partes || !partes.length) return undefined;
    const texto = partes
      .slice()
      .sort((a, b) => (a.Parte || 0) - (b.Parte || 0))
      .map((p) => p.Json || '')
      .join('');
    try {
      return JSON.parse(texto) as T;
    } catch {
      return undefined;
    }
  }

  public async gravar(chave: string, valor: unknown): Promise<void> {
    const texto = JSON.stringify(valor);
    const novas: string[] = [];
    for (let i = 0; i < texto.length || i === 0; i += TAMANHO_PARTE) novas.push(texto.slice(i, i + TAMANHO_PARTE));
    const atuais = (await this._partes(chave)) || [];
    for (let i = 0; i < novas.length; i++) {
      const existente = atuais.filter((a) => (a.Parte || 0) === i)[0];
      if (existente) await this._lista.atualizar(existente.Id, { Json: novas[i] });
      else await this._lista.criar({ Title: chave, Parte: i, Json: novas[i] });
    }
    for (const a of atuais) if ((a.Parte || 0) >= novas.length) await this._lista.excluir(a.Id);
  }

  /** Aplica um patch raso em um documento objeto (cria se não existir). */
  public async mesclar<T extends Record<string, unknown>>(chave: string, padrao: T, alterar: (atual: T) => T): Promise<T> {
    const atual = (await this.ler<T>(chave)) || padrao;
    const novo = alterar(atual);
    await this.gravar(chave, novo);
    return novo;
  }
}
