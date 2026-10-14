import type { IColab, IGestor } from '../models';
import { chave } from '../lib/util';
import type { AcessosService } from './AcessosService';

/** Chave do documento (em PRES_Dados) com os coordenadores de todas as operações. */
export const DOC_GESTORES = 'cfg/gestores';

/**
 * Coordenadores de uma operação a partir do headcount novo: um por GESTOR da planilha.
 * O e-mail já vinculado ao mesmo gestor é mantido; para os novos, busca no diretório pelo nome.
 * Quem não está mais na planilha deixa de existir (a base antiga é descartada).
 */
export async function montarCoordenadores(
  acessos: AcessosService,
  op: string,
  rows: IColab[],
  atuais: IGestor[],
  progresso?: (texto: string) => void
): Promise<IGestor[]> {
  const contagem: Record<string, { g: string; n: number }> = {};
  rows.forEach((r) => {
    if (!r.g) return;
    const k = chave(r.g);
    const o = contagem[k] || (contagem[k] = { g: r.g, n: 0 });
    o.n++;
  });
  const mesmaOp: Record<string, IGestor> = {};
  const outraOp: Record<string, IGestor> = {};
  atuais.forEach((x) => {
    const k = chave(x.g);
    if (x.op === op) mesmaOp[k] = x;
    else if (x.email && !outraOp[k]) outraOp[k] = x;
  });

  const novos: IGestor[] = [];
  const chaves = Object.keys(contagem);
  for (let i = 0; i < chaves.length; i++) {
    const k = chaves[i];
    const { g, n } = contagem[k];
    const antes = mesmaOp[k] && mesmaOp[k].email ? mesmaOp[k] : outraOp[k];
    if (antes) {
      novos.push({ op, g, n, email: antes.email, nome: antes.nome });
      continue;
    }
    progresso?.(`Buscando ${g} no diretório (${i + 1}/${chaves.length})…`);
    const achado = await acessos.buscarPorNome(g);
    novos.push({ op, g, n, email: achado ? achado.email : '', nome: achado ? achado.nome : '' });
  }
  return novos;
}

/** Troca os coordenadores da operação, mantendo os das outras. */
export const substituirOperacao = (todos: IGestor[], op: string, daOperacao: IGestor[]): IGestor[] => [...todos.filter((x) => x.op !== op), ...daOperacao];
