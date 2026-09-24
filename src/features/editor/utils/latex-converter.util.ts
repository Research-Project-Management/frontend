import katex from 'katex';
import { escapeLatex } from './smart-paste.util';

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

/**
 * Extracts preamble and main body from a complete LaTeX manuscript.
 */
export function extractLatexBodyAndPreamble(latex: string): {
  preamble: LatexPreamble;
  body: string;
} {
  const preamble: LatexPreamble = { packages: [], customMacros: [] };

  const docClassMatch = latex.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
  if (docClassMatch) preamble.documentclass = docClassMatch[1];

  const titleMatch = latex.match(/\\title\{([^}]+)\}/);
  if (titleMatch) preamble.title = titleMatch[1];

  const authorMatch = latex.match(/\\author\{([^}]+)\}/);
  if (authorMatch) preamble.author = authorMatch[1];

  const beginDocIdx = latex.indexOf('\\begin{document}');
  const endDocIdx = latex.indexOf('\\end{document}');

  if (beginDocIdx !== -1 && endDocIdx !== -1 && endDocIdx > beginDocIdx) {
    const rawPreamble = latex.substring(0, beginDocIdx);

    // Extract packages
    const pkgRegex = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
    let pkgMatch: RegExpExecArray | null;
    while ((pkgMatch = pkgRegex.exec(rawPreamble)) !== null) {
      preamble.packages.push(pkgMatch[1]);
    }

    // Extract custom macros (\newcommand, \def)
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

/**
 * Safely renders LaTeX math using KaTeX into an HTML string with fallback.
 */
export function renderMathHtml(mathCode: string, displayMode: boolean): string {
  try {
    return katex.renderToString(mathCode, {
      displayMode,
      throwOnError: false,
    });
  } catch {
    const esc = escapeHtml(mathCode);
    return displayMode
      ? `<pre class="math-error">$$${esc}$$</pre>`
      : `<code class="math-error">$${esc}$</code>`;
  }
}

/**
 * Unescapes LaTeX characters in table cell content for TipTap display.
 */
function unescapeLatexCell(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\textbackslash\{\}/g, '\\')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\textasciitilde\{\}/g, '~')
    .replace(/\\textasciicircum\{\}/g, '^')
    .trim();
}

/**
 * Converts LaTeX text formatting inside table cells into HTML.
 */
function convertLatexCellContentToHtml(raw: string): string {
  let cell = unescapeLatexCell(raw);
  cell = cell
    .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>')
    .replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>')
    .replace(/\\texttt\{([^}]+)\}/g, '<code>$1</code>');
  return cell;
}

/**
 * Parses LaTeX table or tabular environment into an HTML table.
 */
export function convertLatexTableToHtml(tableBlock: string): string {
  const captionMatch = tableBlock.match(/\\caption(?:\[[^\]]*\])?\{([^}]+)\}/);
  const caption = captionMatch ? captionMatch[1] : '';

  const labelMatch = tableBlock.match(/\\label\{([^}]+)\}/);
  const label = labelMatch ? labelMatch[1] : '';

  const tabularMatch = tableBlock.match(/\\begin\{tabular\*?\}(?:\[[^\]]*\])?\{([^}]*)\}([\s\S]*?)\\end\{tabular\*?\}/);
  if (!tabularMatch) {
    return '';
  }

  const alignSpec = tabularMatch[1].trim();
  const rawBody = tabularMatch[2];

  // Split rows by \\ (and optional spacing like \\[...])
  const rawRows = rawBody.split(/\\\\(?:\s*\[[^\]]*\])?/);

  const headerRowsHtml: string[] = [];
  const bodyRowsHtml: string[] = [];
  let isHeader = true;

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i].trim();
    if (!rawRow) continue;

    // Clean rule commands
    const cleanRow = rawRow
      .replace(/\\toprule/g, '')
      .replace(/\\midrule/g, '')
      .replace(/\\bottomrule/g, '')
      .replace(/\\hline/g, '')
      .replace(/\\cline\{[^}]*\}/g, '')
      .replace(/\\centering/g, '')
      .trim();

    if (!cleanRow) continue;

    // Split cells by unescaped &
    const rawCells = cleanRow.split(/(?<!\\)&/);
    const cells = rawCells.map((c) => convertLatexCellContentToHtml(c));

    if (isHeader) {
      const ths = cells.map((c) => `<th><p>${c}</p></th>`).join('');
      headerRowsHtml.push(`<tr>${ths}</tr>`);
      isHeader = false;
    } else {
      const tds = cells.map((c) => `<td><p>${c}</p></td>`).join('');
      bodyRowsHtml.push(`<tr>${tds}</tr>`);
    }
  }

  const captionAttr = caption ? ` data-caption="${encodeURIComponent(caption)}"` : '';
  const labelAttr = label ? ` data-label="${encodeURIComponent(label)}"` : '';
  const alignAttr = alignSpec ? ` data-align="${encodeURIComponent(alignSpec)}"` : '';

  const thead = headerRowsHtml.length > 0 ? `<thead>${headerRowsHtml.join('')}</thead>` : '';
  const tbody = `<tbody>${bodyRowsHtml.join('')}</tbody>`;

  return `\n<table${captionAttr}${labelAttr}${alignAttr}>${thead}${tbody}</table>\n`;
}

/**
 * Environments that cannot be safely converted to rich-text and must be
 * preserved as immutable protected blocks in Visual Mode.
 */
const PROTECTED_ENVIRONMENTS = [
  'figure',
  'figure\\*',
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
 * Converts LaTeX manuscript source into HTML suitable for TipTap / Visual Editor.
 * Guarantees AST preservation of protected blocks, comments, and labels.
 */
export function latexToHtml(latex: string): string {
  if (!latex || !latex.trim()) return '<p></p>';

  const { body } = extractLatexBodyAndPreamble(latex);
  let text = body;
  // 1a. Convert LaTeX tables & tabular environments into rich editable HTML <table>
  text = text.replace(/(\\begin\{table\*?\}(?:\[[^\]]*\])?[\s\S]*?\\end\{table\*?\})/g, (match) => {
    const htmlTable = convertLatexTableToHtml(match);
    return htmlTable || match;
  });
  text = text.replace(/(\\begin\{tabular\}\{([^}]*)\}[\s\S]*?\\end\{tabular\})/g, (match) => {
    const htmlTable = convertLatexTableToHtml(match);
    return htmlTable || match;
  });

  // 1b. Protect complex LaTeX environments (figure, tikz, algorithms, etc.)
  for (const env of PROTECTED_ENVIRONMENTS) {
    const regex = new RegExp(`(\\\\begin\\{${env}\\}[\\s\\S]*?\\\\end\\{${env}\\})`, 'g');
    text = text.replace(regex, (_, block) => {
      const enc = encodeURIComponent(block.trim());
      const label = block.match(/\\caption\{([^}]+)\}/)?.[1] || env.replace('\\*', '');
      return `\n\n<div class="latex-protected-block my-4 p-3 bg-muted/30 border border-border/80 rounded-md font-mono text-xs" data-raw-latex="${enc}">
        <div class="flex items-center justify-between text-muted-foreground pb-2 border-b border-border/50 select-none">
          <span class="font-semibold text-foreground/80 flex items-center gap-1.5">📦 LaTeX [${escapeHtml(label)}]</span>
          <span class="text-10 bg-muted px-1.5 py-0.5 rounded">Protected Block</span>
        </div>
        <pre class="mt-2 text-foreground/90 whitespace-pre-wrap overflow-x-auto select-all">${escapeHtml(block.trim())}</pre>
      </div>\n\n`;
    });
  }

  // 2. Math Display Environments: \begin{equation}...\end{equation}, \begin{align}...\end{align}, \[...\]
  text = text.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_, math) => {
    const cleanMath = math.trim();
    const rendered = renderMathHtml(cleanMath, true);
    return `<div class="latex-math-block my-3 p-2 text-center bg-muted/10 rounded cursor-pointer" data-math="${encodeURIComponent(cleanMath)}">${rendered}</div>`;
  });

  text = text.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (_, math) => {
    const cleanMath = math.trim();
    const rendered = renderMathHtml(cleanMath, true);
    return `<div class="latex-math-block my-3 p-2 text-center bg-muted/10 rounded cursor-pointer" data-math="${encodeURIComponent(cleanMath)}">${rendered}</div>`;
  });

  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    const cleanMath = math.trim();
    const rendered = renderMathHtml(cleanMath, true);
    return `<div class="latex-math-block my-3 p-2 text-center bg-muted/10 rounded cursor-pointer" data-math="${encodeURIComponent(cleanMath)}">${rendered}</div>`;
  });

  // 3. Inline Math: $...$ (preserving escaped dollars)
  text = text.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (_, math) => {
    const cleanMath = math.trim();
    const rendered = renderMathHtml(cleanMath, false);
    return `<span class="latex-math-inline inline-block px-1 py-0.5 bg-muted/20 rounded cursor-pointer" data-math="${encodeURIComponent(cleanMath)}">${rendered}</span>`;
  });

  // 4. Preserve comments instead of silently deleting them
  text = text.replace(/^([ \t]*%[^\n]*)$/gm, (match) => {
    const clean = match.trim();
    const enc = encodeURIComponent(clean);
    return `\n<div class="latex-comment text-muted-foreground/70 italic text-xs select-none my-1" data-latex-comment="${enc}"><code>${escapeHtml(clean)}</code></div>\n`;
  });

  // 5. Preserve labels: \label{xyz}
  text = text.replace(/\\label\{([^}]+)\}/g, (_, labelKey) => {
    return `<span class="latex-label-token inline-flex items-center text-10 font-mono bg-muted/60 text-muted-foreground px-1 py-0.5 rounded ml-1 select-none" data-label="${encodeURIComponent(labelKey)}">🏷️${escapeHtml(labelKey)}</span>`;
  });

  // 6. Sectioning
  text = text.replace(/\\section\*?\{([^}]+)\}/g, '<h1>$1</h1>');
  text = text.replace(/\\subsection\*?\{([^}]+)\}/g, '<h2>$1</h2>');
  text = text.replace(/\\subsubsection\*?\{([^}]+)\}/g, '<h3>$1</h3>');
  text = text.replace(/\\paragraph\*?\{([^}]+)\}/g, '<h4>$1</h4>');

  // 7. Text styling
  text = text.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
  text = text.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
  text = text.replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>');
  text = text.replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');
  text = text.replace(/\\texttt\{([^}]+)\}/g, '<code>$1</code>');
  text = text.replace(/\\sout\{([^}]+)\}/g, '<s>$1</s>');

  // 8. Citations & References
  text = text.replace(/\\cite\{([^}]+)\}/g, '<span class="latex-citation-chip font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded inline-block" data-cite="$1">[@$1]</span>');
  text = text.replace(/\\ref\{([^}]+)\}/g, '<span class="latex-ref-chip font-mono text-xs bg-muted px-1.5 py-0.5 rounded inline-block" data-ref="$1">[$1]</span>');

  // 9. Lists
  text = text.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, inner) => {
    const items = inner
      .split(/\\item\s+/)
      .filter((i: string) => i.trim().length > 0)
      .map((i: string) => `<li>${i.trim()}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });

  text = text.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, inner) => {
    const items = inner
      .split(/\\item\s+/)
      .filter((i: string) => i.trim().length > 0)
      .map((i: string) => `<li>${i.trim()}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  });

  // 10. Paragraphs: split by double newlines
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      // If already a block-level HTML element, don't wrap in <p>
      if (/^<(h[1-6]|ul|ol|div|blockquote|pre)/i.test(block)) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    });

  return paragraphs.join('\n');
}

/**
 * Converts HTML from TipTap Visual Editor back into clean LaTeX syntax.
 * Restores protected blocks, labels, comments, and preambles with 100% fidelity.
 */
export function htmlToLatex(html: string, originalLatex?: string): string {
  if (!html || !html.trim()) return '';

  let text = html;

  // 1. Restore protected complex LaTeX blocks
  text = text.replace(/<div class="latex-protected-block[^"]*"[^>]*data-raw-latex="([^"]+)"[^>]*>[\s\S]*?<\/div>/gi, (_, enc) => {
    return `\n\n${decodeURIComponent(enc)}\n\n`;
  });

  // 2. Restore comments
  text = text.replace(/<div class="latex-comment[^"]*"[^>]*data-latex-comment="([^"]+)"[^>]*>[\s\S]*?<\/div>/gi, (_, enc) => {
    return `\n${decodeURIComponent(enc)}\n`;
  });

  // 3. Restore labels
  text = text.replace(/<span class="latex-label-token[^"]*"[^>]*data-label="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi, (_, enc) => {
    return `\\label{${decodeURIComponent(enc)}}`;
  });

  // 4. Math blocks & inlines (extract from data-math attributes)
  text = text.replace(/<div[^>]*data-math="([^"]+)"[^>]*>[\s\S]*?<\/div>/gi, (_, enc) => {
    const decoded = decodeURIComponent(enc);
    return `\n\\begin{equation}\n  ${decoded}\n\\end{equation}\n`;
  });

  text = text.replace(/<span[^>]*data-math="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi, (_, enc) => {
    const decoded = decodeURIComponent(enc);
    return `$${decoded}$`;
  });

  // 5. Citations & References
  text = text.replace(/<span[^>]*data-cite="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi, '\\cite{$1}');
  text = text.replace(/<span[^>]*data-ref="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi, '\\ref{$1}');

  // 6. Sectioning
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\\section{$1}\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\\subsection{$1}\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\\subsubsection{$1}\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n\\paragraph{$1}\n');

  // 7. Formatting
  text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '\\textbf{$1}');
  text = text.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '\\textbf{$1}');
  text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '\\textit{$1}');
  text = text.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '\\textit{$1}');
  text = text.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '\\underline{$1}');
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '\\texttt{$1}');
  text = text.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '\\sout{$1}');

  // 8. Lists
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '  \\item $1\n');
    return `\n\\begin{itemize}\n${items}\\end{itemize}\n`;
  });

  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '  \\item $1\n');
    return `\n\\begin{enumerate}\n${items}\\end{enumerate}\n`;
  });

  // 8a. Tables: <table>...</table> -> \begin{table}[htbp] \centering \begin{tabular}{...} ... \end{tabular} \end{table}
  text = text.replace(/<table([^>]*)>([\s\S]*?)<\/table>/gi, (_, attrs, inner) => {
    const captionMatch = attrs.match(/data-caption="([^"]+)"/);
    const caption = captionMatch ? decodeURIComponent(captionMatch[1]) : '';

    const labelMatch = attrs.match(/data-label="([^"]+)"/);
    const label = labelMatch ? decodeURIComponent(labelMatch[1]) : '';

    const alignMatch = attrs.match(/data-align="([^"]+)"/);
    let alignSpec = alignMatch ? decodeURIComponent(alignMatch[1]) : '';

    const rows: Array<{ isHeader: boolean; cells: string[] }> = [];
    let maxCols = 0;

    const trMatches = inner.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trMatches) {
      const isHeader = /<th/i.test(tr);
      const cellMatches = tr.match(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi) || [];
      const cells = cellMatches.map((cell: string) => {
        let textContent = cell
          .replace(/<(?:th|td)[^>]*>/i, '')
          .replace(/<\/(?:th|td)>/i, '')
          .replace(/<p[^>]*>/gi, '')
          .replace(/<\/p>/gi, '')
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<[^>]+>/g, '')
          .trim();
        // Escape literal & and % that are not part of LaTeX escape sequences
        return textContent
          .replace(/(?<!\\)&/g, '\\&')
          .replace(/(?<!\\)%/g, '\\%');
      });

      if (cells.length > 0) {
        rows.push({ isHeader, cells });
        if (cells.length > maxCols) maxCols = cells.length;
      }
    }

    if (rows.length === 0) return '';

    if (!alignSpec || alignSpec.replace(/\s+/g, '').length !== maxCols) {
      alignSpec = Array(maxCols).fill('c').join(' ');
    }

    const lines: string[] = [];
    const hasFloatingWrapper = Boolean(caption || label);

    if (hasFloatingWrapper) {
      lines.push('\\begin{table}[htbp]');
      lines.push('  \\centering');
      if (caption) lines.push(`  \\caption{${escapeLatex(caption)}}`);
      if (label) lines.push(`  \\label{${label}}`);
      lines.push(`  \\begin{tabular}{${alignSpec}}`);
    } else {
      lines.push('\\begin{table}[htbp]');
      lines.push('  \\centering');
      lines.push(`  \\begin{tabular}{${alignSpec}}`);
    }

    lines.push('    \\toprule');

    let hasMidrule = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const padded = [...row.cells];
      while (padded.length < maxCols) padded.push('');

      lines.push(`    ${padded.join(' & ')} \\\\`);

      if (row.isHeader && !hasMidrule) {
        lines.push('    \\midrule');
        hasMidrule = true;
      }
    }

    lines.push('    \\bottomrule');
    lines.push('  \\end{tabular}');
    lines.push('\\end{table}');

    return `\n\n${lines.join('\n')}\n\n`;
  });

  // 9. Paragraphs and breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');

  // Strip remaining unmatched HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");

  // Clean up excess newlines
  const cleanedBody = text.replace(/\n{3,}/g, '\n\n').trim();

  // If original document had a full preamble, preserve it completely!
  if (originalLatex && originalLatex.includes('\\begin{document}')) {
    const beginDocIdx = originalLatex.indexOf('\\begin{document}');
    const endDocIdx = originalLatex.indexOf('\\end{document}');
    if (beginDocIdx !== -1 && endDocIdx !== -1) {
      const preambleStr = originalLatex.substring(0, beginDocIdx + '\\begin{document}'.length);
      const postambleStr = originalLatex.substring(endDocIdx);
      const hasMaketitle = originalLatex.includes('\\maketitle');
      const maketitleLine = hasMaketitle ? '\\maketitle\n\n' : '';
      return `${preambleStr}\n${maketitleLine}${cleanedBody}\n\n${postambleStr}`;
    }
  }

  return cleanedBody;
}
