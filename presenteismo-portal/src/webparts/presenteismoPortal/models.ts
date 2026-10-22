// Modelos e constantes do portal de Presenteísmo.

export type Turno = 'PRIMEIRO' | 'SEGUNDO' | 'ADM';
/**
 * Perfil gravado na lista PRES_Usuarios: "acesso" = coordenador com operações extras liberadas por um administrador.
 * Coordenadores vêm do headcount (coluna GESTOR) e administradores são os proprietários do site do SharePoint.
 */
export type Perfil = 'acesso';

export const TURNOS: Turno[] = ['PRIMEIRO', 'SEGUNDO', 'ADM'];
export const ROTULO_TURNO: Record<string, string> = { PRIMEIRO: '1º turno', SEGUNDO: '2º turno', ADM: 'ADM', GERAL: 'Geral' };
export const PERFIS: Perfil[] = ['acesso'];

/** Motivos de ausência que entram no cálculo do presenteísmo. */
export const MOTIVOS_FALTA: string[] = ['Falta injustificada', 'Atestado'];
export const MOTIVOS: string[] = [
  'Falta injustificada',
  'Atestado',
  'Férias',
  'Sinergia',
  'Treinamento',
  'Abono chefia',
  'Banco de horas',
  'Desligado',
  'Afastamento',
  'Outros'
];

export const LISTA_DADOS = 'PRES_Dados';
export const LISTA_USUARIOS = 'PRES_Usuarios';
export const LISTA_PEDIDOS = 'PRES_Pedidos';
export const LISTA_LANCAMENTOS = 'PRES_Lancamentos';
export const LISTA_HISTORICO = 'PRES_Historico';
export const TODAS_AS_LISTAS: string[] = [LISTA_DADOS, LISTA_USUARIOS, LISTA_PEDIDOS, LISTA_LANCAMENTOS, LISTA_HISTORICO];

export const SITE_PADRAO = 'https://dpdhl.sharepoint.com/sites/projetoosasco';
export const ADMIN_PADRAO = 'adriano.diasjunior@dhl.com';
export const OPERACAO_PADRAO: IOperacao = { id: 'fisia', nome: 'FISIA' };

export interface IOperacao {
  id: string;
  nome: string;
  /** código do HUB/conta (opcional), exibido como "FISIA | 2" */
  codigo?: string;
  /** logo da operação (imagem reduzida, em data URL), enviado pelo administrador */
  logo?: string;
}

/** Colaborador do headcount. */
export interface IColab {
  /** usuário (login) */
  u: string;
  /** matrícula */
  m: string;
  /** nome */
  n: string;
  /** gestor */
  g: string;
  /** cargo / função */
  c: string;
  /** área */
  a: string;
  /** turno */
  t: Turno;
}

export interface IHeadcount {
  rows: IColab[];
  em?: string;
  por?: string;
  arq?: string;
}

export interface IParametros {
  h: Record<Turno, number>;
  meta: number;
  /**
   * folha ponto do mês: do dia fpDe do mês anterior ao dia fpAte do mês do cálculo
   * (padrão 13 e 12: outubro = 13/09 a 12/10)
   */
  fpDe?: number;
  fpAte?: number;
  /**
   * calendário único da operação: dia → turno → conta. Cada mês usa os dias marcados dentro da folha ponto dele.
   * Sem dias marcados na folha, o mês não tem horas previstas.
   */
  dias?: Record<string, Partial<Record<Turno, boolean>>>;
  /** formato anterior (dias por mês de cálculo); lido só para juntar no calendário único */
  cal?: Record<string, Record<string, Partial<Record<Turno, boolean>>>>;
}

export const PARAMETROS_PADRAO: IParametros = { h: { ADM: 8.75, PRIMEIRO: 8, SEGUNDO: 8 }, meta: 98 };

export interface IGestorAbs {
  nome?: string;
  ldap?: string;
}

/** Cadastro complementar usado no relatório "Histórico ABS". */
export interface IAbs {
  contract: string;
  setor: Record<string, string>;
  funcao: Record<string, string>;
  gest: Record<string, IGestorAbs>;
}

export const ABS_PADRAO: IAbs = { contract: 'DHL', setor: {}, funcao: {}, gest: {} };

export interface IUsuario {
  /** id do item na lista */
  id: number;
  email: string;
  nome: string;
  perfil: Perfil;
  /** perfil "acesso": operações liberadas além das do headcount */
  ops: string[];
}

/** Coordenador criado pelo headcount: um por gestor e operação (documento cfg/gestores). */
export interface IGestor {
  op: string;
  /** nome do gestor como está na planilha */
  g: string;
  /** e-mail vinculado (buscado no diretório no upload ou informado pelo administrador) */
  email: string;
  /** nome de exibição no diretório */
  nome?: string;
  /** colaboradores na equipe */
  n: number;
}

export interface IGestores {
  list: IGestor[];
  em?: string;
}

/** "op:<id>" = coordenador pedindo para ver outra operação. */
export type TipoPedido = string;

export interface IPedido {
  id: number;
  email: string;
  nome: string;
  em: string;
  tipo: TipoPedido;
}

export const pedidoOp = (tipo: string): string => (tipo.indexOf('op:') === 0 ? tipo.slice(3) : '');

export interface ILancEntrada {
  p: boolean;
  m?: string;
  o?: string;
  em?: string;
}

export interface ILancamento {
  id: string;
  op: string;
  d: string;
  g: string;
  e: Record<string, ILancEntrada>;
  por: string;
  em: string;
}

export interface IHistorico {
  a: string;
  k: string;
  por: string;
  op: string;
  em: string;
}

export interface IPerfilSp {
  nome: string;
  email: string;
  cargo: string;
  departamento: string;
  escritorio: string;
  telefone: string;
  celular: string;
  temFoto: boolean;
  gestorConta: string;
}

export function iniciais(nome: string): string {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const a = partes[0].charAt(0);
  const b = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (a + b).toUpperCase();
}

export function nomeCurto(nome: string): string {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : partes.join(' ');
}
