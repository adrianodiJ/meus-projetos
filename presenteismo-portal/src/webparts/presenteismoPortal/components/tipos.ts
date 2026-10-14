import type {
  IAbs,
  IColab,
  IGestor,
  IHeadcount,
  IHistorico,
  ILancamento,
  IOperacao,
  IParametros,
  IPedido,
  IUsuario
} from '../models';
import type { IAcesso } from '../lib/acesso';
import type { AcessosService } from '../services/AcessosService';
import type { DadosService } from '../services/DadosService';
import type { HistoricoService } from '../services/HistoricoService';
import type { LancamentosService } from '../services/LancamentosService';
import type { PerfilService } from '../services/PerfilService';
import type { SpClient } from '../services/SpClient';

export type Visao = 'home' | 'painel' | 'lancamento' | 'acompanhamento' | 'headcount' | 'relatorios' | 'acesso' | 'usuarios' | 'administracao';

export const VISOES: Visao[] = ['home', 'painel', 'lancamento', 'acompanhamento', 'headcount', 'relatorios', 'acesso', 'usuarios', 'administracao'];

export const MENU: { visao: Visao; texto: string; icone: string }[] = [
  { visao: 'home', texto: 'Home', icone: 'Home' },
  { visao: 'painel', texto: 'Painel Presenteísmo', icone: 'BarChartVertical' },
  { visao: 'lancamento', texto: 'Lançamento', icone: 'CheckList' },
  { visao: 'acompanhamento', texto: 'Acompanhamento', icone: 'BulletedList' },
  { visao: 'relatorios', texto: 'Relatórios', icone: 'ReportDocument' },
  { visao: 'headcount', texto: 'Headcount', icone: 'People' },
  { visao: 'acesso', texto: 'Meu acesso', icone: 'Contact' },
  { visao: 'usuarios', texto: 'Usuários e acessos', icone: 'AddFriend' },
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
  /** administradores e liberações extras (PRES_Usuarios) */
  usuarios: IUsuario[];
  pedidos: IPedido[];
  /** coordenadores criados pelo headcount, de todas as operações */
  gestores: IGestor[];
  hist: IHistorico[];
  /** lançamentos do mês selecionado no painel */
  lancMes: ILancamento[];
  /** lançamentos da data de referência da lista de presença */
  lancDia: ILancamento[];
  ym: string;
  ldate: string;

  email: string;
  nome: string;
  /** perfil do usuário: administrador, coordenador (pelo headcount) ou visitante */
  acesso: IAcesso;
  admin: boolean;
  /** lança para todas as equipes da operação (administrador) */
  completo: boolean;
  /** painel, acomp, top: todos; exp: coordenador ou administrador; lanc/grav: quem tem equipe na operação */
  pm: (permissao: string) => boolean;
  /** colaboradores da operação (indicadores: todos veem) */
  equipe: IColab[];
  /** colaboradores que o usuário lança (a própria equipe; todos para administrador) */
  minhaEquipe: IColab[];
  /** gestores (nomes da planilha) do usuário na operação atual */
  meusGestores: string[];
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
