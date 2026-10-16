import * as React from 'react';
import { Icon } from '@fluentui/react';
import styles from './QualityPortal.module.scss';
import { iniciais } from '../models';

export const Avatar: React.FC<{ nome: string; foto?: string; tamanho?: number }> = ({ nome, foto, tamanho = 36 }) => {
  const [falhou, setFalhou] = React.useState(false);
  React.useEffect(() => setFalhou(false), [foto]);
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38) };
  if (foto && !falhou) return <img className={styles.avatar} style={estilo} src={foto} alt="" onError={() => setFalhou(true)} />;
  return (
    <span className={styles.avatar} style={estilo}>
      {iniciais(nome)}
    </span>
  );
};

export const BotaoAtualizar: React.FC<{ atualizando: boolean; atualizadoEm?: Date; onClick: () => void }> = ({ atualizando, atualizadoEm, onClick }) => {
  const hora = atualizadoEm ? atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <button
      type="button"
      className={styles.btnAtualizar}
      disabled={atualizando}
      onClick={onClick}
      title={hora ? `Atualizar os dados (última atualização às ${hora})` : 'Atualizar os dados'}
      aria-label="Atualizar os dados"
    >
      <Icon iconName="Refresh" className={atualizando ? styles.girando : ''} />
      {atualizando ? 'Atualizando…' : 'Atualizar'}
    </button>
  );
};

export const Cartao: React.FC<{ titulo?: React.ReactNode; acao?: React.ReactNode; className?: string }> = ({ titulo, acao, className, children }) => (
  <section className={`${styles.cartao} ${className || ''}`}>
    {(titulo || acao) && (
      <div className={styles.cartaoTopo}>
        <h3>{titulo}</h3>
        {acao}
      </div>
    )}
    {children}
  </section>
);

/**
 * Indicador: ícone colorido em cima, número em destaque, legenda e uma linha de contexto.
 * Clicável (vira botão) só quando recebe onClick.
 */
export const Kpi: React.FC<{
  valor: string;
  legenda: string;
  icone: string;
  cor: string;
  detalhe?: string;
  detalheCor?: string;
  onClick?: () => void;
}> = ({ valor, legenda, icone, cor, detalhe, detalheCor, onClick }) => {
  const conteudo = (
    <>
      <span className={styles.kpiIcone} style={{ backgroundColor: cor }}>
        <Icon iconName={icone} />
      </span>
      <b className={styles.kpiValor}>{valor}</b>
      <span className={styles.kpiLegenda}>{legenda}</span>
      {detalhe && (
        <span className={styles.kpiDetalhe} style={detalheCor ? { color: detalheCor } : undefined}>
          {detalhe}
        </span>
      )}
    </>
  );
  return onClick ? (
    <button type="button" className={`${styles.kpi} ${styles.kpiClicavel}`} onClick={onClick}>
      {conteudo}
    </button>
  ) : (
    <div className={styles.kpi}>{conteudo}</div>
  );
};

export const Vazio: React.FC<{ icone?: string; titulo: string; texto?: string }> = ({ icone = 'SearchIssue', titulo, texto, children }) => (
  <div className={styles.vazio}>
    <Icon iconName={icone} />
    <h4>{titulo}</h4>
    {texto && <p>{texto}</p>}
    {children}
  </div>
);

export const Pagina: React.FC<{ titulo: string; subtitulo?: React.ReactNode; acoes?: React.ReactNode }> = ({ titulo, subtitulo, acoes, children }) => (
  <div className={styles.pagina}>
    <div className={styles.paginaTopo}>
      <div>
        <h2>{titulo}</h2>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {acoes}
    </div>
    {children}
  </div>
);

export const Paginacao: React.FC<{ total: number; porPagina: number; pagina: number; onPagina: (p: number) => void }> = ({ total, porPagina, pagina, onPagina }) => {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total <= porPagina) return <div className={styles.paginacao}>Mostrando {total} de {total} itens</div>;
  const ini = (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);
  const nums: number[] = [];
  for (let i = Math.max(1, pagina - 2); i <= Math.min(paginas, Math.max(5, pagina + 2)); i++) nums.push(i);
  return (
    <div className={styles.paginacao}>
      <span>
        Mostrando {ini}–{fim} de {total} itens
      </span>
      <div>
        <button type="button" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)} aria-label="Página anterior">
          <Icon iconName="ChevronLeft" />
        </button>
        {nums.map((n) => (
          <button key={n} type="button" className={n === pagina ? styles.paginaAtiva : ''} onClick={() => onPagina(n)}>
            {n}
          </button>
        ))}
        <button type="button" disabled={pagina >= paginas} onClick={() => onPagina(pagina + 1)} aria-label="Próxima página">
          <Icon iconName="ChevronRight" />
        </button>
      </div>
    </div>
  );
};

/** Estado vazio de uma tela inteira (sem headcount, sem equipe, sem permissão…). */
export const Aviso: React.FC<{ titulo: string; texto: string }> = ({ titulo, texto }) => (
  <div className={`${styles.cartao} ${styles.vazio2}`}>
    <h4>{titulo}</h4>
    <p>{texto}</p>
  </div>
);


const IlustracaoBanner: React.FC = () => (
  <svg className={styles.heroArte} viewBox="0 0 900 260" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="qrCeu" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1b1b1f" />
        <stop offset="0.45" stopColor="#3a2a1c" />
        <stop offset="0.8" stopColor="#c9701f" />
        <stop offset="1" stopColor="#f2b24a" />
      </linearGradient>
      <linearGradient id="qrFuselagem" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd84d" />
        <stop offset="1" stopColor="#e6ac00" />
      </linearGradient>
      <radialGradient id="qrSol" cx="0.82" cy="0.62" r="0.35">
        <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffe6a8" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="900" height="260" fill="url(#qrCeu)" />
    <rect width="900" height="260" fill="url(#qrSol)" />
    {/* pista */}
    <path d="M0 232 L900 214 L900 260 L0 260 Z" fill="#141416" opacity="0.85" />
    <path d="M120 246 L380 238 M460 236 L700 229 M760 227 L900 223" stroke="#f5c542" strokeWidth="3" strokeDasharray="26 22" opacity="0.6" />
    {/* asa traseira */}
    <path d="M520 150 L690 92 L720 96 L600 158 Z" fill="#c99400" />
    {/* fuselagem */}
    <path d="M300 168 C 300 140, 360 124, 470 122 L 800 118 C 860 117, 890 132, 890 148 C 890 164, 860 176, 800 176 L 470 180 C 360 182, 300 190, 300 168 Z" fill="url(#qrFuselagem)" />
    {/* faixa vermelha */}
    <path d="M330 160 L 870 150 L 868 160 L 330 172 Z" fill="#D40511" />
    {/* janelas */}
    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
      <rect key={i} x={480 + i * 30} y={132} width={12} height={9} rx={3} fill="#3b2d12" opacity="0.75" />
    ))}
    {/* cabine */}
    <path d="M840 128 C 860 130, 874 138, 880 146 L 846 146 Z" fill="#2c2410" opacity="0.85" />
    {/* cauda */}
    <path d="M300 168 L 250 70 L 290 70 L 380 140 Z" fill="#ffcc00" />
    <path d="M262 92 L 300 92 L 330 116 L 276 116 Z" fill="#D40511" />
    {/* asa frontal e motores */}
    <path d="M560 172 L 470 236 L 520 238 L 660 176 Z" fill="#e0a800" />
    <ellipse cx="548" cy="214" rx="36" ry="14" fill="#d9a300" />
    <ellipse cx="520" cy="214" rx="8" ry="12" fill="#2a2a2a" />
    {/* trem de pouso */}
    <path d="M760 176 L 760 214 M 520 182 L 520 200" stroke="#2a2a2a" strokeWidth="5" />
    <circle cx="760" cy="220" r="9" fill="#111" />
    <circle cx="512" cy="226" r="9" fill="#111" />
    <circle cx="534" cy="226" r="9" fill="#111" />
  </svg>
);

export const Hero: React.FC<{ imagem?: string; frase: string }> = ({ imagem, frase }) => (
  <section className={styles.hero}>
    {imagem ? <div className={styles.heroFoto} style={{ backgroundImage: `url("${imagem}")` }} /> : <IlustracaoBanner />}
    <div className={styles.heroSombra} />
    <div className={styles.heroTexto}>
      <small>Bem-vindo ao</small>
      <h1>TeamPulse</h1>
      <p>Lançamento diário de presença, acompanhamento das equipes e indicadores de presenteísmo por operação.</p>
      <em>“{frase}”</em>
    </div>
    <div className={styles.heroLema}>
      <span>
        People
        <br />
        connected
        <br />a better
        <br />
        tomorrow
      </span>
      <i />
    </div>
  </section>
);
