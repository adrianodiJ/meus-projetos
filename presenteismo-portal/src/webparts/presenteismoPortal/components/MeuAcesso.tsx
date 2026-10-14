import * as React from 'react';
import { Icon } from '@fluentui/react';
import styles from './QualityPortal.module.scss';
import { int } from '../lib/util';
import { type IPedido, pedidoOp } from '../models';
import type { IDados } from './tipos';
import { Avatar, Cartao, Pagina } from './ui';

interface IProps {
  d: IDados;
  /** pedidos do próprio usuário (inclusive os já atendidos) */
  meusPedidos: IPedido[];
}

/** Perfil do usuário no portal e pedido de acesso a outra operação. */
export const MeuAcesso: React.FC<IProps> = ({ d, meusPedidos }) => {
  const a = d.acesso;
  const [opPedida, setOpPedida] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);

  const pedir = async (tipo: string, ok: string): Promise<void> => {
    setEnviando(true);
    await d.gravar(async () => {
      await d.servicos.acessos.pedirAcesso(d.email, d.nome, tipo);
      d.registrar('pediu acesso', `operação ${d.opNome(pedidoOp(tipo))}`);
    }, ok);
    setEnviando(false);
    setOpPedida('');
  };

  const abertos = meusPedidos.filter((p) => d.pedidos.some((x) => x.id === p.id));
  const opsPedidas = abertos.map((p) => pedidoOp(p.tipo)).filter(Boolean);
  const opsFora = d.operacoes.filter((o) => !d.podeOperacao(o.id) && opsPedidas.indexOf(o.id) < 0);

  const perfil = a.admin ? 'Administrador' : a.coordenador ? 'Coordenador' : 'Visitante';
  const explicacao = a.admin
    ? 'Você vê e administra todas as operações: headcount, usuários, parâmetros e lançamentos de todas as equipes.'
    : a.coordenador
      ? 'Você vê os indicadores das suas operações e lança a presença da sua equipe. Para ver outra operação é preciso pedir acesso.'
      : 'Você vê os indicadores de todas as operações. Quem é gestor no headcount vira coordenador automaticamente e lança a presença da própria equipe.';
  const nota = 'Administradores são os proprietários do site do SharePoint: o acesso é dado no próprio site.';

  return (
    <Pagina titulo="Meu acesso" subtitulo="Seu perfil no portal e pedidos de acesso">
      <Cartao titulo="Seu perfil">
        <div className={styles.pessoa} style={{ marginBottom: 12 }}>
          <Avatar nome={d.nome} tamanho={44} />
          <div>
            <b>{d.nome}</b>
            <div className={styles.mudo}>{d.email}</div>
          </div>
          <span className={styles.selo} style={{ marginLeft: 'auto' }}>
            {perfil.toUpperCase()}
          </span>
        </div>
        <p className={styles.mudo} style={{ margin: '0 0 12px' }}>
          {explicacao} {nota}
        </p>
        {a.coordenador && (
          <>
            <div className={styles.tabelaRolagem}>
              <table className={styles.tabelaEsq}>
                <thead>
                  <tr>
                    <th>Operação</th>
                    <th>Gestor no headcount</th>
                    <th className={styles.num}>Colaboradores</th>
                  </tr>
                </thead>
                <tbody>
                  {a.vinculos.map((v) => (
                    <tr key={`${v.op}|${v.g}`}>
                      <td>{d.opNome(v.op)}</td>
                      <td>{v.g}</td>
                      <td className={styles.num}>{int(v.n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {a.peloNome && (
              <p className={styles.mudo} style={{ margin: '10px 0 0' }}>
                Vínculo feito pelo seu nome. Se não for você, avise o administrador para corrigir o e-mail em Usuários e acessos.
              </p>
            )}
            <p className={styles.mudo} style={{ margin: '10px 0 0' }}>
              Operações liberadas: {(a.ops || []).map((o) => d.opNome(o)).join(', ')}.
            </p>
          </>
        )}
      </Cartao>

      {a.coordenador && !a.admin && (
        <Cartao titulo="Ver outra operação">
          {opsFora.length ? (
            <div className={styles.fileira}>
              <label className={styles.campo}>
                Operação
                <select value={opPedida} onChange={(e) => setOpPedida(e.target.value)}>
                  <option value="">Escolha…</option>
                  {opsFora.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={styles.botaoAmarelo}
                disabled={!opPedida || enviando}
                onClick={() => pedir(`op:${opPedida}`, 'Pedido enviado. Um administrador vai analisar.').catch(() => undefined)}
              >
                <Icon iconName="Unlock" /> Pedir acesso
              </button>
            </div>
          ) : (
            <p className={styles.mudo} style={{ margin: 0 }}>
              Não há outras operações para pedir.
            </p>
          )}
          {opsPedidas.length > 0 && (
            <p className={styles.mudo} style={{ margin: '10px 0 0' }}>
              Aguardando aprovação: {opsPedidas.map((o) => d.opNome(o)).join(', ')}.
            </p>
          )}
        </Cartao>
      )}

    </Pagina>
  );
};
