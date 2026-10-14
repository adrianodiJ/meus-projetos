// Leitor mínimo de .xlsx (OOXML dentro de ZIP) sem dependências externas.
// Usa DecompressionStream('deflate-raw') do navegador (Edge, Chrome e Safari atuais).

export interface IPlanilhaLida {
  nome: string;
  /** linhas como objetos: cabeçalho (1ª linha) -> valor em texto */
  linhas: Record<string, string>[];
  cabecalho: string[];
}

interface IEntradaZip {
  nome: string;
  metodo: number;
  tamanhoComprimido: number;
  deslocamento: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const DecompressionStream: any;

function u16(v: DataView, o: number): number {
  return v.getUint16(o, true);
}
function u32(v: DataView, o: number): number {
  return v.getUint32(o, true);
}

function entradas(buf: ArrayBuffer): IEntradaZip[] {
  const v = new DataView(buf);
  let fim = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (u32(v, i) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error('Arquivo inválido: não é um .xlsx.');
  const total = u16(v, fim + 10);
  let o = u32(v, fim + 16);
  const lista: IEntradaZip[] = [];
  const dec = new TextDecoder('utf-8');
  for (let i = 0; i < total; i++) {
    if (u32(v, o) !== 0x02014b50) break;
    const metodo = u16(v, o + 10);
    const comp = u32(v, o + 20);
    const nomeLen = u16(v, o + 28);
    const extraLen = u16(v, o + 30);
    const comLen = u16(v, o + 32);
    const desloc = u32(v, o + 42);
    const nome = dec.decode(new Uint8Array(buf, o + 46, nomeLen));
    lista.push({ nome, metodo, tamanhoComprimido: comp, deslocamento: desloc });
    o += 46 + nomeLen + extraLen + comLen;
  }
  return lista;
}

async function extrair(buf: ArrayBuffer, e: IEntradaZip): Promise<string> {
  const v = new DataView(buf);
  const nomeLen = u16(v, e.deslocamento + 26);
  const extraLen = u16(v, e.deslocamento + 28);
  const ini = e.deslocamento + 30 + nomeLen + extraLen;
  const bytes = new Uint8Array(buf, ini, e.tamanhoComprimido);
  if (e.metodo === 0) return new TextDecoder('utf-8').decode(bytes);
  if (e.metodo !== 8) throw new Error('Compressão do .xlsx não suportada.');
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue abrir .xlsx. Use o Edge ou o Chrome atualizado.');
  const fluxo = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
  return new TextDecoder('utf-8').decode(await fluxo.arrayBuffer());
}

function xml(texto: string): Document {
  return new DOMParser().parseFromString(texto, 'application/xml');
}

function filhos(el: Element, nome: string): Element[] {
  const r: Element[] = [];
  for (let i = 0; i < el.children.length; i++) if (el.children[i].localName === nome) r.push(el.children[i]);
  return r;
}

function todos(doc: Document | Element, nome: string): Element[] {
  return Array.prototype.slice.call(doc.getElementsByTagNameNS('*', nome)) as Element[];
}

/** "AB12" -> índice da coluna (0 = A). */
function colunaDe(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (let i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
  return n - 1;
}

function textoRico(si: Element): string {
  return todos(si, 't')
    .map((t) => t.textContent || '')
    .join('');
}

/** Lê todas as abas de um .xlsx. A primeira linha de cada aba é o cabeçalho. */
export async function lerXlsx(arquivo: File): Promise<IPlanilhaLida[]> {
  const buf = await arquivo.arrayBuffer();
  const mapa: Record<string, IEntradaZip> = {};
  entradas(buf).forEach((e) => (mapa[e.nome] = e));
  const ler = async (nome: string): Promise<string | undefined> => (mapa[nome] ? extrair(buf, mapa[nome]) : undefined);

  const wb = await ler('xl/workbook.xml');
  const rels = await ler('xl/_rels/workbook.xml.rels');
  if (!wb || !rels) throw new Error('Arquivo inválido: não é um .xlsx.');
  const relMap: Record<string, string> = {};
  todos(xml(rels), 'Relationship').forEach((r) => (relMap[r.getAttribute('Id') || ''] = r.getAttribute('Target') || ''));

  const ss = await ler('xl/sharedStrings.xml');
  const compartilhadas: string[] = ss ? todos(xml(ss), 'si').map(textoRico) : [];

  const abas = todos(xml(wb), 'sheet').map((s) => ({
    nome: s.getAttribute('name') || '',
    rid: s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id') || ''
  }));

  const saida: IPlanilhaLida[] = [];
  for (const aba of abas) {
    let alvo = relMap[aba.rid] || '';
    alvo = alvo.charAt(0) === '/' ? alvo.slice(1) : `xl/${alvo}`;
    const conteudo = await ler(alvo);
    if (!conteudo) continue;
    const linhasXml = todos(xml(conteudo), 'row');
    const matriz: string[][] = [];
    linhasXml.forEach((row) => {
      const linha: string[] = [];
      filhos(row, 'c').forEach((c) => {
        const idx = colunaDe(c.getAttribute('r') || '');
        const tipo = c.getAttribute('t');
        const vEl = filhos(c, 'v')[0];
        let valor = '';
        if (tipo === 'inlineStr') valor = textoRico(c);
        else if (vEl) {
          const bruto = vEl.textContent || '';
          valor = tipo === 's' ? compartilhadas[Number(bruto)] || '' : bruto;
        }
        linha[idx] = valor;
      });
      matriz.push(linha);
    });
    const cab = (matriz[0] || []).map((h) => String(h === undefined ? '' : h).trim());
    const linhas: Record<string, string>[] = [];
    for (let i = 1; i < matriz.length; i++) {
      const o: Record<string, string> = {};
      let algum = false;
      cab.forEach((h, j) => {
        if (!h) return;
        const val = matriz[i][j] === undefined ? '' : String(matriz[i][j]);
        if (val !== '') algum = true;
        o[h] = val;
      });
      if (algum) linhas.push(o);
    }
    saida.push({ nome: aba.nome, linhas, cabecalho: cab.filter(Boolean) });
  }
  return saida;
}
