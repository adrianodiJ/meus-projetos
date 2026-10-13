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
- Horas por dia: ADM 8,75; PRIMEIRO 8; SEGUNDO 8. Domingo não conta; sábado não conta para ADM.
- A falta conta no dia da falta. Período = mês-calendário. Semana começa no domingo (WEEKNUM).
- Headcount vem de Excel (aba TT ATIVOS: USER, MATRICULA, STATUS, GESTOR, NOME, SOBRENOME, CARGO, AREA, TURNO).
- Relatório "Histórico ABS" segue o layout do ABS+ (colunas ABS_ID, RE, NOME, FUNÇÃO, GESTOR_LDAP, GESTOR_NAME,
  MOTIVO, TURNO, SETOR, CONTRACT, LAUNCHED_BY_PROP, ABS_DATE, LAUNCH_DATE; todas as células em texto).

## Acessos
- Perfis: coordenador, supervisor, gerente, admin.
  - Coordenador: uma operação e UM gestor (a própria equipe); um gestor não pode ter dois coordenadores.
  - Supervisor: várias equipes. Gerente e admin: todas (sem escolher equipe).
- Cada usuário tem operações liberadas e permissões (painel, acomp, top, exp, lanc, grav; padrão liberado).
- O administrador principal vem da propriedade do web part (padrão adriano.diasjunior@dhl.com).
- O filtro por equipe/operação é feito na tela; a segurança real é a das permissões das listas do SharePoint.

## Dados (listas do SharePoint, criadas pela tela Administração)
`PRES_Dados` (JSON em partes: hc/<op>, cfg/params_<op>, cfg/abs_<op>, cfg/ops), `PRES_Usuarios`,
`PRES_Pedidos`, `PRES_Lancamentos` (um item por operação+dia+gestor), `PRES_Historico`.

## Estrutura
`src/webparts/presenteismoPortal/` → `components/` (telas), `services/` (REST do SharePoint),
`lib/` (cálculo, xlsx, relatórios), `models.ts` (tipos e constantes).
