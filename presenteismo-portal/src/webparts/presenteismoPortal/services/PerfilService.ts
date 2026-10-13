import type { IPerfilSp } from '../models';
import { aspas, type SpClient } from './SpClient';

interface IPropriedadesSp {
  AccountName?: string;
  DisplayName?: string;
  Email?: string;
  Title?: string;
  PictureUrl?: string; // vem null quando não há foto
  // odata=nometadata devolve lista de { Key, Value }; verbose devolve { results: [...] }
  UserProfileProperties?: { Key: string; Value: string }[] | { results: { Key: string; Value: string }[] };
}

function propriedades(r: IPropriedadesSp): Record<string, string> {
  const bruto = r.UserProfileProperties;
  const lista = Array.isArray(bruto) ? bruto : bruto?.results || [];
  const mapa: Record<string, string> = {};
  for (const p of lista) mapa[p.Key] = p.Value || '';
  return mapa;
}

/** Perfil do Microsoft 365 pela API de Perfis de Usuário do SharePoint (sem Graph). */
export class PerfilService {
  private readonly _sp: SpClient;

  public constructor(sp: SpClient) {
    this._sp = sp;
  }

  /** Tamanhos: S 48px, M 72px, L 300px. */
  public urlFoto(email: string, tamanho: 'S' | 'M' | 'L' = 'M'): string {
    return `${this._sp.webUrl}/_layouts/15/userphoto.aspx?size=${tamanho}&accountname=${encodeURIComponent(email)}`;
  }

  public async meuPerfil(): Promise<IPerfilSp> {
    const r = await this._sp.get<IPropriedadesSp>('SP.UserProfiles.PeopleManager/GetMyProperties');
    const p = propriedades(r);
    return {
      nome: r.DisplayName || p.PreferredName || '',
      email: (r.Email || p.WorkEmail || '').toLowerCase(),
      cargo: r.Title || p['SPS-JobTitle'] || p.Title || '',
      departamento: p.Department || p['SPS-Department'] || '',
      escritorio: p.Office || p['SPS-Location'] || '',
      telefone: p.WorkPhone || '',
      celular: p.CellPhone || '',
      temFoto: !!(r.PictureUrl || p.PictureURL),
      gestorConta: p.Manager || ''
    };
  }

  public async pessoa(conta: string): Promise<{ nome: string; cargo: string; email: string }> {
    const r = await this._sp.get<IPropriedadesSp>(
      `SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v='${encodeURIComponent(aspas(conta))}'`
    );
    return { nome: r.DisplayName || conta, cargo: r.Title || '', email: (r.Email || '').toLowerCase() };
  }
}
