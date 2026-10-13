import type {
  IAbs,
  IColab,
  IHeadcount,
  IHistorico,
  ILancamento,
  IOperacao,
  IParametros,
  IPedido,
  IUsuario
} from '../models';
import type { AcessosService } from '../services/AcessosService';
import type { DadosService } from '../services/DadosService';
import type { HistoricoService } from '../services/HistoricoService';
import type { LancamentosService } from '../services/LancamentosService';
import type { PerfilService } from '../services/PerfilService';
import type { SpClient } from '../services/SpClient';

export type Visao = 'home' | 'painel' | 'lancamento' | 'acompanhamento' | 'headcount' | 'relatorios' | 'administracao';

export const VISOES: Visao[] = ['home', 'painel', 'lancamento', 'acompanhamento', 'headcount', 'relatorios', 'administracao'];

export const MENU: { visao: Visao; texto: string; icone: string }[] = [
  { visao: 'home', texto: 'Home', icone: 'Home' },
  { visao: 'painel', texto: 'Painel Presenteísmo', icone: 'BarChartVertical' },
  { visao: 'lancamento', texto: 'Lançamento', icone: 'CheckList' },
  { visao: 'acompanhamento', texto: 'Acompanhamento', icone: 'BulletedList' },
  { visao: 'relatorios', texto: 'Relatórios', icone: 'ReportDocument' },
  { visao: 'headcount', texto: 'Headcount', icone: 'People' },
  { visao: 'administracao', texto: 'Administração', icone: 'Settings' }
];

export interface IServicos {
  sp: SpClient;
  dados: DadosService;
  acessos: AcessosService;
  lancamentos: LancamentosService;
  historico: HistoricoService;
  perfil: PerfilService;
}

export interface IPortalProps {
  titulo: string;
  subtitulo: string;
  frase: string;
  imagemBanner: string;
  adminEmail: string;
  intervaloAtualizacao: number;
  usuario: { nome: string; email: string; login: string };
  servicos: IServicos;
  modoEdicao: boolean;
}

/** Tudo o que as telas precisam: dados carregados, o usuário efetivo e as ações. */
export interface IDados {
  op: string;
  operacoes: IOperacao[];
  hc: IHeadcount;
  params: IParametros;
  abs: IAbs;
  absExiste: boolean;
  usuarios: IUsuario[];
  pedidos: IPedido[];
  hist: IHistorico[];
  /** lançamentos do mês selecionado no painel */
  lancMes: ILancamento[];
  /** lançamentos da data de referência da lista de presença */
  lancDia: ILancamento[];
  ym: string;
  ldate: string;

  email: string;
  nome: string;
  /** usuário efetivo (administrador principal vira admin aprovado, mesmo sem cadastro) */
  eu: IUsuario;
  admin: boolean;
  /** vê todas as equipes (admin ou gerente) */
  completo: boolean;
  pm: (permissao: string) => boolean;
  /** colaboradores que o usuário pode ver (suas equipes; todas para admin/gerente) */
  equipe: IColab[];
  nomeDe: (email: string) => string;
  opNome: (id: string) => string;
  podeOperacao: (id: string) => boolean;

  setYm: (ym: string) => void;
  setLdate: (d: string) => void;
  setOp: (id: string) => void;
  recarregar: () => Promise<void>;
  atualizando: boolean;
  atualizadoEm?: Date;
  avisar: (tipo: 'ok' | 'erro' | 'info', texto: string) => void;
  registrar: (acao: string, detalhe: string) => void;
  /** executa uma gravação, avisa o resultado e recarrega os dados */
  gravar: (fn: () => Promise<void>, sucesso?: string) => Promise<boolean>;
  servicos: IServicos;
  irPara: (v: Visao) => void;
}
