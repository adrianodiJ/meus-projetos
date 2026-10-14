// Gerador mínimo de .xlsx (OOXML + ZIP sem compressão), sem dependências externas.

export type Celula = string | number | boolean | Date | null | undefined | { f: string; v?: number | string };

export interface IColunaXlsx {
  titulo: string;
  largura?: number;
  formato?: 'texto' | 'inteiro' | 'decimal' | 'moeda' | 'data' | 'percentual';
}

export interface IPlanilhaXlsx {
  nome: string;
  colunas: IColunaXlsx[];
  linhas: Celula[][];
  titulo?: string; // linha de título acima do cabeçalho
  congelarCabecalho?: boolean;
  filtro?: boolean;
}

// ---------------------------------------------------------------- ZIP (store)
let tabelaCrc: number[] | undefined;

function crc32(dados: Uint8Array): number {
  if (!tabelaCrc) {
    tabelaCrc = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelaCrc.push(c >>> 0);
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < dados.length; i++) crc = tabelaCrc[(crc ^ dados[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function utf8(texto: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(texto);
  const bin = unescape(encodeURIComponent(texto));
  const r = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) r[i] = bin.charCodeAt(i);
  return r;
}

function dataDos(d: Date): { hora: number; dia: number } {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    dia: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

export function criarZip(arquivos: { nome: string; conteudo: Uint8Array }[]): Uint8Array {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;
  const agora = dataDos(new Date());

  const u16 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  arquivos.forEach((a) => {
    const nome = utf8(a.nome);
    const crc = crc32(a.conteudo);
    const tamanho = a.conteudo.length;
    const local = new Uint8Array(
      ([] as number[]).concat(
        u32(0x04034b50),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(agora.hora),
        u16(agora.dia),
        u32(crc),
        u32(tamanho),
        u32(tamanho),
        u16(nome.length),
        u16(0)
      )
    );
    partes.push(local, nome, a.conteudo);

    const dir = new Uint8Array(
      ([] as number[]).concat(
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(agora.hora),
        u16(agora.dia),
        u32(crc),
        u32(tamanho),
        u32(tamanho),
        u16(nome.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(deslocamento)
      )
    );
    central.push(dir, nome);
    deslocamento += local.length + nome.length + tamanho;
  });

  let tamanhoCentral = 0;
  central.forEach((c) => {
    tamanhoCentral += c.length;
  });
  const fim = new Uint8Array(
    ([] as number[]).concat(
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(arquivos.length),
      u16(arquivos.length),
      u32(tamanhoCentral),
      u32(deslocamento),
      u16(0)
    )
  );

  const todos = partes.concat(central, [fim]);
  let total = 0;
  todos.forEach((p) => {
    total += p.length;
  });
  const saida = new Uint8Array(total);
  let pos = 0;
  todos.forEach((p) => {
    saida.set(p, pos);
    pos += p.length;
  });
  return saida;
}

// ---------------------------------------------------------------- XML
function esc(v: string): string {
  // remove caracteres de controle inválidos em XML 1.0
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function colunaExcel(indice: number): string {
  let n = indice + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Data → número serial do Excel (dias desde 1899-12-30, usando a data local). */
function serial(d: Date): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return utc / 86400000 + 25569;
}

// estilos: 0 padrão | 1 cabeçalho | 2 título | 3 inteiro | 4 decimal | 5 moeda | 6 data | 7 percentual | 8 texto quebrado
const ESTILO_POR_FORMATO: Record<string, number> = {
  texto: 8,
  inteiro: 3,
  decimal: 4,
  moeda: 5,
  data: 6,
  percentual: 7
};

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF1F2328"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><color rgb="FFD40511"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF1F2328"/><name val="Calibri"/></font>
</fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFCC00"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD0D4DA"/></left><right style="thin"><color rgb="FFD0D4DA"/></right><top style="thin"><color rgb="FFD0D4DA"/></top><bottom style="thin"><color rgb="FFD0D4DA"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="1" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="166" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="9" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function nomeAba(nome: string, usados: string[]): string {
  let base = nome.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Planilha';
  let candidato = base;
  let i = 2;
  while (usados.indexOf(candidato.toLowerCase()) >= 0) {
    const sufixo = ` (${i++})`;
    candidato = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  base = candidato;
  usados.push(base.toLowerCase());
  return base;
}

function xmlPlanilha(p: IPlanilhaXlsx): string {
  const linhas: string[] = [];
  let numeroLinha = 1;
  const nCols = p.colunas.length;

  if (p.titulo) {
    linhas.push(`<row r="${numeroLinha}" ht="24" customHeight="1"><c r="A${numeroLinha}" s="2" t="inlineStr"><is><t>${esc(p.titulo)}</t></is></c></row>`);
    numeroLinha += 2;
  }
  const linhaCabecalho = numeroLinha;
  const cab = p.colunas
    .map((c, i) => `<c r="${colunaExcel(i)}${numeroLinha}" s="1" t="inlineStr"><is><t>${esc(c.titulo)}</t></is></c>`)
    .join('');
  linhas.push(`<row r="${numeroLinha}" ht="22" customHeight="1">${cab}</row>`);
  numeroLinha++;

  p.linhas.forEach((linha) => {
    const cel: string[] = [];
    for (let i = 0; i < nCols; i++) {
      const v = linha[i];
      const ref = `${colunaExcel(i)}${numeroLinha}`;
      const estilo = ESTILO_POR_FORMATO[p.colunas[i].formato || 'texto'];
      if (v === null || v === undefined || v === '') {
        cel.push(`<c r="${ref}" s="${estilo}"/>`);
      } else if (typeof v === 'object' && !(v instanceof Date)) {
        const cache = v.v !== undefined ? `<v>${typeof v.v === 'number' ? v.v : esc(String(v.v))}</v>` : '';
        cel.push(`<c r="${ref}" s="${estilo}"${typeof v.v === 'string' ? ' t="str"' : ''}><f>${esc(v.f)}</f>${cache}</c>`);
      } else if (v instanceof Date) {
        cel.push(`<c r="${ref}" s="${p.colunas[i].formato === 'data' ? 6 : estilo}"><v>${serial(v)}</v></c>`);
      } else if (typeof v === 'number') {
        cel.push(isFinite(v) ? `<c r="${ref}" s="${estilo}"><v>${v}</v></c>` : `<c r="${ref}" s="${estilo}"/>`);
      } else if (typeof v === 'boolean') {
        cel.push(`<c r="${ref}" s="${estilo}" t="inlineStr"><is><t>${v ? 'Sim' : 'Não'}</t></is></c>`);
      } else {
        cel.push(`<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`);
      }
    }
    linhas.push(`<row r="${numeroLinha}">${cel.join('')}</row>`);
    numeroLinha++;
  });

  const cols = p.colunas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura || 16}" customWidth="1"/>`)
    .join('');
  const ultima = Math.max(numeroLinha - 1, linhaCabecalho);
  const panes =
    p.congelarCabecalho !== false
      ? `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${linhaCabecalho}" topLeftCell="A${linhaCabecalho + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>';
  const filtro =
    p.filtro !== false && p.linhas.length > 0
      ? `<autoFilter ref="A${linhaCabecalho}:${colunaExcel(nCols - 1)}${ultima}"/>`
      : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${panes}<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${linhas.join('')}</sheetData>${filtro}<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToHeight="0"/></worksheet>`;
}

export function gerarXlsx(planilhas: IPlanilhaXlsx[], autor: string = 'Quality Request Portal'): Uint8Array {
  const usados: string[] = [];
  const nomes = planilhas.map((p) => nomeAba(p.nome, usados));
  const agora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  const arquivos: { nome: string; conteudo: Uint8Array }[] = [
    {
      nome: '[Content_Types].xml',
      conteudo: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${planilhas
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join(
            ''
          )}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
      )
    },
    {
      nome: '_rels/.rels',
      conteudo: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
      )
    },
    {
      nome: 'docProps/core.xml',
      conteudo: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>${esc(autor)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created></cp:coreProperties>`
      )
    },
    {
      nome: 'docProps/app.xml',
      conteudo: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quality Request Portal</Application></Properties>`
      )
    },
    {
      nome: 'xl/workbook.xml',
      conteudo: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes
          .map((nome, i) => `<sheet name="${esc(nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('')}</sheets></workbook>`
      )
    },
    {
      nome: 'xl/_rels/workbook.xml.rels',
      conteudo: utf8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${planilhas
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
          )
          .join(
            ''
          )}<Relationship Id="rId${planilhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
      )
    },
    { nome: 'xl/styles.xml', conteudo: utf8(STYLES_XML) }
  ];

  planilhas.forEach((p, i) => {
    arquivos.push({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo: utf8(xmlPlanilha(p)) });
  });

  return criarZip(arquivos);
}

export function baixarArquivo(bytes: Uint8Array, nome: string, tipo: string): void {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: tipo });
  const nav = window.navigator as Navigator & { msSaveOrOpenBlob?: (b: Blob, n: string) => boolean };
  if (nav.msSaveOrOpenBlob) {
    nav.msSaveOrOpenBlob(blob, nome);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
