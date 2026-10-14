# Presenteísmo Portal (SPFx 1.21.1)

Web part do SharePoint Online com o visual do Quality Request Portal (barra amarela DHL, menu escuro,
banner, cartões de indicadores e tabelas) e as funcionalidades da demo de Presenteísmo:

| Tela | O que faz |
| --- | --- |
| Home | Banner, indicadores do mês, atalhos e últimos lançamentos |
| Painel Presenteísmo | Anel do mês, horas previstas x falta, evolução semanal, visão por turno, por gestor e Top 10 ofensores |
| Lançamento | Lista de presença por data/gestor/turno (Sim/Não, motivo, observação), lançamento retroativo |
| Acompanhamento | Quem já lançou na data (completo/pendente), clique no gestor abre a lista dele |
| Relatórios | Excel "Histórico ABS" e "Resumo + Lançamentos" |
| Meu acesso | Perfil do usuário (visitante, coordenador, administrador) e pedidos de acesso |
| Headcount (admin) | Importa a planilha .xlsx (aba TT ATIVOS), substitui a base, cria/atualiza os coordenadores, span of control |
| Usuários e acessos (admin) | Coordenadores vindos do headcount (vínculo de e-mail), pedidos de acesso, administradores, operações liberadas |
| Administração (admin) | Cria as listas, operações, parâmetros, cadastro ABS, histórico |

## Gerar o .sppkg

Requer **Node 22.14+** (22.x) e npm.

```bash
npm install
npm run pacote
```

O pacote sai em `sharepoint/solution/presenteismo-portal.sppkg`
(`npm run pacote` = `gulp clean && gulp bundle --ship && gulp package-solution --ship`).

## Publicar

1. Catálogo de aplicativos (App Catalog) do tenant ou do site: **Enviar** o `.sppkg` e **Implantar**.
2. Adicione o app ao site e crie uma página (ou uma página de aplicativo de página inteira) com o web part **Presenteísmo Portal**.
3. Nas propriedades do web part, confira **E-mail do administrador principal** (precisa ser proprietário do site)
   e, se as listas ficarem em outro site, o **Site das listas**.
4. Abra o portal como administrador → **Administração → Criar listas e colunas** (uma vez).
   Cria `PRES_Dados`, `PRES_Usuarios`, `PRES_Pedidos`, `PRES_Lancamentos` e `PRES_Historico`.
5. Em **Headcount**, importe a planilha: os gestores viram coordenadores. Em **Usuários e acessos**, confira os e-mails que não foram achados no diretório.

> Atualizando de uma versão anterior: rode **Administração → Conferir listas e colunas** uma vez (cria a coluna `Tipo` em `PRES_Pedidos`).

## Acessos

- **Todos** que abrem o portal veem os indicadores (Home, Painel, Acompanhamento). Não há mais cadastro manual de coordenador, supervisor ou gerente.
- **Coordenadores vêm do headcount**: a cada upload, cada GESTOR da planilha vira coordenador da própria equipe. O arquivo novo
  substitui a base inteira (quem sai deixa de ser coordenador, mudanças de gestor passam a valer). O e-mail é buscado no diretório
  pelo nome; se não for achado, a pessoa é reconhecida pelo nome de exibição ao abrir o portal, e o administrador pode informar o e-mail.
- O coordenador lança a presença só da própria equipe, exporta relatórios e **só vê as operações em que aparece no headcount**.
  Para ver outra operação ele pede em **Meu acesso**, e um administrador libera.
- **Administradores** têm os mesmos acessos do administrador principal (propriedade do web part). Qualquer pessoa pode pedir em
  **Meu acesso**, mas **só o administrador principal aprova** (ou adiciona direto em Usuários e acessos).
- `PRES_Dados` e `PRES_Usuarios` ficam somente leitura para os membros do site: administradores precisam ser proprietários do site.
  Lançar presença e pedir acesso exige ser Membro. O filtro é feito na tela; a segurança real é a das permissões do SharePoint.

## Estrutura

```
src/webparts/presenteismoPortal/
  PresenteismoPortalWebPart.ts      # web part + painel de propriedades
  models.ts                         # tipos e constantes
  components/                       # shell + telas (Home, Painel, Lancamento, Acompanhamento, ...)
  services/                         # SharePoint REST (listas, dados JSON, usuários, lançamentos, histórico)
  lib/                              # cálculo, leitor/gerador de .xlsx, relatórios
```
