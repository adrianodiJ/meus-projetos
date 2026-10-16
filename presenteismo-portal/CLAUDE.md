# Presenteísmo Portal (SPFx 1.21.1) — contexto para o Claude Code

Web part do SharePoint Online (DHL / FISIA) para lançamento de presença e painel de presenteísmo.
Substitui planilhas Excel/VBA. Idioma da interface e dos comentários: português do Brasil.

## Comandos
- `npm ci` (Node 22.14+ e < 23)
- `npm run pacote` → gera `sharepoint/solution/presenteismo-portal.sppkg`
- `npm run serve` → workbench local (não tem as listas do SharePoint)

## Regras de negócio (não mudar sem pedir)
- Presenteísmo = 1 − (horas de falta ÷ horas previstas). Meta 98%.
- Só "Falta injustificada" e "Atestado" contam como falta. Os demais motivos (Férias, Sinergia, Treinamento,
  Abono chefia, Banco de horas, Desligado, Afastamento, Outros) ficam registrados e não entram no cálculo.
- Só efetivos entram no cálculo: área terminada em TEMP é temporário (aparece no Lançamento e nos relatórios).
- Horas por dia: ADM 8,75; PRIMEIRO 8; SEGUNDO 8. Total previsto = pessoas × horas do turno × dias que contam
  (como na planilha "Presenteísmo FÍSIA"); falta = (injustificadas + atestados) × horas do turno.
- Dias que contam (folha ponto, `lib/calendario.ts`): domingo nunca; ADM folga todos os sábados; PRIMEIRO e SEGUNDO
  folgam os 2 primeiros sábados do período (3 se o período tiver 5 sábados). O administrador marca/desmarca dias por
  turno no calendário do Painel (ajustes em `cfg/params_<op>.aj`).
- A falta conta no dia da falta, só se o dia conta para o turno. Período = mês-calendário por padrão; o dia de início
  é parâmetro (`cfg/params_<op>.ini`, ex.: 13 = de 13 a 12). Semana começa no domingo (WEEKNUM).
- Headcount vem de Excel (aba TT ATIVOS: USER, MATRICULA, STATUS, GESTOR, NOME, SOBRENOME, CARGO, AREA, TURNO).
- Relatório "Histórico ABS" segue o layout do ABS+ (colunas ABS_ID, RE, NOME, FUNÇÃO, GESTOR_LDAP, GESTOR_NAME,
  MOTIVO, TURNO, SETOR, CONTRACT, LAUNCHED_BY_PROP, ABS_DATE, LAUNCH_DATE; todas as células em texto).

## Acessos
- Todos veem os indicadores (Home, Painel, Acompanhamento). Não existe cadastro manual de coordenador/supervisor/gerente.
- Coordenadores vêm do headcount: cada GESTOR vira coordenador no upload (documento `cfg/gestores`, um item por gestor+operação,
  com e-mail buscado no diretório pelo nome; sem e-mail, o vínculo é pelo nome de exibição). O upload substitui a base inteira.
- Coordenador: lança só a própria equipe; vê só as operações em que é gestor + as liberadas (perfil `acesso` em PRES_Usuarios).
- Administrador = proprietário do site do SharePoint (permissão Gerenciar site, lida em web/effectiveBasePermissions)
  ou o administrador principal da propriedade do web part. Não há pedido/aprovação de administrador no portal.
- Pedidos (PRES_Pedidos, coluna Tipo): `op:<id>` (coordenador pedindo outra operação); qualquer administrador aprova.
- O filtro por operação/equipe é feito na tela; a segurança real é a das permissões das listas do SharePoint.

## Dados (listas do SharePoint, criadas pela tela Administração)
`PRES_Dados` (JSON em partes: hc/<op>, cfg/params_<op>, cfg/abs_<op>, cfg/ops, cfg/gestores), `PRES_Usuarios`,
`PRES_Pedidos`, `PRES_Lancamentos` (um item por operação+dia+gestor), `PRES_Historico`.

## Estrutura
`src/webparts/presenteismoPortal/` → `components/` (telas), `services/` (REST do SharePoint),
`lib/` (cálculo, xlsx, relatórios), `models.ts` (tipos e constantes).
