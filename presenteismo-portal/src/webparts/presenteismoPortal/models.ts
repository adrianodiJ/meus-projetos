// Modelos e constantes do portal de Presenteísmo.

export type Turno = 'PRIMEIRO' | 'SEGUNDO' | 'ADM';
export type Perfil = 'coordenador' | 'supervisor' | 'gerente' | 'admin';
export type StatusUsuario = 'aprovado' | 'pendente' | 'bloqueado';

export const TURNOS: Turno[] = ['PRIMEIRO', 'SEGUNDO', 'ADM'];
export const ROTULO_TURNO: Record<string, string> = { PRIMEIRO: '1º turno', SEGUNDO: '2º turno', ADM: 'ADM', GERAL: 'Geral' };
export const PERFIS: Perfil[] = ['coordenador', 'supervisor', 'gerente', 'admin'];
export const STATUS_USUARIO: StatusUsuario[] = ['aprovado', 'pendente', 'bloqueado'];

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

/** Permissões de tela/ação por usuário (padrão: liberado, exceto se marcado como false). */
export const PERMISSOES: { chave: string; texto: string }[] = [
  { chave: 'painel', texto: 'Ver Painel Presenteísmo' },
  { chave: 'acomp', texto: 'Ver acompanhamento de gestores' },
  { chave: 'top', texto: 'Ver Top 10 ofensores' },
  { chave: 'exp', texto: 'Exportar relatórios em Excel' },
  { chave: 'lanc', texto: 'Ver aba Lançamento' },
  { chave: 'grav', texto: 'Gravar lançamentos' }
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
  /** id do item na lista (0 = usuário fixo do portal, sem item) */
  id: number;
  email: string;
  nome: string;
  perfil: Perfil;
  status: StatusUsuario;
  ops: string[];
  gestores: string[];
  perm: Record<string, boolean>;
}

export interface IPedido {
  id: number;
  email: string;
  nome: string;
  em: string;
}

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
