import type { IColab, Turno } from '../models';

/** Normaliza: sem acento, maiúsculas, sem espaços nas pontas. */
export function nz(s: unknown): string {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

/** Chave estável a partir de um texto (ids de documentos e cadastros). */
export function chave(s: unknown): string {
  return nz(s).toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export const p2 = (n: number): string => String(n).padStart(2, '0');
export const iso = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const dt = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
/** "2026-10-09" -> "09/10" */
export const fmt = (d: string): string => `${d.slice(8)}/${d.slice(5, 7)}`;
export const dmy = (d: string): string => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const dataNum = (d: string): number => Number(d.replace(/-/g, ''));

/** Semana do ano no mesmo critério do painel original (semana começa no domingo). */
export function semana(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  const n = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5);
  const j = new Date(Date.UTC(y, 0, 1)).getUTCDay();
  return Math.floor((n + j) / 7) + 1;
}

export function dias(a: string, b: string): string[] {
  const o: string[] = [];
  for (const d = dt(a); iso(d) <= b; d.setDate(d.getDate() + 1)) o.push(iso(d));
  return o;
}

/** O dia conta no cálculo? Domingo nunca; sábado só fora do ADM. */
export function previsto(d: string, t: Turno): boolean {
  const w = dt(d).getDay();
  return !(w === 0 || (w === 6 && t === 'ADM'));
}

export const ehTemp = (r: IColab): boolean => /TEMP\s*$/i.test(String(r.a || '').trim());
// Números no padrão brasileiro: ponto nos milhares e vírgula nos decimais (3.000,50).
// Valor fechado não mostra casas decimais (3.000, não 3.000,00).
const FMT_DEC = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FMT_INT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
export const num = (v: number): string => (Math.round(v * 100) % 100 === 0 ? FMT_INT.format(v) : FMT_DEC.format(v));
export const fp = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${num(v)}%`);
/** Contagens inteiras com separador de milhar (1.250). */
export const int = (v: number): string => FMT_INT.format(v);
export const ordenarPt = (a: string, b: string): number => String(a).localeCompare(String(b), 'pt-BR');
export const unicos = <T>(a: T[]): T[] => Array.from(new Set(a));

export function dataHora(s: string | undefined, estilo: 'curto' | 'longo' = 'longo'): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return estilo === 'curto'
    ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function emailDhl(v: string): boolean {
  return /^[^\s@]+@([a-z0-9-]+\.)*dhl\.com$/i.test((v || '').trim());
}

/** Todas as palavras do nome da planilha aparecem no nome de exibição? ("CARLA BARZANI" × "Barzani, Carla (DHL)") */
export function nomeCombina(nomePlanilha: string, nomeExibicao: string): boolean {
  const palavras = (s: string): string[] => nz(s).replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter((x) => x.length > 1);
  const alvo = palavras(nomePlanilha);
  const tem = palavras(nomeExibicao);
  return alvo.length > 0 && alvo.every((p) => tem.indexOf(p) >= 0);
}
