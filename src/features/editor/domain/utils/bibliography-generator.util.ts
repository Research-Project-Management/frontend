/**
 * bibliography-generator.util.ts
 *
 * Domain utilities for generating and injecting formatted reference sections
 * into Markdown and LaTeX manuscripts/outlines.
 */

/**
 * Detects whether a document is LaTeX or Markdown based on file extension and syntax markers.
 */
export function isLatexDocument(content: string, filePath?: string): boolean {
  if (filePath) {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.endsWith('.tex') || lowerPath.endsWith('.latex')) {
      return true;
    }
    if (lowerPath.endsWith('.md') || lowerPath.endsWith('.markdown') || lowerPath.endsWith('.qmd')) {
      return false;
    }
  }

  if (!content) return false;

  // LaTeX structural signatures
  const latexMarkers = [
    /\\documentclass/i,
    /\\begin\{document\}/i,
    /\\section\*?\{/i,
    /\\usepackage/i,
    /\\begin\{thebibliography\}/i,
  ];

  return latexMarkers.some((regex) => regex.test(content));
}

/**
 * Intelligently detects the appropriate citation style mode ('auto' or 'auto-numeric')
 * from the manuscript's file path, format, and citation markers.
 */
export function detectDocumentCitationStyle(
  content: string,
  filePath?: string,
): 'auto' | 'auto-numeric' {
  if (isLatexDocument(content, filePath)) {
    return 'auto-numeric';
  }

  if (!content) return 'auto';

  // Check for numeric citation markers in Markdown, e.g. [1], [2], [1-3]
  const numericPattern = /\[\d+(?:[,\s-]+\d+)*\]/;
  if (numericPattern.test(content)) {
    return 'auto-numeric';
  }

  return 'auto';
}

export interface BuildBibliographyOptions {
  bibliographyText: string;
  format: 'markdown' | 'latex';
  styleId?: string;
  headingTitle?: string;
  citations?: Array<{
    key?: string;
    inText?: string;
    bibliography?: string;
  }>;
}

/**
 * Builds a clean, publication-ready Bibliography section for Markdown or LaTeX.
 */
export function buildBibliographySection({
  bibliographyText,
  format,
  styleId = 'auto',
  headingTitle,
  citations = [],
}: BuildBibliographyOptions): string {
  const isNumeric = [
    'ieee',
    'vancouver',
    'nature',
    'numeric',
    'auto-numeric',
    'tcvn-numeric',
  ].some((s) => styleId.toLowerCase().includes(s));

  const cleanBibText = (bibliographyText || '').trim();
  const title = headingTitle || 'Tài liệu tham khảo';

  if (format === 'latex') {
    // If individual citations with keys are provided, generate \bibitem entries
    if (citations && citations.length > 0) {
      const bibitems = citations
        .map((c, index) => {
          const key = c.key || `ref_${index + 1}`;
          const text = (c.bibliography || '').trim();
          return `\\bibitem{${key}}\n${text}`;
        })
        .join('\n\n');

      return `\\begin{thebibliography}{99}\n\n${bibitems}\n\n\\end{thebibliography}`;
    }

    // Fallback: Split plain lines into \bibitem blocks
    const lines = cleanBibText
      .split(/\n\s*\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const bibitems = lines
      .map((line, index) => `\\bibitem{ref_${index + 1}}\n${line}`)
      .join('\n\n');

    return `\\begin{thebibliography}{99}\n\n${bibitems}\n\n\\end{thebibliography}`;
  }

  // Markdown format
  let rawEntries: string[] = [];
  if (citations && citations.length > 0) {
    rawEntries = citations
      .map((c) => (c.bibliography || '').trim())
      .filter(Boolean);
  } else {
    rawEntries = cleanBibText
      .split(/\n+/)
      .map((e) => e.trim())
      .filter(Boolean);
  }

  let formattedEntries = '';
  if (isNumeric) {
    // Numeric styles (IEEE / Vancouver / TCVN-Numeric) already contain [1], [2] or can be numbered
    formattedEntries = rawEntries
      .map((entry, idx) => {
        if (/^\[\d+\]/.test(entry)) return entry;
        return `[${idx + 1}] ${entry}`;
      })
      .join('\n\n');
  } else {
    // Author-Date styles (APA, Chicago, Harvard, MLA, TCVN) - standard markdown numbered list
    formattedEntries = rawEntries
      .map((entry, idx) => {
        if (/^\d+\.\s*/.test(entry)) return entry;
        return `${idx + 1}. ${entry}`;
      })
      .join('\n\n');
  }

  return `## ${title}\n\n${formattedEntries}`;
}

export interface InjectBibliographyResult {
  nextContent: string;
  action: 'replaced' | 'appended';
}

/**
 * Injects or updates a bibliography section inside document content without duplication.
 */
export function injectBibliographyIntoDocument({
  currentContent,
  newSection,
  format,
}: {
  currentContent: string;
  newSection: string;
  format: 'markdown' | 'latex';
}): InjectBibliographyResult {
  const content = currentContent || '';
  const trimmedSection = newSection.trim();

  if (format === 'latex') {
    // 1. Check for existing \begin{thebibliography} ... \end{thebibliography}
    const bibRegex = /\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/i;
    if (bibRegex.test(content)) {
      return {
        nextContent: content.replace(bibRegex, trimmedSection),
        action: 'replaced',
      };
    }

    // 2. Check for \end{document} to insert right before it
    const endDocRegex = /\\end\{document\}/i;
    if (endDocRegex.test(content)) {
      return {
        nextContent: content.replace(endDocRegex, `${trimmedSection}\n\n\\end{document}`),
        action: 'appended',
      };
    }

    // 3. Fallback: append at end of file
    const separator = content.endsWith('\n\n') ? '' : content.endsWith('\n') ? '\n' : '\n\n';
    return {
      nextContent: `${content}${separator}${trimmedSection}\n`,
      action: 'appended',
    };
  }

  // Markdown mode
  // Match existing ## Tài liệu tham khảo / References / Bibliography till next major heading or end of file
  const mdBibRegex =
    /(?:^|\n)(#{1,3}\s*(?:Tài liệu tham khảo|TÀI LIỆU THAM KHẢO|References|REFERENCES|Bibliography|BIBLIOGRAPHY)[\s\S]*?$)/i;

  if (mdBibRegex.test(content)) {
    return {
      nextContent: content.replace(mdBibRegex, `\n\n${trimmedSection}\n`),
      action: 'replaced',
    };
  }

  // Fallback: Append at the end of the document
  const separator = content.endsWith('\n\n') ? '' : content.endsWith('\n') ? '\n' : '\n\n';
  return {
    nextContent: `${content.trimEnd()}${separator}${trimmedSection}\n`,
    action: 'appended',
  };
}
