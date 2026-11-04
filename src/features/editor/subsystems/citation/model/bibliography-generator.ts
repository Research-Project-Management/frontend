/**
 * bibliography-generator.ts
 *
 * Concise delegating helpers for generating and injecting formatted reference sections
 * into Markdown and LaTeX manuscripts.
 */

export function isLatexDocument(content: string, filePath?: string): boolean {
  if (filePath) {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.tex') || lower.endsWith('.latex')) return true;
    if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.qmd')) return false;
  }
  return Boolean(
    content &&
      /\\(?:documentclass|begin\{document\}|section\*?\{|usepackage|begin\{thebibliography\})/i.test(content),
  );
}

export function detectDocumentCitationStyle(content: string, filePath?: string): 'auto' | 'auto-numeric' {
  if (isLatexDocument(content, filePath)) return 'auto-numeric';
  return content && /\[\d+(?:[,\s-]+\d+)*\]/.test(content) ? 'auto-numeric' : 'auto';
}

export interface BuildBibliographyOptions {
  bibliographyText: string;
  format: 'markdown' | 'latex';
  styleId?: string;
  headingTitle?: string;
  citations?: Array<{ key?: string; inText?: string; bibliography?: string }>;
}

export function buildBibliographySection({
  bibliographyText,
  format,
  styleId = 'auto',
  headingTitle,
  citations = [],
}: BuildBibliographyOptions): string {
  const cleanBibText = (bibliographyText || '').trim();
  const vnRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/;
  const isVn =
    styleId.toLowerCase().includes('tcvn') ||
    vnRegex.test(cleanBibText) ||
    citations.some((c) => vnRegex.test(c.bibliography || ''));
  const title = headingTitle || (isVn ? 'Tài liệu tham khảo' : 'References');

  if (format === 'latex') {
    const items =
      citations.length > 0
        ? citations.map((c, i) => `\\bibitem{${c.key || `ref_${i + 1}`}}\n${(c.bibliography || '').trim()}`)
        : cleanBibText.split(/\n\s*\n/).map((l) => l.trim()).filter(Boolean).map((l, i) => `\\bibitem{ref_${i + 1}}\n${l}`);
    return `\\begin{thebibliography}{99}\n\n${items.join('\n\n')}\n\n\\end{thebibliography}`;
  }

  const rawEntries =
    citations.length > 0
      ? citations.map((c) => (c.bibliography || '').trim()).filter(Boolean)
      : cleanBibText.split(/\n+/).map((e) => e.trim()).filter(Boolean);
  const isNumeric = ['ieee', 'vancouver', 'nature', 'numeric', 'auto-numeric', 'tcvn-numeric'].some((s) =>
    styleId.toLowerCase().includes(s),
  );
  const formatted = rawEntries
    .map((entry, idx) =>
      isNumeric
        ? /^\[\d+\]/.test(entry) ? entry : `[${idx + 1}] ${entry}`
        : /^\d+\.\s*/.test(entry) ? entry : `${idx + 1}. ${entry}`,
    )
    .join('\n\n');

  return `## ${title}\n\n${formatted}`;
}

export interface InjectBibliographyResult {
  nextContent: string;
  action: 'replaced' | 'appended';
}

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
  const trimmed = newSection.trim();

  if (format === 'latex') {
    const bibRegex = /\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/i;
    if (bibRegex.test(content)) {
      return { nextContent: content.replace(bibRegex, trimmed), action: 'replaced' };
    }
    const endDocRegex = /\\end\{document\}/i;
    if (endDocRegex.test(content)) {
      return { nextContent: content.replace(endDocRegex, `${trimmed}\n\n\\end{document}`), action: 'appended' };
    }
    const sep = content.endsWith('\n\n') ? '' : content.endsWith('\n') ? '\n' : '\n\n';
    return { nextContent: `${content}${sep}${trimmed}\n`, action: 'appended' };
  }

  const mdBibRegex = /(?:^|\n)(#{1,3}\s*(?:Tài liệu tham khảo|References|Bibliography)[\s\S]*?$)/i;
  if (mdBibRegex.test(content)) {
    return { nextContent: content.replace(mdBibRegex, `\n\n${trimmed}\n`), action: 'replaced' };
  }
  const sep = content.endsWith('\n\n') ? '' : content.endsWith('\n') ? '\n' : '\n\n';
  return { nextContent: `${content.trimEnd()}${sep}${trimmed}\n`, action: 'appended' };
}
