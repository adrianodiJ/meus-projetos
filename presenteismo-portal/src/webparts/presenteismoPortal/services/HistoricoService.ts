import { type IHistorico, LISTA_HISTORICO } from '../models';
import type { SpClient } from './SpClient';
import { ListaSp } from './ListaSp';

interface IHistLista {
  Title?: string;
  Detalhe?: string;
  Por?: string;
  Operacao?: string;
  Em?: string;
}

/** Registro de ações (lançamentos, permissões, importações) para auditoria. */
export class HistoricoService {
  private readonly _lista: ListaSp;

  public constructor(sp: SpClient) {
    this._lista = new ListaSp(sp, LISTA_HISTORICO);
  }

  public async registrar(h: IHistorico): Promise<void> {
    try {
      await this._lista.criar({ Title: h.a, Detalhe: h.k.slice(0, 250), Por: h.por, Operacao: h.op, Em: h.em });
    } catch {
      /* o histórico nunca deve impedir a ação principal */
    }
  }

  public async recentes(n: number = 15): Promise<IHistorico[]> {
    try {
      const itens = await this._lista.itens<IHistLista>('Title,Detalhe,Por,Operacao,Em', undefined, 'Id desc');
      return (itens || []).slice(0, n).map((i) => ({ a: i.Title || '', k: i.Detalhe || '', por: i.Por || '', op: i.Operacao || '', em: i.Em || '' }));
    } catch {
      return [];
    }
  }
}
