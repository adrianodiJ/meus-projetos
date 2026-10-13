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
| Headcount (admin) | Importa a planilha .xlsx (aba TT ATIVOS), prévia de quem entra/sai, span of control, cadastro |
| Administração (admin) | Cria as listas, pedidos de acesso, usuários/perfis/equipes/permissões, operações, parâmetros, cadastro ABS, histórico |

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
5. Em **Headcount**, importe a planilha. Em **Administração**, aprove os pedidos de acesso e vincule as equipes.

## Acessos

- O administrador principal (propriedade do web part) é sempre Administrador.
- Quem abrir sem cadastro vê a tela "Solicitar acesso"; o pedido cai em **Administração → Pedidos de acesso**.
- Perfis: coordenador/supervisor veem só as equipes marcadas; gerente e administrador veem todas.
- `PRES_Dados` e `PRES_Usuarios` ficam somente leitura para os membros do site (só proprietários gravam);
  por isso o administrador precisa ser proprietário do site. Lançar presença exige ser Membro (editar itens).

## Estrutura

```
src/webparts/presenteismoPortal/
  PresenteismoPortalWebPart.ts      # web part + painel de propriedades
  models.ts                         # tipos e constantes
  components/                       # shell + telas (Home, Painel, Lancamento, Acompanhamento, ...)
  services/                         # SharePoint REST (listas, dados JSON, usuários, lançamentos, histórico)
  lib/                              # cálculo, leitor/gerador de .xlsx, relatórios
```
