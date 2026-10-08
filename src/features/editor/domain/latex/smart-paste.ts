/**
 * smart-paste.ts
 *
 * Utilities to detect and convert clipboard data into LaTeX structures:
 * 1. Tabular data (Excel, Google Sheets, LibreOffice Calc, HTML tables, TSV/CSV)
 *    -> Converted to LaTeX `\begin{table} \begin{tabular} ... \end{tabular} \end{table}`
 * 2. Image data (Screenshots, copied image files)
 *    -> Extracted as File object for asset upload and inserted as `\begin{figure}`
 */

/**
 * Escapes characters that have special meaning in LaTeX text mode.
 */
export function escapeLatex(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Checks if the clipboard contains tabular data (either HTML <table> or multi-line TSV).
 */
export function isTableData(clipboardData: DataTransfer): boolean {
  if (!clipboardData) return false;

  // 1. Check for HTML <table>
  const html = clipboardData.getData('text/html');
  if (html && /<table[\s>]/i.test(html) && /<tr[\s>]/i.test(html)) {
    return true;
  }

  // 2. Check for plain text TSV (at least 2 lines, at least 1 tab on first or second line)
  const plain = clipboardData.getData('text/plain');
  if (plain) {
    const lines = plain.trim().split(/\r?\n/);
    if (lines.length >= 2) {
      const tabCounts = lines.slice(0, 3).map((line) => (line.match(/\t/g) || []).length);
      const hasTabs = tabCounts.some((count) => count >= 1);
      if (hasTabs) {
        return true;
      }
    }
  }

  return false;
}

export interface TableParseOptions {
  booktabs?: boolean;
  caption?: string;
  label?: string;
  alignment?: 'center' | 'left' | 'right';
}

interface ParsedTableGrid {
  headers: string[];
  rows: string[][];
  maxCols: number;
}

/**
 * Parses an HTML string containing a <table> element into a 2D matrix of text.
 */
function parseHtmlTable(html: string): ParsedTableGrid {
  const rows: string[][] = [];
  const headers: string[] = [];
  let maxCols = 0;

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const trElements = doc.querySelectorAll('tr');

    trElements.forEach((tr, rowIndex) => {
      const cells: string[] = [];
      const thOrTd = tr.querySelectorAll('th, td');
      thOrTd.forEach((cell) => {
        cells.push(cell.textContent?.trim() || '');
      });

      if (cells.length > 0) {
        if (rowIndex === 0 && tr.querySelector('th')) {
          headers.push(...cells);
        } else {
          rows.push(cells);
        }
        if (cells.length > maxCols) {
          maxCols = cells.length;
        }
      }
    });

    if (headers.length > 0 && headers.length > maxCols) {
      maxCols = headers.length;
    }
  }

  return { headers, rows, maxCols };
}

/**
 * Parses plain text TSV (tab-separated values) into a 2D matrix.
 */
function parseTsvTable(plain: string): ParsedTableGrid {
  const lines = plain.trim().split(/\r?\n/);
  const allRows: string[][] = [];
  let maxCols = 0;

  for (const line of lines) {
    const cells = line.split('\t').map((c) => c.trim());
    allRows.push(cells);
    if (cells.length > maxCols) {
      maxCols = cells.length;
    }
  }

  if (allRows.length === 0) {
    return { headers: [], rows: [], maxCols: 0 };
  }

  // Treat first row as header if there are at least 2 rows
  const headers = allRows.length > 1 ? allRows[0] : [];
  const rows = allRows.length > 1 ? allRows.slice(1) : allRows;

  return { headers, rows, maxCols };
}

/**
 * Converts clipboard tabular data into a formatted LaTeX table.
 */
export function parseTableToLatex(
  clipboardData: DataTransfer,
  options: TableParseOptions = {},
): string {
  const {
    booktabs = true,
    caption = 'Auto-generated table',
    label = 'tab:table-1',
    alignment = 'center',
  } = options;

  let grid: ParsedTableGrid = { headers: [], rows: [], maxCols: 0 };

  const html = clipboardData.getData('text/html');
  if (html && /<table[\s>]/i.test(html)) {
    grid = parseHtmlTable(html);
  }

  // Fallback to TSV if HTML didn't produce a grid
  if (grid.maxCols === 0) {
    const plain = clipboardData.getData('text/plain');
    if (plain) {
      grid = parseTsvTable(plain);
    }
  }

  if (grid.maxCols === 0) {
    return '';
  }

  const colAlign = alignment === 'center' ? 'c' : alignment === 'left' ? 'l' : 'r';
  const alignSpec = Array(grid.maxCols).fill(colAlign).join(' ');

  const formatRow = (cells: string[]) => {
    const padded = [...cells];
    while (padded.length < grid.maxCols) {
      padded.push('');
    }
    return '    ' + padded.map((c) => escapeLatex(c)).join(' & ') + ' \\\\';
  };

  const lines: string[] = [];
  lines.push('\\begin{table}[htbp]');
  lines.push('  \\centering');
  lines.push(`  \\caption{${escapeLatex(caption)}}`);
  lines.push(`  \\label{${label}}`);
  lines.push(`  \\begin{tabular}{${alignSpec}}`);

  if (booktabs) {
    lines.push('    \\toprule');
    if (grid.headers.length > 0) {
      lines.push(formatRow(grid.headers));
      lines.push('    \\midrule');
    }
    for (const row of grid.rows) {
      lines.push(formatRow(row));
    }
    lines.push('    \\bottomrule');
  } else {
    lines.push('    \\hline');
    if (grid.headers.length > 0) {
      lines.push(formatRow(grid.headers));
      lines.push('    \\hline');
    }
    for (const row of grid.rows) {
      lines.push(formatRow(row));
    }
    lines.push('    \\hline');
  }

  lines.push('  \\end{tabular}');
  lines.push('\\end{table}');

  return lines.join('\n');
}

/**
 * Checks if the clipboard contains image data.
 */
export function isImageData(clipboardData: DataTransfer): boolean {
  if (!clipboardData) return false;

  // Check items
  if (clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      if (clipboardData.items[i].type.startsWith('image/')) {
        return true;
      }
    }
  }

  // Check files
  if (clipboardData.files) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      if (clipboardData.files[i].type.startsWith('image/')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extracts a File object for the image in the clipboard, assigning a normalized filename.
 */
export function extractImageFile(clipboardData: DataTransfer): File | null {
  if (!clipboardData) return null;

  let file: File | null = null;

  if (clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.startsWith('image/')) {
        file = item.getAsFile();
        if (file) break;
      }
    }
  }

  if (!file && clipboardData.files) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const f = clipboardData.files[i];
      if (f.type.startsWith('image/')) {
        file = f;
        break;
      }
    }
  }

  if (!file) return null;

  // If filename is generic (e.g. 'image.png' from clipboard), give it a timestamped name
  const ext = file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg' : 'png';
  let safeName = file.name;
  if (!safeName || safeName === 'image.png' || safeName === 'blob') {
    safeName = `pasted-image-${Date.now()}.${ext}`;
  } else {
    // Sanitize spaces and special chars
    safeName = safeName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  return new File([file], safeName, { type: file.type });
}

/**
 * Generates standard LaTeX `figure` snippet for an image asset.
 */
export function generateFigureLatex(filename: string, caption?: string): string {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const cleanCaption = caption || baseName.replace(/[-_]/g, ' ');
  const label = `fig:${baseName.toLowerCase()}`;

  return [
    '\\begin{figure}[htbp]',
    '  \\centering',
    `  \\includegraphics[width=0.8\\linewidth]{${filename}}`,
    `  \\caption{${escapeLatex(cleanCaption)}}`,
    `  \\label{${label}}`,
    '\\end{figure}',
  ].join('\n');
}

/**
 * Checks if the clipboard contains rich formatted text (headings, bold, italic, lists, quotes, links).
 * Excludes plain wrappers like <html><body><div>plain text</div></body></html>.
 */
export function isRichTextHtml(clipboardData: DataTransfer): boolean {
  if (!clipboardData) return false;
  const html = clipboardData.getData('text/html');
  if (!html) return false;

  // Match presence of semantic formatting tags
  return /<(h[1-6]|strong|b|em|i|u|s|del|strike|code|pre|ul|ol|blockquote|a\s+href)[\s>]/i.test(
    html,
  );
}

/**
 * Converts rich text HTML from Word, Google Docs, Apple Pages, or web into clean, semantic LaTeX markup.
 * Strict Overleaf specification:
 * - H1..H3 -> \section, \subsection, \subsubsection
 * - Bold / Italic / Underline / Strike / Code -> \textbf, \textit, \underline, \sout, \texttt
 * - Lists -> \begin{itemize}, \begin{enumerate}
 * - Quotes -> \begin{quote}
 * - Links -> \href{url}{text}
 */
export function parseHtmlToLatex(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  if (!body) return '';

  function convertNode(node: Node, inPre = false): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      return inPre ? text : escapeLatex(text);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Check style-based formatting (Google Docs / Word often uses <span style="font-weight: 700">)
    const style = el.getAttribute('style') || '';
    const isBoldStyle = /font-weight:\s*(bold|[7-9]00)/i.test(style);
    const isItalicStyle = /font-style:\s*italic/i.test(style);
    const isUnderlineStyle = /text-decoration:\s*underline/i.test(style);

    const convertChildren = (targetNode: Node = el, preservePre = inPre): string => {
      let result = '';
      targetNode.childNodes.forEach((child) => {
        result += convertNode(child, preservePre);
      });
      return result;
    };

    let innerText = '';

    switch (tag) {
      case 'h1':
        return `\n\n\\section{${convertChildren().trim()}}\n`;
      case 'h2':
        return `\n\n\\subsection{${convertChildren().trim()}}\n`;
      case 'h3':
        return `\n\n\\subsubsection{${convertChildren().trim()}}\n`;
      case 'h4':
      case 'h5':
      case 'h6':
        return `\n\n\\paragraph{${convertChildren().trim()}}\n`;

      case 'strong':
      case 'b':
        innerText = convertChildren().trim();
        return innerText ? `\\textbf{${innerText}}` : '';

      case 'em':
      case 'i':
        innerText = convertChildren().trim();
        return innerText ? `\\textit{${innerText}}` : '';

      case 'u':
        innerText = convertChildren().trim();
        return innerText ? `\\underline{${innerText}}` : '';

      case 's':
      case 'del':
      case 'strike':
        innerText = convertChildren().trim();
        return innerText ? `\\sout{${innerText}}` : '';

      case 'code':
        return `\\texttt{${el.textContent || ''}}`;

      case 'pre':
        return `\n\\begin{verbatim}\n${el.textContent || ''}\n\\end{verbatim}\n`;

      case 'ul': {
        const items = convertChildren().trim();
        return items ? `\n\\begin{itemize}\n${items}\n\\end{itemize}\n` : '';
      }

      case 'ol': {
        const items = convertChildren().trim();
        return items ? `\n\\begin{enumerate}\n${items}\n\\end{enumerate}\n` : '';
      }

      case 'li': {
        const content = convertChildren().trim();
        return content ? `  \\item ${content}\n` : '';
      }

      case 'blockquote': {
        const quote = convertChildren().trim();
        return quote ? `\n\\begin{quote}\n${quote}\n\\end{quote}\n` : '';
      }

      case 'a': {
        const href = el.getAttribute('href') || '';
        const text = convertChildren().trim();
        if (!href) return text;
        return text ? `\\href{${href}}{${text}}` : `\\url{${href}}`;
      }

      case 'p': {
        const pContent = convertChildren().trim();
        return pContent ? `\n\n${pContent}\n\n` : '';
      }

      case 'br':
        return '\n';

      default: {
        let content = convertChildren();
        if (isBoldStyle) content = `\\textbf{${content}}`;
        if (isItalicStyle) content = `\\textit{${content}}`;
        if (isUnderlineStyle) content = `\\underline{${content}}`;
        return content;
      }
    }
  }

  const result = convertNode(body).trim();
  // Normalize redundant empty lines (max 2 newlines)
  return result.replace(/\n{3,}/g, '\n\n');
}
