/**
 * file-actions.util.ts
 *
 * Pure, deterministic utility functions for Explorer file actions:
 * - Generate \includegraphics / \includesvg with automated graphicx package insertion
 */

/**
 * Generates an asset inclusion snippet and checks whether graphicx package is needed
 */
export function prepareAssetInsertion(
  name: string,
  currentDocSource: string,
): { snippet: string; newDocSource?: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const snippet =
    ext === 'svg'
      ? `\\includesvg[width=\\linewidth]{${name}}`
      : `\\includegraphics[width=\\linewidth]{${name}}`;

  if (ext !== 'svg' && !/\\usepackage(?:\[.*?\])?\{graphicx\}/.test(currentDocSource)) {
    const lines = currentDocSource.split('\n');
    const beginDocIdx = lines.findIndex((l) => /\\begin\{document\}/.test(l));
    if (beginDocIdx >= 0) {
      lines.splice(beginDocIdx, 0, '\\usepackage{graphicx}');
      return { snippet, newDocSource: lines.join('\n') };
    }
  }

  return { snippet };
}

/**
 * Pure display name formatter for LaTeX and manuscript project files.
 */
export const displayName = (title: string): string => {
  const lower = (title || '').trim().toLowerCase();
  if (lower === 'flux' || lower === 'flux.tex') {
    return 'main.tex';
  }
  return /\.[a-z0-9]+$/i.test(title) ? title : `${title}.tex`;
};

/**
 * Strips file extension from display name to get clean basename.
 */
export const cleanBasename = (title: string): string =>
  displayName(title).replace(/\.[a-z0-9]+$/i, '');

