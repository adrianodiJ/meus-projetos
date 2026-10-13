import { type ILancamento, LISTA_LANCAMENTOS, type ILancEntrada } from '../models';
import { dataNum } from '../lib/util';
import { aspas, type SpClient } from './SpClient';
import { ListaSp } from './ListaSp';

interface ILancLista {
  Id: number;
  Title?: string;
  Operacao?: string;
  Data?: string;
  Gestor?: string;
  Dados?: string;
  Por?: string;
  Em?: string;
}

const SELECT = 'Id,Title,Operacao,Data,Gestor,Dados,Por,Em';

function converter(i: ILancLista): ILancamento {
  let e: Record<string, ILancEntrada> = {};
  try {
    e = i.Dados ? (JSON.parse(i.Dados) as Record<string, ILancEntrada>) : {};
  } catch {
    e = {};
  }
  return { id: i.Title || '', op: i.Operacao || '', d: i.Data || '', g: i.Gestor || '', e, por: (i.Por || '').toLowerCase(), em: i.Em || '' };
}

/** Lançamentos de presença: um item por operação, dia e gestor (Title = id do lançamento). */
export class LancamentosService {
  private readonly _lista: ListaSp;

  public constructor(sp: SpClient) {
    this._lista = new ListaSp(sp, LISTA_LANCAMENTOS);
  }

  public assinatura(): Promise<string> {
    return this._lista.assinatura();
  }

  public async periodo(op: string, ini: string, fim: string): Promise<ILancamento[]> {
    const itens = await this._lista.itens<ILancLista>(SELECT, `Operacao eq '${aspas(op)}' and DataNum ge ${dataNum(ini)} and DataNum le ${dataNum(fim)}`);
    return (itens || []).map(converter);
  }

  public async salvar(l: ILancamento): Promise<void> {
    const existente = await this._lista.itens<ILancLista>('Id', `Title eq '${aspas(l.id)}'`);
    const corpo = {
      Title: l.id,
      Operacao: l.op,
      Data: l.d,
      DataNum: dataNum(l.d),
      Gestor: l.g,
      Dados: JSON.stringify(l.e),
      Por: l.por,
      Em: l.em
    };
    if (existente && existente.length) await this._lista.atualizar(existente[0].Id, corpo);
    else await this._lista.criar(corpo);
  }
}
