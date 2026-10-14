import type { IGestor, IUsuario } from '../models';
import { nomeCombina, unicos } from './util';

/** Quem é o usuário no portal e o que ele pode ver. */
export interface IAcesso {
  /** administrador principal (propriedade do web part) */
  principal: boolean;
  /** administrador: o principal ou proprietário do site do SharePoint */
  admin: boolean;
  /** coordenador: aparece como GESTOR no headcount de alguma operação */
  coordenador: boolean;
  /** equipes (gestor + operação) do usuário no headcount */
  vinculos: IGestor[];
  /** vínculo feito pelo nome de exibição (o gestor ainda não tem e-mail no cadastro) */
  peloNome: boolean;
  /** operações do headcount + liberadas por um administrador; undefined = todas */
  ops: string[] | undefined;
  /** operações liberadas além das do headcount */
  extras: string[];
  /** cadastro de liberação extra (perfil "acesso"), se houver */
  liberacao?: IUsuario;
}

/**
 * Regras:
 * - todos veem os indicadores;
 * - coordenador (gestor no headcount) fica preso às operações em que aparece; outras só com acesso liberado;
 * - administrador vê e faz tudo.
 */
export function calcularAcesso(
  email: string,
  nome: string,
  adminPrincipal: string,
  donoDoSite: boolean,
  usuarios: IUsuario[],
  gestores: IGestor[]
): IAcesso {
  const principal = !!email && email === adminPrincipal;
  const meus = usuarios.filter((u) => u.email === email);
  const admin = principal || donoDoSite;
  const liberacao = meus.filter((u) => u.perfil === 'acesso')[0];
  const extras = liberacao ? liberacao.ops : [];

  let vinculos = email ? gestores.filter((g) => g.email === email) : [];
  let peloNome = false;
  if (!vinculos.length && nome) {
    vinculos = gestores.filter((g) => !g.email && nomeCombina(g.g, nome));
    peloNome = vinculos.length > 0;
  }
  const coordenador = vinculos.length > 0;
  const ops = admin || !coordenador ? undefined : unicos([...vinculos.map((v) => v.op), ...extras]);
  return { principal, admin, coordenador, vinculos, peloNome, ops, extras, liberacao };
}
