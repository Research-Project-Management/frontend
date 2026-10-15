/**
 * @deprecated
 * latex-converter.ts
 *
 * LEGACY REGEX CONVERTER (Superseded by CodeMirror 6 Visual Mode extensions).
 * This module was previously used by the retired contentEditable surface.
 * Modern visual editing in Flux follows Overleaf's architecture: CodeMirror 6 with
 * inline decorators and widgets (latex-visual-headings, latex-visual-math, latex-visual-citations),
 * preserving 100% lossless LaTeX and avoiding regex HTML transformations.
 */

import katex from 'katex';
import 'katex/contrib/mhchem';

/**
 * Metadata container for preamble elements when parsing LaTeX documents.
 */
export interface LatexPreamble {
  documentclass?: string;
  packages: string[];
  title?: string;
  author?: string;
  date?: string;
  customMacros: string[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripUnescapedComments(src: string): string {
  return src
    .split('\n')
    .map((line) => {
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '%') {
          let bs = 0;
          for (let j = i - 1; j >= 0 && line[j] === '\\'; j--) bs++;
          if (bs % 2 === 0) return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

function extractBalancedCommandArg(src: string, cmdName: string): string | undefined {
  const re = new RegExp(`\\\\${cmdName}\\*?(?:\\[[^\\]]*\\])?\\s*\\{`);
  const m = re.exec(src);
  if (!m || m.index === undefined) return undefined;
  const openIdx = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(openIdx + 1, i).trim();
      }
    }
  }
  return undefined;
}

/**
 * Extracts preamble and main body from a complete LaTeX manuscript.
 */
export function extractLatexBodyAndPreamble(latex: string): {
  preamble: LatexPreamble;
  body: string;
} {
  const preamble: LatexPreamble = { packages: [], customMacros: [] };
  const uncommentedFull = stripUnescapedComments(latex);

  const docClassMatch = uncommentedFull.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
  if (docClassMatch) preamble.documentclass = docClassMatch[1].trim();

  const extractedTitle = extractBalancedCommandArg(uncommentedFull, 'title');
  if (extractedTitle !== undefined) preamble.title = extractedTitle;

  const extractedAuthor = extractBalancedCommandArg(uncommentedFull, 'author');
  if (extractedAuthor !== undefined) preamble.author = extractedAuthor;

  const extractedDate = extractBalancedCommandArg(uncommentedFull, 'date');
  if (extractedDate !== undefined) preamble.date = extractedDate;

  const beginDocIdx = latex.indexOf('\\begin{document}');
  const endDocIdx = latex.indexOf('\\end{document}');

  if (beginDocIdx !== -1 && endDocIdx !== -1 && endDocIdx > beginDocIdx) {
    const rawPreamble = stripUnescapedComments(latex.substring(0, beginDocIdx));

    // Extract packages (splitting comma-separated \usepackage{a,b} lists)
    const pkgRegex = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
    let pkgMatch: RegExpExecArray | null;
    while ((pkgMatch = pkgRegex.exec(rawPreamble)) !== null) {
      pkgMatch[1].split(',').forEach((p) => {
        const cleanPkg = p.trim();
        if (cleanPkg && !preamble.packages.includes(cleanPkg)) {
          preamble.packages.push(cleanPkg);
        }
      });
    }

    // Extract custom macros (\newcommand, \renewcommand, \def)
    const macroRegex = /(\\(?:newcommand|renewcommand|def)\*?\{?[^}\n]+\}?(?:\{[\s\S]*?\})?)/g;
    let macroMatch: RegExpExecArray | null;
    while ((macroMatch = macroRegex.exec(rawPreamble)) !== null) {
      preamble.customMacros.push(macroMatch[1]);
    }

    let body = latex.substring(beginDocIdx + '\\begin{document}'.length, endDocIdx);
    body = body.replace(/\\maketitle\s*/g, '');
    return { preamble, body: body.trim() };
  }

  return { preamble, body: latex.trim() };
}

const MAX_MATH_CACHE_SIZE = 2000;
const mathHtmlCache = new Map<string, string>();
const chemHtmlCache = new Map<string, string>();

/**
 * Safely renders LaTeX math using KaTeX into an HTML string with fallback and O(1) LRU memory cache.
 */
export function renderMathHtml(mathCode: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? 'D:' : 'I:'}${mathCode}`;
  const cached = mathHtmlCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let html: string;
  try {
    html = katex.renderToString(mathCode, {
      displayMode,
      throwOnError: false,
    });
  } catch {
    const esc = escapeHtml(mathCode);
    html = displayMode
      ? `<pre class="math-error">$$${esc}$$</pre>`
      : `<code class="math-error">$${esc}$</code>`;
  }

  if (mathHtmlCache.size >= MAX_MATH_CACHE_SIZE) {
    const firstKey = mathHtmlCache.keys().next().value;
    if (firstKey) mathHtmlCache.delete(firstKey);
  }
  mathHtmlCache.set(cacheKey, html);
  return html;
}

/**
 * Safely renders LaTeX chemical formula using KaTeX mhchem into an HTML string with fallback and cache.
 */
export function renderChemHtml(chemCode: string): string {
  const cached = chemHtmlCache.get(chemCode);
  if (cached !== undefined) {
    return cached;
  }

  let html: string;
  try {
    html = katex.renderToString(`\\ce{${chemCode}}`, {
      displayMode: false,
      throwOnError: false,
    });
  } catch {
    const esc = escapeHtml(chemCode);
    html = `<code class="chem-error font-mono text-11 px-1 py-0.5 rounded-sm bg-muted/60">\\ce{${esc}}</code>`;
  }

  if (chemHtmlCache.size >= 1000) {
    const firstKey = chemHtmlCache.keys().next().value;
    if (firstKey) chemHtmlCache.delete(firstKey);
  }
  chemHtmlCache.set(chemCode, html);
  return html;
}

/**
 * Converts LaTeX formatting inside a table cell into HTML. Everything that is not a
 * simple formatting command is kept verbatim (HTML-escaped) so it can round-trip.
 */
function convertLatexCellContentToHtml(raw: string): string {
  let cell = escapeHtml(raw.trim());
  let prev: string;
  do {
    prev = cell;
    cell = cell
      .replace(/\\textbf\{([^{}]*)\}/g, '<strong>$1</strong>')
      .replace(/\\textit\{([^{}]*)\}/g, '<em>$1</em>')
      .replace(/\\underline\{([^{}]*)\}/g, '<u>$1</u>')
      .replace(/\\texttt\{([^{}]*)\}/g, '<code>$1</code>');
  } while (cell !== prev);

  cell = cell
    .replace(/\\&amp;/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#');

  return cell;
}

/** Decodes the HTML entities produced by {@link escapeHtml} (and common variants). */
function decodeEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Reads an HTML attribute value (raw, still entity/URI encoded) from an attribute string. */
function getAttr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

function getDecodedAttr(attrs: string, name: string): string | undefined {
  const v = getAttr(attrs, name);
  if (v === undefined) return undefined;
  try {
    return decodeURIComponent(v);
  } catch {
    return decodeEntities(v);
  }
}

/**
 * Replaces HTML elements with balanced nesting awareness (e.g. KaTeX nested spans).
 * `match` decides from the opening tag attributes whether an element is handled.
 */
function replaceElements(
  html: string,
  tag: string,
  match: (attrs: string) => boolean,
  fn: (attrs: string, inner: string) => string
): string {
  const openRe = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
  let out = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    const attrs = m[1] || '';
    if (!match(attrs)) continue;
    const tagRe = new RegExp(`<(/?)${tag}(?:\\s[^>]*)?>`, 'gi');
    tagRe.lastIndex = m.index + m[0].length;
    let depth = 1;
    let innerEnd = -1;
    let end = -1;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(html)) !== null) {
      if (t[1]) depth--;
      else if (!t[0].endsWith('/>')) depth++;
      if (depth === 0) {
        innerEnd = t.index;
        end = t.index + t[0].length;
        break;
      }
    }
    if (end === -1) break;
    out += html.slice(pos, m.index) + fn(attrs, html.slice(m.index + m[0].length, innerEnd));
    pos = end;
    openRe.lastIndex = end;
  }
  return out + html.slice(pos);
}

const PENDING_SIG = '__flux_pending_sig__';

/**
 * Signature of an element's user-visible content plus all LaTeX-bearing data attributes.
 * Stable across DOM re-serialization (attribute quoting, <br/> vs <br>), so it detects edits.
 */
function contentSig(innerHtml: string): string {
  const attrs: string[] = [];
  innerHtml.replace(
    /\sdata-(math|cite|cite-cmd|cite-opts|ref|ref-cmd|label|latex-comment|raw-latex|cmd|delim)="([^"]*)"/g,
    (_, n: string, v: string) => {
      attrs.push(`${n}=${v}`);
      return '';
    }
  );
  const textContent = decodeEntities(innerHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
  return `${textContent}\u0001${attrs.join('\u0001')}`;
}

/** Converts table-cell HTML back to the LaTeX cell source (inverse of convertLatexCellContentToHtml). */
function extractCellLatex(cellInner: string): string {
  let s = cellInner
    .replace(/<p(?:\s[^>]*)?>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ');
  let prev: string;
  do {
    prev = s;
    s = replaceElements(s, 'strong', () => true, (_, i) => `\\textbf{${i}}`);
    s = replaceElements(s, 'b', () => true, (_, i) => `\\textbf{${i}}`);
    s = replaceElements(s, 'em', () => true, (_, i) => `\\textit{${i}}`);
    s = replaceElements(s, 'i', () => true, (_, i) => `\\textit{${i}}`);
    s = replaceElements(s, 'u', () => true, (_, i) => `\\underline{${i}}`);
    s = replaceElements(s, 'code', () => true, (_, i) => `\\texttt{${i}}`);
  } while (s !== prev);
  let decoded = decodeEntities(s.replace(/<[^>]+>/g, '')).trim();
  decoded = decoded
    .replace(/(?<!\\)&/g, '\\&')
    .replace(/(?<!\\)%/g, '\\%');
  return decoded;
}

export interface ExtractedTableCell {
  text: string;
  colSpan?: number;
  rowSpan?: number;
  align?: string;
}

/** Extracts the table rows (header flag + LaTeX cells with spans) from table HTML. */
function extractTableRows(inner: string): Array<{ isHeader: boolean; cells: ExtractedTableCell[] }> {
  const rows: Array<{ isHeader: boolean; cells: ExtractedTableCell[] }> = [];
  const trMatches = inner.match(/<tr(?:\s[^>]*)?>[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const isHeader = /<th[\s>]/i.test(tr);
    const cells: ExtractedTableCell[] = [];
    const cellRe = /<(th|td)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(tr)) !== null) {
      const attrs = c[2] || '';
      const text = extractCellLatex(c[3]);
      const csMatch = attrs.match(/colspan="?(\d+)"?/i);
      const rsMatch = attrs.match(/rowspan="?(\d+)"?/i);
      const alignMatch = attrs.match(/data-align="?([^"\s>]+)"?/i);
      cells.push({
        text,
        colSpan: csMatch ? parseInt(csMatch[1], 10) : undefined,
        rowSpan: rsMatch ? parseInt(rsMatch[1], 10) : undefined,
        align: alignMatch ? alignMatch[1] : undefined,
      });
    }
    if (cells.length > 0) rows.push({ isHeader, cells });
  }
  return rows;
}

const TABLE_ATTR_KEYS = [
  'data-caption',
  'data-label',
  'data-align',
  'data-env',
  'data-placement',
  'data-centering',
  'data-rules',
  'data-caption-pos',
];

/** Deterministic signature of the table attributes and cell contents, used to detect user edits. */
function tableSignature(attrs: string, rows: Array<{ isHeader: boolean; cells: ExtractedTableCell[] }>): string {
  const meta = TABLE_ATTR_KEYS.map((k) => getAttr(attrs, k) ?? '').join('\u0001');
  const cells = rows
    .map(
      (r) =>
        (r.isHeader ? 'H' : 'B') +
        r.cells.map((c) => `${c.colSpan || 1}:${c.rowSpan || 1}:${c.text}`).join('\u0001')
    )
    .join('\u0002');
  return `${meta}\u0003${cells}`;
}

/** Counts the number of columns described by a tabular column specification. */
export function countAlignColumns(spec: string): number {
  let s = spec;
  // Expand *{n}{spec}
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\*\{(\d+)\}\{([^{}]*)\}/g, (_, n: string, inner: string) => inner.repeat(Number(n)));
  } while (s !== prev);
  s = s
    .replace(/[@!<>]\{[^{}]*\}/g, '')
    .replace(/([pmbX])\{[^{}]*\}/g, '$1')
    .replace(/[|\s]/g, '');
  return (s.match(/[lcrpmbXS]/g) || []).length;
}

const TABLE_RULE_RE =
  /\\(?:toprule|midrule|bottomrule|hline|centering|addlinespace(?:\[[^\]]*\])?|cline\{[^}]*\}|cmidrule(?:\([^)]*\))?\{[^}]*\})/g;

/**
 * Parses LaTeX table or tabular environment into an HTML table.
 * Returns '' when the table cannot be represented faithfully (callers then keep it as raw LaTeX).
 * The original LaTeX block and its formatting metadata are kept on the element so that
 * an unedited table round-trips byte-for-byte and an edited one keeps its alignment,
 * environment, placement and rule style.
 */
export function convertLatexTableToHtml(tableBlock: string, line?: number): string {
  const tabularMatch = tableBlock.match(
    /\\begin\{tabular\}(?:\[[^\]]*\])?\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}([\s\S]*?)\\end\{tabular\}/
  );
  if (!tabularMatch) return '';

  const alignSpec = tabularMatch[1].trim();
  const rawBody = tabularMatch[2];

  // Structures we cannot edit safely as a simple grid -> caller keeps raw.
  if (/\\begin\{|(?<!\\)%/.test(rawBody)) return '';
  if ((tableBlock.match(/\\begin\{tabular/g) || []).length !== 1) return '';

  const envMatch = tableBlock.match(/^\s*\\begin\{(table\*?)\}(?:\[([^\]]*)\])?/);
  const env = envMatch ? envMatch[1] : '';
  const placement = envMatch?.[2] ?? '';

  const captionMatch = tableBlock.match(/\\caption(?:\[[^\]]*\])?\{([^}]+)\}/);
  const caption = captionMatch ? captionMatch[1] : '';
  const labelMatch = tableBlock.match(/\\label\{([^}]+)\}/);
  const label = labelMatch ? labelMatch[1] : '';
  const captionPos =
    captionMatch && tabularMatch.index !== undefined && (captionMatch.index ?? 0) > tabularMatch.index ? 'bottom' : 'top';
  const centering = /\\centering/.test(tableBlock);
  const rules = /\\(?:toprule|midrule|bottomrule)/.test(tableBlock)
    ? 'booktabs'
    : /\\hline/.test(tableBlock)
      ? 'hline'
      : 'none';

  const rawRows = rawBody.split(/\\\\(?:\s*\[[^\]]*\])?/);
  const headerRowsHtml: string[] = [];
  const bodyRowsHtml: string[] = [];
  let isHeader = true;

  for (const rawRowUntrimmed of rawRows) {
    const cleanRow = rawRowUntrimmed.replace(TABLE_RULE_RE, '').trim();
    if (!cleanRow) continue;
    const rawCells = cleanRow.split(/(?<!\\)&/);
    const cellHtmls: string[] = [];

    for (const rawCell of rawCells) {
      let trimmed = rawCell.trim();
      let colSpan = 1;
      let rowSpan = 1;
      let align = '';

      // Check \multicolumn{n}{align}{content}
      const multiColMatch = trimmed.match(/^\\multicolumn\{(\d+)\}\{([^}]*)\}\{([\s\S]*)\}$/);
      if (multiColMatch) {
        colSpan = parseInt(multiColMatch[1], 10) || 1;
        align = multiColMatch[2].trim();
        trimmed = multiColMatch[3].trim();
      }

      // Check \multirow{n}{width}{content}
      const multiRowMatch = trimmed.match(/^\\multirow\{(\d+)\}\{([^}]*)\}\{([\s\S]*)\}$/);
      if (multiRowMatch) {
        rowSpan = parseInt(multiRowMatch[1], 10) || 1;
        trimmed = multiRowMatch[3].trim();
      }

      const cellContent = convertLatexCellContentToHtml(trimmed);
      const spanAttrs = [
        colSpan > 1 ? ` colspan="${colSpan}"` : '',
        rowSpan > 1 ? ` rowspan="${rowSpan}"` : '',
        align ? ` data-align="${escapeHtml(align)}"` : '',
      ].join('');

      const tag = isHeader ? 'th' : 'td';
      cellHtmls.push(`<${tag}${spanAttrs}><p>${cellContent}</p></${tag}>`);
    }

    if (isHeader) {
      headerRowsHtml.push(`<tr>${cellHtmls.join('')}</tr>`);
      isHeader = false;
    } else {
      bodyRowsHtml.push(`<tr>${cellHtmls.join('')}</tr>`);
    }
  }

  const thead = headerRowsHtml.length > 0 ? `<thead>${headerRowsHtml.join('')}</thead>` : '';
  const tbody = `<tbody>${bodyRowsHtml.join('')}</tbody>`;
  const baseAttrs = [
    line !== undefined ? ` data-line="${line}"` : '',
    caption ? ` data-caption="${encodeURIComponent(caption)}"` : '',
    label ? ` data-label="${encodeURIComponent(label)}"` : '',
    alignSpec ? ` data-align="${encodeURIComponent(alignSpec)}"` : '',
    ` data-env="${encodeURIComponent(env)}"`,
    placement ? ` data-placement="${encodeURIComponent(placement)}"` : '',
    ` data-centering="${centering ? 'true' : 'false'}"`,
    ` data-rules="${rules}"`,
    ` data-caption-pos="${captionPos}"`,
    ` data-raw-latex="${encodeURIComponent(tableBlock.trim())}"`,
  ].join('');

  const sig = tableSignature(baseAttrs, extractTableRows(thead + tbody));
  const attrs = `${baseAttrs} data-sig="${encodeURIComponent(sig)}"`;

  return `\n<table${attrs}>${thead}${tbody}</table>\n`;
}

/** Converts an HTML table (possibly user-edited) back to LaTeX. */
function htmlTableToLatex(attrs: string, inner: string): string {
  const rows = extractTableRows(inner);
  const raw = getDecodedAttr(attrs, 'data-raw-latex');
  const sig = getDecodedAttr(attrs, 'data-sig');
  if (raw !== undefined && sig !== undefined && sig === tableSignature(attrs, rows)) {
    return raw;
  }
  if (rows.length === 0) return '';

  const caption = getDecodedAttr(attrs, 'data-caption') ?? '';
  const label = getDecodedAttr(attrs, 'data-label') ?? '';
  const envAttr = getDecodedAttr(attrs, 'data-env');
  const placementAttr = getDecodedAttr(attrs, 'data-placement');
  const centeringAttr = getAttr(attrs, 'data-centering');
  const rules = getAttr(attrs, 'data-rules') ?? 'booktabs';
  const captionPos = getAttr(attrs, 'data-caption-pos') ?? 'top';

  const maxCols = rows.reduce((n, r) => {
    const rowSpanCount = r.cells.reduce((sum, c) => sum + (c.colSpan || 1), 0);
    return Math.max(n, rowSpanCount);
  }, 0);
  let alignSpec = getDecodedAttr(attrs, 'data-align') ?? '';
  if (!alignSpec || countAlignColumns(alignSpec) !== maxCols) {
    const bar = alignSpec.includes('|');
    alignSpec = bar ? `|${Array(maxCols).fill('c').join('|')}|` : Array(maxCols).fill('c').join(' ');
  }

  // Legacy HTML without metadata keeps the historical booktabs + table wrapper output.
  let env = envAttr === undefined ? 'table' : envAttr;
  if (!env && (caption || label)) env = 'table';
  const placement = placementAttr ?? (envAttr === undefined ? 'htbp' : '');
  const centering = centeringAttr === undefined ? true : centeringAttr === 'true';

  const lines: string[] = [];
  const ind = env ? '  ' : '';
  const captionLines = [caption ? `${ind}\\caption{${caption}}` : '', label ? `${ind}\\label{${label}}` : ''].filter(Boolean);

  if (env) {
    lines.push(`\\begin{${env}}${placement ? `[${placement}]` : ''}`);
    if (centering) lines.push('  \\centering');
    if (captionPos === 'top') lines.push(...captionLines);
  }
  lines.push(`${ind}\\begin{tabular}{${alignSpec}}`);
  if (rules === 'booktabs') lines.push(`${ind}  \\toprule`);
  if (rules === 'hline') lines.push(`${ind}  \\hline`);

  let headerRuleDone = false;
  for (const row of rows) {
    const cellStrings: string[] = [];
    let currentCols = 0;
    for (const cell of row.cells) {
      const cs = cell.colSpan || 1;
      const rs = cell.rowSpan || 1;
      let text = cell.text;
      if (rs > 1) {
        text = `\\multirow{${rs}}{*}{${text}}`;
      }
      if (cs > 1) {
        text = `\\multicolumn{${cs}}{${cell.align || 'c'}}{${text}}`;
      }
      cellStrings.push(text);
      currentCols += cs;
    }
    while (currentCols < maxCols) {
      cellStrings.push('');
      currentCols++;
    }
    lines.push(`${ind}  ${cellStrings.join(' & ')} \\\\`);
    if (row.isHeader && !headerRuleDone) {
      if (rules === 'booktabs') lines.push(`${ind}  \\midrule`);
      if (rules === 'hline') lines.push(`${ind}  \\hline`);
      headerRuleDone = true;
    }
  }
  if (rules === 'booktabs') lines.push(`${ind}  \\bottomrule`);
  if (rules === 'hline') lines.push(`${ind}  \\hline`);
  lines.push(`${ind}\\end{tabular}`);
  if (env) {
    if (captionPos !== 'top') lines.push(...captionLines);
    lines.push(`\\end{${env}}`);
  }
  return lines.join('\n');
}

/**
 * Builds an array of 0-based character offsets for the start of each line in a string.
 */
export function buildLineOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Returns the 1-indexed line number for a given character offset in the source text.
 */
export function getLineAtOffset(lineOffsets: number[], offset: number): number {
  if (offset <= 0) return 1;
  let low = 0;
  let high = lineOffsets.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lineOffsets[mid] <= offset) {
      if (mid === lineOffsets.length - 1 || lineOffsets[mid + 1] > offset) {
        return mid + 1;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return 1;
}

/**
 * Finds the 1-indexed line number where snippet appears in fullLatex, searching from searchFrom.
 */
export function findSourceLine(
  fullLatex: string,
  lineOffsets: number[],
  snippet: string,
  searchFrom = 0
): { line: number; nextSearchIndex: number } {
  if (!snippet) return { line: 1, nextSearchIndex: searchFrom };
  const trimmed = snippet.trim().slice(0, 60);
  const found = fullLatex.indexOf(trimmed, searchFrom);
  if (found !== -1) {
    return {
      line: getLineAtOffset(lineOffsets, found),
      nextSearchIndex: found + trimmed.length,
    };
  }
  const fromStart = fullLatex.indexOf(trimmed);
  if (fromStart !== -1) {
    return {
      line: getLineAtOffset(lineOffsets, fromStart),
      nextSearchIndex: fromStart + trimmed.length,
    };
  }
  return {
    line: getLineAtOffset(lineOffsets, searchFrom),
    nextSearchIndex: searchFrom,
  };
}

/**
 * Parses LaTeX figure environment into a rich interactive HTML <figure>.
 */
export function convertLatexFigureToHtml(figureBlock: string, line?: number): string {
  const isStarred = /\\begin\{figure\*\}/.test(figureBlock);
  const placementMatch = figureBlock.match(/\\begin\{figure\*?\}(?:\[([^\]]*)\])?/);
  const placement = placementMatch?.[1] || 'htbp';

  const isCentering = /\\centering/.test(figureBlock) || /\\begin\{center\}/.test(figureBlock);

  // Extract \includegraphics[options]{path}
  const graphicsMatch = figureBlock.match(/\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/);
  if (!graphicsMatch) {
    return '';
  }

  const options = graphicsMatch[1] || '';
  const src = graphicsMatch[2].trim();

  // Extract width if specified, or default to 0.8\linewidth
  let widthSpec = '0.8\\linewidth';
  const widthMatch = options.match(/width=([^,\]]+)/);
  if (widthMatch) {
    widthSpec = widthMatch[1].trim();
  } else {
    const scaleMatch = options.match(/scale=([^,\]]+)/);
    if (scaleMatch) {
      widthSpec = `scale=${scaleMatch[1].trim()}`;
    }
  }

  // Calculate CSS percentage for preview display
  let cssWidth = '80%';
  if (widthSpec.includes('\\textwidth') || widthSpec.includes('\\linewidth')) {
    const numMatch = widthSpec.match(/([0-9.]+)/);
    if (numMatch) {
      const pct = Math.round(parseFloat(numMatch[1]) * 100);
      cssWidth = `${Math.min(100, Math.max(10, pct))}%`;
    } else {
      cssWidth = '100%';
    }
  } else if (widthSpec.includes('%')) {
    cssWidth = widthSpec;
  }

  const captionMatch = figureBlock.match(/\\caption(?:\[[^\]]*\])?\{([^}]+)\}/);
  const caption = captionMatch ? captionMatch[1] : '';

  const labelMatch = figureBlock.match(/\\label\{([^}]+)\}/);
  const label = labelMatch ? labelMatch[1] : '';

  const filename = src.split('/').pop() || src;
  const isPdfOrEps = /\.pdf|\.eps$/i.test(src);

  const labelBadge = label ? ` <span class="text-[11px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-mono">${escapeHtml(label)}</span>` : '';
  const lineAttr = line !== undefined ? ` data-line="${line}"` : '';

  const previewContent = isPdfOrEps
    ? `<div class="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2"><svg class="w-8 h-8 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><span class="font-mono text-xs text-foreground/80">${escapeHtml(filename)}</span><span class="text-[11px] text-muted-foreground italic">Vector Graphic Asset (${escapeHtml(widthSpec)})</span></div>`
    : `<img src="${escapeHtml(src)}" alt="${escapeHtml(caption || filename)}" class="max-h-80 object-contain rounded-md" style="width: ${cssWidth};" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'flex flex-col items-center justify-center py-6 text-muted-foreground gap-2\\'><svg class=\\'w-8 h-8 text-muted-foreground/60\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\\'/></svg><span class=\\'font-mono text-xs text-foreground/80\\'>${escapeHtml(filename)}</span><span class=\\'text-[11px] text-muted-foreground italic\\'>Graphic Asset (${escapeHtml(widthSpec)})</span></div>';" />`;

  const figureInner = [
    `<div class="latex-figure-badge flex items-center justify-between pb-2 mb-3 border-b border-border/40 text-xs text-muted-foreground">`,
    `  <span class="flex items-center gap-1.5 font-medium text-foreground/80">`,
    `    <span class="text-primary font-semibold">Figure</span>`,
    `    <span class="font-mono text-xs opacity-75">${escapeHtml(filename)}</span>`,
    `  </span>`,
    `  <div class="flex items-center gap-2">`,
    `    <span class="text-[11px] px-1.5 py-0.5 rounded-sm bg-muted/60 font-mono text-muted-foreground">${escapeHtml(widthSpec)}</span>${labelBadge}`,
    `  </div>`,
    `</div>`,
    `<div class="latex-figure-preview flex flex-col items-center justify-center p-3 rounded-md bg-muted/20 border border-border/30 min-h-[140px] overflow-hidden">`,
    `  ${previewContent}`,
    `</div>`,
    `<figcaption class="mt-3 text-center text-xs text-muted-foreground flex flex-col items-center gap-1 font-sans">`,
    `  <div class="font-medium text-foreground">`,
    `    <span class="font-semibold text-primary mr-1">Figure:</span>`,
    `    <span class="latex-figure-caption-text">${escapeHtml(caption || 'No caption')}</span>`,
    `  </div>`,
    `</figcaption>`,
  ].join('\n');

  return `\n\n<figure class="latex-figure-wrapper my-6 p-4 border border-border rounded-md bg-card/60 backdrop-blur-xs hover:border-primary/50 cursor-pointer select-none group"${lineAttr} data-src="${encodeURIComponent(src)}" data-width="${encodeURIComponent(widthSpec)}" data-caption="${encodeURIComponent(caption)}" data-label="${encodeURIComponent(label)}" data-placement="${encodeURIComponent(placement)}" data-centering="${isCentering ? 'true' : 'false'}" data-starred="${isStarred ? 'true' : 'false'}">\n${figureInner}\n</figure>\n\n`;
}

/**
 * Environments that cannot be safely converted to rich-text and must be
 * preserved as immutable protected blocks in Visual Mode.
 */
const PROTECTED_ENVIRONMENTS = [
  'tikzpicture',
  'algorithm',
  'algorithmic',
  'lstlisting',
  'verbatim',
  'minted',
  'thebibliography',
  'proof',
  'theorem',
  'lemma',
  'corollary',
];

/**
 * Preamble-like / structural commands that are preserved verbatim as protected blocks
 * when they start a line of the body (child files, \maketitle, bibliography, macros...).
 */
const LINE_COMMAND_RE =
  /^[ \t]*\\(?:documentclass|usepackage|RequirePackage|newcommand|renewcommand|providecommand|DeclareMathOperator|DeclareRobustCommand|newenvironment|renewenvironment|newtheorem|def|gdef|edef|xdef|let|bibliography|bibliographystyle|addbibresource|printbibliography|maketitle|tableofcontents|listoffigures|listoftables|input|include|includeonly|appendix|newpage|clearpage|cleardoublepage|title|author|date|thanks|keywords|setlength|setcounter|graphicspath|hypersetup|pagestyle|thispagestyle|frontmatter|mainmatter|backmatter)(?![a-zA-Z])/gm;

const CITE_COMMANDS =
  'cite|citep|citet|citealp|citealt|citeauthor|citeyear|citeyearpar|Citep|Citet|Cite|autocite|Autocite|autocites|textcite|Textcite|parencite|Parencite|footcite|smartcite|supercite|nocite';

/** Returns the index just after the end of the line, extending over lines while braces are unbalanced. */
function scanBalancedToEol(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth = Math.max(0, depth - 1);
    else if (c === '\n' && depth === 0) return i;
  }
  return text.length;
}

/** Reads a balanced group starting at `i` (which must be `open`); returns index after it or -1. */
function readGroup(text: string, i: number, open: string, close: string): number {
  if (text[i] !== open) return -1;
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
}

/**
 * Replaces macro invocations (`re` must match `\name` globally) together with their
 * balanced optional `[..]` and mandatory `{..}` arguments.
 */
function replaceMacroCalls(text: string, re: RegExp, minBraceArgs: number, cb: (raw: string) => string): string {
  let out = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    let j = m.index + m[0].length;
    if (text[j] === '*') j++;
    let braceArgs = 0;
    for (;;) {
      if (text[j] === '[') {
        const e = readGroup(text, j, '[', ']');
        if (e === -1) break;
        j = e;
      } else if (text[j] === '{') {
        const e = readGroup(text, j, '{', '}');
        if (e === -1) break;
        j = e;
        braceArgs++;
      } else break;
    }
    if (braceArgs < minBraceArgs) continue;
    out += text.slice(pos, m.index) + cb(text.slice(m.index, j));
    pos = j;
    re.lastIndex = j;
  }
  return out + text.slice(pos);
}

/** Replaces every remaining `\begin{env}...\end{env}` (nesting aware) via `cb`. */
function replaceEnvironments(text: string, cb: (raw: string, env: string) => string): string {
  const re = /\\begin\{([^}]+)\}/g;
  let out = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tokRe = new RegExp(`\\\\(begin|end)\\{${esc}\\}`, 'g');
    tokRe.lastIndex = m.index + m[0].length;
    let depth = 1;
    let end = -1;
    let t: RegExpExecArray | null;
    while ((t = tokRe.exec(text)) !== null) {
      depth += t[1] === 'begin' ? 1 : -1;
      if (depth === 0) {
        end = t.index + t[0].length;
        break;
      }
    }
    if (end === -1) continue;
    out += text.slice(pos, m.index) + cb(text.slice(m.index, end), name);
    pos = end;
    re.lastIndex = end;
  }
  return out + text.slice(pos);
}

function protectedBlockHtml(raw: string, label: string, line: number): string {
  const block = raw.trim();
  return `<div class="latex-protected-block my-4 p-3 bg-muted/30 border border-border/80 rounded-md font-mono text-xs" data-line="${line}" data-raw-latex="${encodeURIComponent(block)}">
        <div class="flex items-center justify-between text-muted-foreground pb-2 border-b border-border/50 select-none">
          <span class="font-semibold text-foreground/80 flex items-center gap-1.5">LaTeX [${escapeHtml(label)}]</span>
          <div class="flex items-center gap-2">
            <button type="button" class="latex-protected-edit-btn text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded-sm cursor-pointer transition-colors">Edit Raw</button>
            <span class="text-11 bg-muted px-1.5 py-0.5 rounded-sm">Protected Block</span>
          </div>
        </div>
        <pre class="mt-2 text-foreground/90 whitespace-pre-wrap overflow-x-auto select-all">${escapeHtml(block)}</pre>
      </div>`;
}

function rawInlineHtml(raw: string, extraClass = ''): string {
  return `<span class="latex-raw-inline font-mono text-xs bg-muted/40 px-1 rounded-sm${extraClass ? ` ${extraClass}` : ''}" data-raw-latex="${encodeURIComponent(raw)}">${escapeHtml(raw)}</span>`;
}

/** Signature of the editable figure attributes, used to detect user edits. */
function figureSignature(attrs: string): string {
  return ['data-src', 'data-width', 'data-caption', 'data-label', 'data-placement', 'data-centering', 'data-starred']
    .map((a) => getAttr(attrs, a) ?? '')
    .join('\u0001');
}

/** Returns the body of a manuscript (between \begin{document} and \end{document}) or the whole text. */
function sliceDocumentBody(latex: string): string {
  const b = latex.indexOf('\\begin{document}');
  const e = latex.indexOf('\\end{document}');
  if (b !== -1 && e !== -1 && e > b) return latex.substring(b + '\\begin{document}'.length, e);
  return latex;
}

/**
 * Converts LaTeX manuscript source into HTML suitable for TipTap / Visual Editor.
 * Guarantees AST preservation of protected blocks, comments, and labels.
 * Attaches source data-line attributes to enable precision bidirectional SyncTeX.
 * Anything that cannot be represented as rich text is preserved verbatim so that
 * `htmlToLatex(latexToHtml(x), x)` reproduces `x`.
 */
export function latexToHtml(latex: string): string {
  if (!latex || !latex.trim()) return '<p></p>';

  const lineOffsets = buildLineOffsets(latex);
  let searchCursor = 0;
  const locate = (snippet: string): number => {
    const { line, nextSearchIndex } = findSourceLine(latex, lineOffsets, snippet, searchCursor);
    searchCursor = nextSearchIndex;
    return line;
  };

  const LT_TOKEN = '\u0001FLUXLT\u0001';
  const GT_TOKEN = '\u0001FLUXGT\u0001';
  const AMP_TOKEN = '\u0001FLUXAMP\u0001';
  // Generated HTML fragments are stashed behind placeholders so later passes never touch them.
  // `sources` remembers the original LaTeX of each placeholder so that a raw block captured
  // later (e.g. an \begin{abstract} containing math) is restored byte-for-byte.
  const store: string[] = [];
  const sources: string[] = [];
  const untok = (s: string): string => {
    let out = s;
    let prev: string;
    do {
      prev = out;
      out = out
        .replace(/\n\n\u0000B(\d+)\u0000\n\n/g, (_, i: string) => sources[Number(i)])
        .replace(/\u0000[BI](\d+)\u0000/g, (_, i: string) => sources[Number(i)]);
    } while (out !== prev);
    return out.replaceAll(LT_TOKEN, '<').replaceAll(GT_TOKEN, '>').replaceAll(AMP_TOKEN, '&');
  };
  const putBlock = (html: string, srcTok: string): string => {
    sources.push(untok(srcTok));
    store.push(html);
    return `\u0000B${store.length - 1}\u0000`;
  };
  const putInline = (html: string, srcTok: string): string => {
    sources.push(untok(srcTok));
    store.push(html);
    return `\u0000I${store.length - 1}\u0000`;
  };
  const rawBlock = (rawTok: string, label: string): string => {
    const raw = untok(rawTok);
    return putBlock(protectedBlockHtml(raw, label, locate(raw)), rawTok);
  };

  let text = sliceDocumentBody(latex)
    .trim()
    .replace(/&/g, AMP_TOKEN)
    .replace(/</g, LT_TOKEN)
    .replace(/>/g, GT_TOKEN);

  // 1. Protected complex environments (tikz, algorithms, listings, ...)
  for (const env of PROTECTED_ENVIRONMENTS) {
    const regex = new RegExp(`(\\\\begin\\{${env}\\}[\\s\\S]*?\\\\end\\{${env}\\})`, 'g');
    text = text.replace(regex, (_, block: string) => {
      const label = untok(block).match(/\\caption\{([^}]+)\}/)?.[1] || env;
      return rawBlock(block, label);
    });
  }

  // 2. Preamble-like / structural line commands (\maketitle, \bibliography, \newcommand, ...)
  {
    let out = '';
    let pos = 0;
    let m: RegExpExecArray | null;
    LINE_COMMAND_RE.lastIndex = 0;
    while ((m = LINE_COMMAND_RE.exec(text)) !== null) {
      const end = scanBalancedToEol(text, m.index);
      const raw = text.slice(m.index, end);
      const name = raw.trim().match(/^\\([a-zA-Z]+)/)?.[1] ?? 'command';
      out += text.slice(pos, m.index) + rawBlock(raw, name);
      pos = end;
      LINE_COMMAND_RE.lastIndex = Math.max(end, m.index + 1);
    }
    text = out + text.slice(pos);
  }

  // 3. URLs, hyperlinks and footnotes (may contain '%', '$', nested macros): verbatim inline
  text = replaceMacroCalls(text, /\\(?:url|href|footnote)(?![a-zA-Z])/g, 1, (raw) => {
    const r = untok(raw);
    const cls = r.startsWith('\\footnote') ? 'latex-footnote-token' : 'latex-url-token';
    return putInline(rawInlineHtml(r, cls), raw);
  });

  // 4. Tables
  text = text.replace(/\\begin\{(table\*?)\}[\s\S]*?\\end\{\1\}/g, (match) => {
    const raw = untok(match);
    const html = convertLatexTableToHtml(raw, locate(raw));
    return html ? putBlock(html, match) : rawBlock(match, 'table');
  });
  text = text.replace(/\\begin\{tabular\}[\s\S]*?\\end\{tabular\}/g, (match) => {
    const raw = untok(match);
    const html = convertLatexTableToHtml(raw, locate(raw));
    return html ? putBlock(html, match) : rawBlock(match, 'tabular');
  });

  // 5. Figures (single \includegraphics only; anything richer stays raw)
  text = text.replace(/\\begin\{(figure\*?)\}[\s\S]*?\\end\{\1\}/g, (match) => {
    const raw = untok(match);
    const simple =
      (raw.match(/\\includegraphics/g) || []).length === 1 &&
      !/\\begin\{(?!figure|center)/.test(raw.replace(/^\\begin\{figure\*?\}/, '')) &&
      !/(?<!\\)%/.test(raw);
    const html = simple ? convertLatexFigureToHtml(raw, locate(raw)) : '';
    if (!html) return rawBlock(match, 'figure');
    const open = html.match(/<figure([^>]*)>/);
    const sig = open ? figureSignature(open[1]) : '';
    return putBlock(
      html
        .trim()
        .replace('<figure ', `<figure data-raw-latex="${encodeURIComponent(raw.trim())}" data-sig="${encodeURIComponent(sig)}" `),
      match
    );
  });

  // 6. Display math
  const mathBlock = (rawMatch: string, env: string, mathTok: string): string => {
    const raw = untok(rawMatch);
    const cleanMath = untok(mathTok).trim();
    const rendered = renderMathHtml(cleanMath, true);
    return putBlock(
      `<div class="latex-math-block my-3 p-2 text-center bg-muted/10 rounded-md cursor-pointer" data-line="${locate(raw)}" data-env="${env}" data-math="${encodeURIComponent(cleanMath)}" data-raw-latex="${encodeURIComponent(raw)}" data-sig="${encodeURIComponent(cleanMath)}">${rendered}</div>`,
      rawMatch
    );
  };
  text = text.replace(
    /\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|flalign\*?|eqnarray\*?|displaymath|math)\}([\s\S]*?)\\end\{\1\}/g,
    (match, env: string, math: string) => mathBlock(match, env, math)
  );
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, math: string) => mathBlock(match, 'dollars', math));
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, math: string) => mathBlock(match, 'bracket', math));

  // 7. Comments (full-line and trailing), kept inline so line structure is unchanged
  text = text.replace(/(?<!\\)%[^\n]*/g, (match) => {
    const c = untok(match);
    return putInline(
      `<span class="latex-comment text-muted-foreground/70 italic text-xs select-none" data-line="${locate(c)}" data-latex-comment="${encodeURIComponent(c)}"><code>${escapeHtml(c)}</code></span>`,
      match
    );
  });

  // 8. Inline math: \( ... \) and $ ... $ (escaped dollars preserved)
  const mathInline = (match: string, mathTok: string, delim: string): string => {
    const cleanMath = untok(mathTok);
    const rendered = renderMathHtml(cleanMath.trim(), false);
    return putInline(
      `<span class="latex-math-inline inline-block px-1 py-0.5 bg-muted/20 rounded-sm cursor-pointer" data-delim="${delim}" data-math="${encodeURIComponent(cleanMath)}">${rendered}</span>`,
      match
    );
  };
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, math: string) => mathInline(match, math, 'paren'));
  text = text.replace(/(?<!\\)\$((?:[^$\\]|\\[\s\S])+?)\$/g, (match, math: string) => mathInline(match, math, 'dollar'));

  // 9. Any environment other than lists (abstract, center, ...) is preserved verbatim
  const LIST_ENVS = new Set(['itemize', 'enumerate']);
  text = replaceEnvironments(text, (raw, env) => (LIST_ENVS.has(env) ? raw : rawBlock(raw, env)));

  // 10. Simple lists; nested lists / \item[..] are preserved verbatim
  const listHtml = (tag: 'ul' | 'ol') => (match: string, inner: string) => {
    if (/\\begin\{|\\item\[/.test(inner)) return match;
    const items = inner
      .split(/\\item(?![a-zA-Z])\s*/)
      .slice(1)
      .map((i: string) => `<li>${i.trim()}</li>`)
      .join('');
    return `<${tag} data-line="${locate(untok(match))}" data-raw-latex="${encodeURIComponent(untok(match))}" data-sig="${PENDING_SIG}">${items}</${tag}>`;
  };
  text = text.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, listHtml('ul'));
  text = text.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, listHtml('ol'));
  text = replaceEnvironments(text, (raw, env) => rawBlock(raw, env));

  // 11. Citations (all natbib/biblatex variants, optional args preserved) and references
  text = text.replace(
    new RegExp(`\\\\(${CITE_COMMANDS})(\\*?)((?:\\[[^\\]]*\\]){0,2})\\{([^}]+)\\}`, 'g'),
    (match: string, cmd: string, star: string, opts: string, keys: string) => {
      const k = untok(keys);
      return putInline(
        `<span class="latex-citation-chip font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm inline-block" data-cite="${encodeURIComponent(k)}" data-cite-cmd="${cmd}${star}" data-cite-opts="${encodeURIComponent(untok(opts))}">[@${escapeHtml(k)}]</span>`,
        match
      );
    }
  );
  text = text.replace(/\\(ref|eqref|cref|Cref|autoref|pageref|nameref)\{([^}]+)\}/g, (match, cmd: string, key: string) => {
    const k = untok(key);
    return putInline(
      `<span class="latex-ref-chip font-mono text-xs bg-muted px-1.5 py-0.5 rounded-sm inline-block" data-ref="${encodeURIComponent(k)}" data-ref-cmd="${cmd}">[${escapeHtml(k)}]</span>`,
      match
    );
  });

  // 12. Sectioning (an immediately following \label is attached to the heading)
  const HEADINGS: Record<string, number> = { section: 1, subsection: 2, subsubsection: 3, paragraph: 4 };
  text = text.replace(
    /\\(section|subsection|subsubsection|paragraph)(\*?)\{([^{}]+)\}(\\label\{[^}]+\})?/g,
    (match, cmd: string, star: string, title: string, labelCmd?: string) => {
      const lvl = HEADINGS[cmd];
      const labelAttr = labelCmd ? ` data-label="${encodeURIComponent(untok(labelCmd.slice(7, -1)))}"` : '';
      return `<h${lvl} data-line="${locate(untok(match))}" data-cmd="${cmd}${star}"${labelAttr}>${title}</h${lvl}>`;
    }
  );

  // 13. Labels
  text = text.replace(/\\label\{([^}]+)\}/g, (match, labelKey: string) => {
    const k = untok(labelKey);
    return putInline(
      `<span class="latex-label-token inline-flex items-center text-11 font-mono bg-muted/60 text-muted-foreground px-1 py-0.5 rounded-sm ml-1 select-none" data-label="${encodeURIComponent(k)}">${escapeHtml(k)}</span>`,
      match
    );
  });

  // 14. Text styling (innermost first so nesting works)
  const STYLES: Record<string, string> = {
    textbf: '<strong>$1</strong>',
    textit: '<em>$1</em>',
    emph: '<em data-cmd="emph">$1</em>',
    underline: '<u>$1</u>',
    texttt: '<code>$1</code>',
    sout: '<s>$1</s>',
  };
  let prevText: string;
  do {
    prevText = text;
    for (const [cmd, repl] of Object.entries(STYLES)) {
      text = text.replace(new RegExp(`\\\\${cmd}\\{([^{}]*)\\}`, 'g'), repl);
    }
  } while (text !== prevText);

  // 15. Assemble blocks and paragraphs. The exact whitespace gap that preceded every
  // top-level block in the source is recorded in data-wsb so htmlToLatex can restore it
  // byte-for-byte (no invented paragraph breaks around display math, tables, ...).
  const wsAttr = (gap: string): string => ` data-wsb="${encodeURIComponent(gap)}"`;
  const withWs = (html: string, gap: string): string => html.trim().replace(/^<([a-zA-Z0-9]+)/, `<$1${wsAttr(gap)}`);
  const BLOCK_SPLIT = /(\u0000B\d+\u0000|<(?:h[1-4]|ul|ol)\s[\s\S]*?<\/(?:h[1-4]|ul|ol)>)/;
  const items: string[] = [];
  let gap = '';
  let paragraphSearchCursor = 0;
  text.split(BLOCK_SPLIT).forEach((part, idx) => {
    if (idx % 2 === 1) {
      const ph = part.match(/^\u0000B(\d+)\u0000$/);
      if (ph) store[Number(ph[1])] = withWs(store[Number(ph[1])], gap);
      items.push(ph ? part : withWs(part, gap));
      gap = '';
      return;
    }
    const pieces = part.split(/(\n[ \t]*\n\s*)/);
    pieces.forEach((piece, j) => {
      if (j % 2 === 1) {
        gap += piece;
        return;
      }
      const lead = piece.match(/^\s*/)?.[0] ?? '';
      const trail = piece.slice(lead.length).match(/\s*$/)?.[0] ?? '';
      const content = piece.slice(lead.length, piece.length - trail.length);
      gap += lead;
      if (content) {
        const rawSnippet = untok(content.replace(/\u0000[BI]\d+\u0000/g, '').replace(/<[^>]+>/g, ''))
          .trim()
          .slice(0, 40);
        const { line, nextSearchIndex } = findSourceLine(latex, lineOffsets, rawSnippet, paragraphSearchCursor);
        paragraphSearchCursor = nextSearchIndex;
        items.push(`<p data-line="${line}"${wsAttr(gap)}>${content.replace(/\n/g, '<br/>')}</p>`);
        gap = '';
      }
      gap += trail;
    });
  });
  const html = items
    .join('\n')
    .replaceAll(LT_TOKEN, '&lt;')
    .replaceAll(GT_TOKEN, '&gt;')
    .replaceAll(AMP_TOKEN, '&amp;');

  let result = html;
  let prevResult: string;
  do {
    prevResult = result;
    result = result.replace(/\u0000[BI](\d+)\u0000/g, (_, i: string) => store[Number(i)]);
  } while (result !== prevResult);
  for (const tag of ['ul', 'ol']) {
    result = replaceElements(
      result,
      tag,
      (a) => a.includes(PENDING_SIG),
      (attrs, inner) =>
        `<${tag}${attrs.replace(PENDING_SIG, encodeURIComponent(contentSig(inner)))}>${inner}</${tag}>`
    );
  }
  return result;
}

/**
 * Converts HTML from TipTap Visual Editor back into clean LaTeX syntax.
 * Restores protected blocks, labels, comments, and preambles with 100% fidelity.
 */
export function htmlToLatex(html: string, originalLatex?: string): string {
  if (!html || !html.trim()) return '';

  // LaTeX produced from opaque elements is stashed so tag stripping / entity decoding never alter it.
  const store: string[] = [];
  const put = (latex: string): string => {
    store.push(latex);
    return `\u0000P${store.length - 1}\u0000`;
  };
  const hasClass = (attrs: string, cls: string): boolean =>
    new RegExp(`(?:^|\\s)class="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"`).test(attrs);

  // Original whitespace gap preceding a top-level block (recorded by latexToHtml as data-wsb).
  const ws = (attrs: string): string => {
    const v = getAttr(attrs, 'data-wsb');
    return v === undefined ? '' : `\u0002${v}\u0002`;
  };

  let text = html;

  // 0. Lists whose content is unchanged return their original source verbatim
  for (const tag of ['ul', 'ol']) {
    text = replaceElements(
      text,
      tag,
      (a) => getAttr(a, 'data-raw-latex') !== undefined && getAttr(a, 'data-sig') !== undefined,
      (attrs, inner) => {
        const original = `<${tag}${attrs}>${inner}</${tag}>`;
        if (getDecodedAttr(attrs, 'data-sig') !== contentSig(inner)) return original.replace(/data-raw-latex="[^"]*"/, '');
        return `${ws(attrs)}\n\n${put(getDecodedAttr(attrs, 'data-raw-latex') ?? '')}\n\n`;
      }
    );
  }

  // 1. Figures (first: their preview markup contains nested div/span strings)
  text = replaceElements(
    text,
    'figure',
    (a) => hasClass(a, 'latex-figure-wrapper'),
    (attrs) => {
      const raw = getDecodedAttr(attrs, 'data-raw-latex');
      const sig = getDecodedAttr(attrs, 'data-sig');
      if (raw !== undefined && sig !== undefined && sig === figureSignature(attrs))
        return `${ws(attrs)}\n\n${put(raw)}\n\n`;

      const src = getDecodedAttr(attrs, 'data-src') ?? '';
      if (!src) return '';
      const widthSpec = getDecodedAttr(attrs, 'data-width') || '0.8\\linewidth';
      const caption = getDecodedAttr(attrs, 'data-caption') ?? '';
      const label = getDecodedAttr(attrs, 'data-label') ?? '';
      const placement = getDecodedAttr(attrs, 'data-placement') || 'htbp';
      const centeringAttr = getAttr(attrs, 'data-centering');
      const isCentering = centeringAttr === undefined ? true : centeringAttr === 'true';
      const isStarred = getAttr(attrs, 'data-starred') === 'true';
      const envName = isStarred ? 'figure*' : 'figure';
      const widthOption = widthSpec.startsWith('scale=') ? `[${widthSpec}]` : `[width=${widthSpec}]`;
      const lines: string[] = [`\\begin{${envName}}[${placement}]`];
      if (isCentering) lines.push('  \\centering');
      lines.push(`  \\includegraphics${widthOption}{${src}}`);
      if (caption) lines.push(`  \\caption{${caption}}`);
      if (label) lines.push(`  \\label{${label}}`);
      lines.push(`\\end{${envName}}`);
      return `${ws(attrs)}\n\n${put(lines.join('\n'))}\n\n`;
    }
  );

  // 2. Protected / raw blocks and raw inline fragments
  text = replaceElements(
    text,
    'div',
    (a) => hasClass(a, 'latex-protected-block') && getAttr(a, 'data-raw-latex') !== undefined,
    (attrs) => `${ws(attrs)}\n\n${put(getDecodedAttr(attrs, 'data-raw-latex') ?? '')}\n\n`
  );
  text = replaceElements(
    text,
    'span',
    (a) => hasClass(a, 'latex-raw-inline') && getAttr(a, 'data-raw-latex') !== undefined,
    (attrs) => put(getDecodedAttr(attrs, 'data-raw-latex') ?? '')
  );

  // 3. Comments (inline spans and legacy block divs)
  text = replaceElements(
    text,
    'span',
    (a) => getAttr(a, 'data-latex-comment') !== undefined,
    (attrs) => put(getDecodedAttr(attrs, 'data-latex-comment') ?? '')
  );
  text = replaceElements(
    text,
    'div',
    (a) => getAttr(a, 'data-latex-comment') !== undefined,
    (attrs) => `\n${put(getDecodedAttr(attrs, 'data-latex-comment') ?? '')}\n`
  );

  // 4. Tables (raw source reused when cells were not edited)
  text = replaceElements(
    text,
    'table',
    () => true,
    (attrs, inner) => {
      const latex = htmlTableToLatex(attrs, inner);
      return latex ? `${ws(attrs)}\n\n${put(latex)}\n\n` : '';
    }
  );

  // 5. Math blocks & inlines (environment / delimiter fidelity)
  text = replaceElements(
    text,
    'div',
    (a) => getAttr(a, 'data-math') !== undefined,
    (attrs) => {
      const decoded = getDecodedAttr(attrs, 'data-math') ?? '';
      const env = getAttr(attrs, 'data-env') || 'equation';
      const raw = getDecodedAttr(attrs, 'data-raw-latex');
      const pre = `${ws(attrs)}\n`;
      if (raw !== undefined && getDecodedAttr(attrs, 'data-sig') === decoded) return `${pre}${put(raw)}\n`;
      if (env === 'bracket') return `${pre}${put(`\\[\n  ${decoded}\n\\]`)}\n`;
      if (env === 'dollars') return `${pre}${put(`$\n  ${decoded}\n$`)}\n`;
      return `${pre}${put(`\\begin{${env}}\n  ${decoded}\n\\end{${env}}`)}\n`;
    }
  );
  text = replaceElements(
    text,
    'span',
    (a) => getAttr(a, 'data-math') !== undefined,
    (attrs) => {
      const decoded = getDecodedAttr(attrs, 'data-math') ?? '';
      return put(getAttr(attrs, 'data-delim') === 'paren' ? `\\(${decoded}\\)` : `$${decoded}$`);
    }
  );

  // 6. Citations, references, labels, URLs, footnotes
  text = replaceElements(
    text,
    'span',
    (a) => getAttr(a, 'data-cite') !== undefined,
    (attrs) => {
      const cmd = getAttr(attrs, 'data-cite-cmd') || 'cite';
      const opts = getDecodedAttr(attrs, 'data-cite-opts') ?? '';
      return put(`\\${cmd}${opts}{${getDecodedAttr(attrs, 'data-cite') ?? ''}}`);
    }
  );
  text = replaceElements(
    text,
    'span',
    (a) => getAttr(a, 'data-ref') !== undefined,
    (attrs) => put(`\\${getAttr(attrs, 'data-ref-cmd') || 'ref'}{${getDecodedAttr(attrs, 'data-ref') ?? ''}}`)
  );
  text = replaceElements(
    text,
    'span',
    (a) => hasClass(a, 'latex-label-token') && getAttr(a, 'data-label') !== undefined,
    (attrs) => put(`\\label{${getDecodedAttr(attrs, 'data-label') ?? ''}}`)
  );
  text = replaceElements(
    text,
    'span',
    (a) => getAttr(a, 'data-url') !== undefined,
    (attrs) => put(`\\url{${getDecodedAttr(attrs, 'data-url') ?? ''}}`)
  );
  text = replaceElements(
    text,
    'a',
    (a) => getAttr(a, 'data-href-url') !== undefined,
    (attrs) => put(`\\href{${getDecodedAttr(attrs, 'data-href-url') ?? ''}}{${getDecodedAttr(attrs, 'data-href-text') ?? ''}}`)
  );
  text = replaceElements(
    text,
    'sup',
    (a) => getAttr(a, 'data-footnote') !== undefined,
    (attrs) => put(`\\footnote{${getDecodedAttr(attrs, 'data-footnote') ?? ''}}`)
  );

  // 7. Sectioning
  const HEADING_CMDS = ['', 'section', 'subsection', 'subsubsection', 'paragraph'];
  for (let lvl = 1; lvl <= 4; lvl++) {
    text = replaceElements(
      text,
      `h${lvl}`,
      () => true,
      (attrs, inner) => {
        const cmd = getAttr(attrs, 'data-cmd') || HEADING_CMDS[lvl];
        const label = getDecodedAttr(attrs, 'data-label');
        return `${ws(attrs)}\n\n\\${cmd}{${inner}}${label ? put(`\\label{${label}}`) : ''}\n\n`;
      }
    );
  }

  // 8. Formatting (outermost first, repeated until stable)
  let prev: string;
  do {
    prev = text;
    text = replaceElements(text, 'strong', () => true, (_, i) => `\\textbf{${i}}`);
    text = replaceElements(text, 'b', () => true, (_, i) => `\\textbf{${i}}`);
    text = replaceElements(text, 'em', () => true, (a, i) =>
      getAttr(a, 'data-cmd') === 'emph' ? `\\emph{${i}}` : `\\textit{${i}}`
    );
    text = replaceElements(text, 'i', () => true, (_, i) => `\\textit{${i}}`);
    text = replaceElements(text, 'u', () => true, (_, i) => `\\underline{${i}}`);
    text = replaceElements(text, 'code', () => true, (_, i) => `\\texttt{${i}}`);
    text = replaceElements(text, 's', () => true, (_, i) => `\\sout{${i}}`);
  } while (text !== prev);

  // 9. Lists
  const listToLatex = (env: string) => (attrs: string, inner: string) => {
    const items: string[] = [];
    const liRe = /<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi;
    let li: RegExpExecArray | null;
    while ((li = liRe.exec(inner)) !== null) {
      const body = li[1]
        .replace(/<p(?:\s[^>]*)?>/gi, '')
        .replace(/<\/p>/gi, '')
        .trim();
      items.push(`  \\item ${body}`);
    }
    return `${ws(attrs)}\n\n\\begin{${env}}\n${items.join('\n')}\n\\end{${env}}\n\n`;
  };
  text = replaceElements(text, 'ul', () => true, listToLatex('itemize'));
  text = replaceElements(text, 'ol', () => true, listToLatex('enumerate'));

  // 10. Paragraphs and breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = replaceElements(text, 'p', () => true, (attrs, inner) => `${ws(attrs)}\n${inner}\n`);
  // Plain <div> lines created by contentEditable behave like paragraphs
  let prevDiv: string;
  do {
    prevDiv = text;
    text = replaceElements(text, 'div', () => true, (attrs, inner) => `${ws(attrs)}\n${inner}\n`);
  } while (text !== prevDiv);

  // Strip remaining unmatched HTML tags, then decode entities (&amp; last to avoid double decoding)
  text = decodeEntities(text.replace(/<[^>]+>/g, ''));

  // Clean up excess newlines, then restore stashed LaTeX verbatim
  let cleanedBody = text.replace(/\n{3,}/g, '\n\n');
  // Restore the recorded original gaps: a marker replaces all generated whitespace around it.
  cleanedBody = cleanedBody
    .replace(/\s*\u0002([^\u0002]*)\u0002\s*/g, (_, enc: string) => {
      try {
        return `\u0003${decodeURIComponent(enc)}\u0003`;
      } catch {
        return '\n\n';
      }
    })
    .trim()
    .replace(/^\u0003[^\u0003]*\u0003/, '')
    .replace(/\u0003([^\u0003]*)\u0003/g, '$1');
  let prevBody: string;
  do {
    prevBody = cleanedBody;
    cleanedBody = cleanedBody.replace(/\u0000P(\d+)\u0000/g, (_, i: string) => store[Number(i)]);
  } while (cleanedBody !== prevBody);

  // If original document had a full preamble, preserve it completely!
  if (originalLatex && originalLatex.includes('\\begin{document}')) {
    const beginDocIdx = originalLatex.indexOf('\\begin{document}');
    const endDocIdx = originalLatex.indexOf('\\end{document}');
    if (beginDocIdx !== -1 && endDocIdx !== -1) {
      const preambleStr = originalLatex.substring(0, beginDocIdx + '\\begin{document}'.length);
      const postambleStr = originalLatex.substring(endDocIdx);
      const originalBody = originalLatex.substring(beginDocIdx, endDocIdx);
      // \maketitle is normally kept in place inside the body; only re-insert it for legacy HTML.
      const needsMaketitle = originalBody.includes('\\maketitle') && !cleanedBody.includes('\\maketitle');
      const maketitleLine = needsMaketitle ? '\\maketitle\n\n' : '';
      const bodyRegion = originalLatex.substring(beginDocIdx + '\\begin{document}'.length, endDocIdx);
      const leadWs = bodyRegion.match(/^\s*/)?.[0] || '\n';
      const trailWs = bodyRegion.match(/\s*$/)?.[0] || '\n';
      return `${preambleStr}${leadWs}${maketitleLine}${cleanedBody}${trailWs}${postambleStr}`;
    }
  }

  return cleanedBody;
}
