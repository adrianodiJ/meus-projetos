import * as React from 'react';
import { Icon, Modal } from '@fluentui/react';
import styles from './Operacoes.module.scss';
import { int } from '../lib/util';
import type { IOperacao } from '../models';

const CORES = ['#d40511', '#1f6fd1', '#1e9e3e', '#7c3aed', '#f28c00', '#0f766e', '#4b5563', '#be185d'];

/** Iniciais e cor fixa (pelo nome) para a operação que ainda não tem logo. */
function monograma(nome: string): { texto: string; cor: string } {
  const partes = nome.trim().split(/[\s\-_/]+/).filter(Boolean);
  const texto = (partes.length > 1 ? partes[0][0] + partes[1][0] : nome.slice(0, 2)).toUpperCase();
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return { texto, cor: CORES[h % CORES.length] };
}

export const rotuloOperacao = (o: IOperacao): string => (o.codigo ? `${o.nome} | ${o.codigo}` : o.nome);

export const LogoOperacao: React.FC<{ op: IOperacao; className?: string }> = ({ op, className }) => {
  if (op.logo) return <img src={op.logo} alt={op.nome} />;
  const m = monograma(op.nome);
  return (
    <span className={className || styles.monograma} style={{ background: m.cor }}>
      {m.texto}
    </span>
  );
};

interface IChipProps {
  atual: IOperacao;
  colaboradores: number;
  onAbrir: () => void;
}

/** Chip da barra superior: operação atual e quantos colaboradores; abre a janela de troca. */
export const ChipOperacao: React.FC<IChipProps> = ({ atual, colaboradores, onAbrir }) => (
  <button type="button" className={styles.chip} onClick={onAbrir} title="Alterar a operação exibida no portal" aria-haspopup="dialog">
    <span className={styles.chipLogo}>{atual.logo ? <img src={atual.logo} alt="" /> : <Icon iconName="CityNext" />}</span>
    <span className={styles.chipTexto}>
      <small>Operação</small>
      <b>
        {atual.nome}
        <Icon iconName="ChevronDown" />
      </b>
    </span>
    <span className={styles.chipInfo}>
      <b>{int(colaboradores)}</b>
      <small>colaboradores</small>
    </span>
  </button>
);

interface IJanelaProps {
  operacoes: IOperacao[];
  atual: string;
  liberada: (id: string) => boolean;
  colaboradores: (id: string) => number | undefined;
  onTrocar: (id: string) => void;
  /** operação bloqueada: leva para "Meu acesso" para pedir */
  onPedirAcesso: () => void;
  onFechar: () => void;
}

/** Janela "Alterar operação": cartões com logo, nome e colaboradores de cada operação. */
export const JanelaOperacao: React.FC<IJanelaProps> = ({ operacoes, atual, liberada, colaboradores, onTrocar, onPedirAcesso, onFechar }) => {
  const [escolhida, setEscolhida] = React.useState('');
  const confirmar = (id: string): void => {
    if (!id || id === atual) return;
    onTrocar(id);
    onFechar();
  };
  const bloqueadas = operacoes.filter((o) => !liberada(o.id)).length;

  return (
    <Modal isOpen onDismiss={onFechar} containerClassName={styles.janela}>
      <div className={styles.topo}>
        <h2>Alterar operação</h2>
        <button type="button" className={styles.confirmar} disabled={!escolhida || escolhida === atual} onClick={() => confirmar(escolhida)}>
          <Icon iconName="Switch" /> Alterar operação
        </button>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={onFechar}>
          <Icon iconName="Cancel" />
        </button>
      </div>
      <div className={styles.corpo}>
        <p className={styles.dica}>
          Escolha a operação e clique em <b>Alterar operação</b> (ou dê dois cliques no cartão). Headcount, lançamentos e indicadores passam a ser dela.
          {bloqueadas > 0 ? ' As operações com cadeado precisam de acesso: clique nelas para pedir.' : ''}
        </p>
        <div className={styles.grade}>
          {operacoes.map((o) => {
            const ehAtual = o.id === atual;
            const livre = liberada(o.id);
            const n = colaboradores(o.id);
            const marcada = escolhida === o.id && !ehAtual;
            return (
              <button
                key={o.id}
                type="button"
                className={`${styles.cartao} ${ehAtual ? styles.cartaoAtual : ''} ${marcada ? styles.cartaoEscolhido : ''} ${livre ? '' : styles.cartaoBloqueado}`}
                aria-pressed={marcada}
                aria-current={ehAtual ? 'true' : undefined}
                title={ehAtual ? 'Operação atual' : livre ? `Escolher ${o.nome}` : `Sem acesso a ${o.nome}: clique para pedir`}
                onClick={() => {
                  if (ehAtual) return;
                  if (!livre) {
                    onFechar();
                    onPedirAcesso();
                    return;
                  }
                  setEscolhida(o.id);
                }}
                onDoubleClick={() => livre && confirmar(o.id)}
              >
                {ehAtual && <span className={styles.selo}>ATUAL</span>}
                {marcada && <span className={`${styles.selo} ${styles.seloEscolhido}`}>ESCOLHIDA</span>}
                {!livre && (
                  <span className={`${styles.selo} ${styles.seloBloqueado}`}>
                    <Icon iconName="Lock" /> SEM ACESSO
                  </span>
                )}
                <span className={styles.logo}>
                  <LogoOperacao op={o} />
                </span>
                <span className={styles.nome}>{rotuloOperacao(o)}</span>
                {n !== undefined && (
                  <span className={styles.qtd}>
                    {int(n)} colaborador{n === 1 ? '' : 'es'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
