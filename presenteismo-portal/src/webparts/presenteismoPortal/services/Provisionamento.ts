import { LISTA_DADOS, LISTA_HISTORICO, LISTA_LANCAMENTOS, LISTA_PEDIDOS, LISTA_USUARIOS } from '../models';
import { aspas, type SpClient, type SpError } from './SpClient';

interface ICampoSp {
  InternalName: string;
}

interface ICampoSpec {
  nome: string;
  titulo: string;
  xml: string;
}

interface IListaSpec {
  titulo: string;
  descricao: string;
  campos: ICampoSpec[];
  /** membros do site só leem (apenas proprietários editam) */
  somenteLeitura: boolean;
}

// SPAddFieldOptions: AddFieldInternalNameHint (8) usa o Name do XML como nome interno; AddFieldToDefaultView (16).
const OPCOES_CAMPO = 8 | 16;

const texto = (nome: string, titulo: string, indexado: boolean = false): ICampoSpec => ({
  nome,
  titulo,
  xml: `<Field Type="Text" DisplayName="${titulo}" Name="${nome}" StaticName="${nome}" MaxLength="255"${indexado ? ' Indexed="TRUE"' : ''} />`
});
const nota = (nome: string, titulo: string): ICampoSpec => ({
  nome,
  titulo,
  xml: `<Field Type="Note" DisplayName="${titulo}" Name="${nome}" StaticName="${nome}" NumLines="6" RichText="FALSE" />`
});
const numero = (nome: string, titulo: string, indexado: boolean = false): ICampoSpec => ({
  nome,
  titulo,
  xml: `<Field Type="Number" DisplayName="${titulo}" Name="${nome}" StaticName="${nome}" Decimals="0"${indexado ? ' Indexed="TRUE"' : ''} />`
});

const LISTAS: IListaSpec[] = [
  {
    titulo: LISTA_DADOS,
    descricao: 'Presenteísmo — documentos do portal (headcount, parâmetros, cadastro ABS e operações). Gerenciada pelo portal.',
    somenteLeitura: true,
    campos: [numero('Parte', 'Parte'), nota('Json', 'Json')]
  },
  {
    titulo: LISTA_USUARIOS,
    descricao: 'Presenteísmo — usuários, perfis, equipes e permissões (gerenciada pelo administrador no portal).',
    somenteLeitura: true,
    campos: [
      texto('Nome', 'Nome'),
      texto('Perfil', 'Perfil'),
      texto('Status', 'Status'),
      nota('Operacoes', 'Operações'),
      nota('Permissoes', 'Permissões'),
      nota('Gestores', 'Gestores')
    ]
  },
  {
    titulo: LISTA_PEDIDOS,
    descricao: 'Presenteísmo — pedidos de acesso feitos pelos próprios usuários.',
    somenteLeitura: false,
    campos: [texto('Nome', 'Nome'), texto('Em', 'Em')]
  },
  {
    titulo: LISTA_LANCAMENTOS,
    descricao: 'Presenteísmo — lançamentos diários de presença (um item por operação, dia e gestor).',
    somenteLeitura: false,
    campos: [
      texto('Operacao', 'Operação', true),
      numero('DataNum', 'Data (aaaammdd)', true),
      texto('Data', 'Data'),
      texto('Gestor', 'Gestor'),
      nota('Dados', 'Dados'),
      texto('Por', 'Lançado por'),
      texto('Em', 'Lançado em')
    ]
  },
  {
    titulo: LISTA_HISTORICO,
    descricao: 'Presenteísmo — histórico de ações para auditoria.',
    somenteLeitura: false,
    campos: [texto('Detalhe', 'Detalhe'), texto('Por', 'Por'), texto('Operacao', 'Operação'), texto('Em', 'Em')]
  }
];

/**
 * Cria as listas e as colunas que faltam (idempotente). Exige permissão de gerenciar o site.
 * Nas listas "somente leitura" os membros do site passam a só ler (ninguém se promove pelo SharePoint).
 */
export async function provisionarListas(sp: SpClient, progresso?: (texto: string) => void): Promise<string[]> {
  const log: string[] = [];
  for (const spec of LISTAS) {
    const base = `web/lists/getbytitle('${aspas(spec.titulo)}')`;
    let existe = true;
    try {
      await sp.get(`${base}?$select=Id`);
    } catch (e) {
      if ((e as SpError).status !== 404) throw e;
      existe = false;
    }
    if (!existe) {
      progresso?.(`Criando a lista ${spec.titulo}…`);
      await sp.post('web/lists', { Title: spec.titulo, Description: spec.descricao, BaseTemplate: 100, AllowContentTypes: false, ContentTypesEnabled: false });
      log.push(`Lista criada: ${spec.titulo}`);
    }
    const campos = await sp.getAll<ICampoSp>(`${base}/fields?$select=InternalName&$top=500`);
    for (const c of spec.campos) {
      if (campos.some((x) => x.InternalName === c.nome)) continue;
      progresso?.(`Criando a coluna ${c.titulo} em ${spec.titulo}…`);
      await sp.post(`${base}/fields/createfieldasxml`, { parameters: { SchemaXml: c.xml, Options: OPCOES_CAMPO } });
      log.push(`Coluna criada: ${spec.titulo} › ${c.titulo}`);
    }
    if (!existe && spec.somenteLeitura) {
      try {
        progresso?.(`Restringindo a edição de ${spec.titulo}…`);
        await sp.post(`${base}/breakroleinheritance(copyRoleAssignments=true,clearSubscopes=true)`);
        const [membros, leitura] = await Promise.all([
          sp.get<{ Id: number }>('web/AssociatedMemberGroup?$select=Id'),
          sp.get<{ Id: number }>('web/RoleDefinitions/GetByType(2)?$select=Id')
        ]);
        await sp.post<void>(`${base}/roleassignments/getbyprincipalid(${membros.Id})`, undefined, { metodo: 'DELETE' });
        await sp.post(`${base}/roleassignments/addroleassignment(principalid=${membros.Id},roledefid=${leitura.Id})`);
        log.push(`Permissões de ${spec.titulo}: membros do site só leem (proprietários editam).`);
      } catch (e) {
        log.push(`Não foi possível restringir ${spec.titulo} (${(e as Error).message}). Ajuste manualmente: membros com Leitura.`);
      }
    }
  }
  return log;
}
