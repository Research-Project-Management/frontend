/**
 * latex-autocomplete.ts
 *
 * CodeMirror 6 Autocompletion Source for LaTeX (Engines Layer).
 * Location: `features/editor/engines/extensions/latex-autocomplete.ts`
 *
 * Provides comprehensive, high-performance, cross-file autocompletions for:
 * 1. Cross-file BibTeX Citations: \cite{...}, \citep{...}, \citet{...}, Pandoc [@key], etc.
 * 2. Cross-file Document Labels: \ref{...}, \eqref{...}, \autoref{...}, \cref{...}, etc.
 * 3. Smart Environment Completion & Closing: \begin{...} and unclosed stack matching \end{...}.
 * 4. Package Suggestions: \usepackage{...} with descriptions for 50+ packages.
 * 5. Document Class Suggestions: \documentclass{...} with document type hints.
 * 6. File Inclusions: \input{...}, \include{...}, \subfile{...}.
 * 7. Standard LaTeX Commands, Greek Letters & Unicode Math Symbols.
 * 8. Dynamic Custom Project Macros (\newcommand) indexed in memory.
 */

import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippet,
} from '@codemirror/autocomplete';
import { latexSymbolsIndex, type BibEntry, type LabelEntry } from '@/features/editor/domain/latex/latex-symbols-index';
import { isVietnameseAuthorName, formatShortAuthor } from '@/features/editor/subsystems/citation/model/citation-formatter';

import {
  LATEX_ENVIRONMENTS,
  LATEX_PACKAGES,
  LATEX_DOCUMENTCLASSES,
  LATEX_COMMANDS,
} from './latex-autocomplete.data';

export {
  LATEX_ENVIRONMENTS,
  LATEX_PACKAGES,
  LATEX_DOCUMENTCLASSES,
  LATEX_COMMANDS,
};

// ── 5. Helper Functions ──────────────────────────────────────────────────────


const citationInfoCache = new WeakMap<BibEntry, string>();
const shortAuthorCache = new WeakMap<BibEntry, string>();

/**
 * Formats rich multiline tooltip documentation for a BibTeX entry (cached per entry)
 */
function formatCitationInfo(entry: BibEntry): string {
  const cached = citationInfoCache.get(entry);
  if (cached) return cached;
  const lines: string[] = [];
  if (entry.title) lines.push(entry.title);
  if (entry.author) {
    const authorList = entry.author.split(/\s+and\s+|;\s*/i).join(', ');
    lines.push(authorList);
  }
  const metaParts = [
    entry.year ? `${entry.year}` : '',
    entry.journal ? `${entry.journal}` : '',
    entry.type ? `@${entry.type}` : '',
  ].filter(Boolean);
  if (metaParts.length > 0) lines.push(metaParts.join('  •  '));
  if (entry.doi) lines.push(`DOI: ${entry.doi}`);
  if (entry.sourceFile) lines.push(`Nguồn: ${entry.sourceFile}`);
  const formatted = lines.join('\n');
  citationInfoCache.set(entry, formatted);
  return formatted;
}

function getCachedShortAuthor(entry: BibEntry): string {
  const cached = shortAuthorCache.get(entry);
  if (cached !== undefined) {
    return cached;
  }
  const authorStr = formatShortAuthor(entry.author);
  shortAuthorCache.set(entry, authorStr);
  return authorStr;
}

/**
 * Returns all candidate image files in the project for \includegraphics autocompletion
 */
function getProjectImageFiles(query: string): string[] {
  const images = new Set<string>(latexSymbolsIndex.getImageFiles(query));
  const q = query.toLowerCase();
  const list = Array.from(images);
  return q ? list.filter((img) => img.toLowerCase().includes(q)) : list;
}

/**
 * Scans backward from the cursor to find the stack of open, unclosed environments.
 * Used for smart \end{...} auto-completion with the exact matching tag.
 */
function findUnclosedEnvironments(docText: string): string[] {
  // Strip comments (% ...) to prevent matching commented-out environments
  const clean = docText.replace(/(^|[^\\])%.*$/gm, '$1');

  const regex = /\\(begin|end)\{([a-zA-Z*0-9_]+)\}/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(clean)) !== null) {
    const kind = match[1];
    const env = match[2];
    if (kind === 'begin') {
      stack.push(env);
    } else if (kind === 'end') {
      const idx = stack.lastIndexOf(env);
      if (idx !== -1) {
        stack.splice(idx, 1);
      } else if (stack.length > 0) {
        stack.pop();
      }
    }
  }

  return stack;
}

// ── 6. Main Autocomplete Source ──────────────────────────────────────────────

export function latexAutocompleteSource(context: CompletionContext): CompletionResult | null {
  // ── A. Smart \end{...} Environment Closing ──────────────────────────────────
  const endMatch = context.matchBefore(/\\end\{[a-zA-Z*0-9_]*/);
  if (endMatch) {
    const from = endMatch.from + 5; // after \end{
    const hasClosingBrace = context.state.sliceDoc(context.pos, context.pos + 1) === '}';
    const to = hasClosingBrace ? context.pos + 1 : context.pos;

    const precedingLimit = Math.max(0, context.pos - 20000);
    const precedingText = context.state.doc.sliceString(precedingLimit, context.pos);
    const unclosedStack = findUnclosedEnvironments(precedingText);

    const latestUnclosed = unclosedStack.length > 0 ? unclosedStack[unclosedStack.length - 1] : null;
    const unclosedSet = new Set(unclosedStack);

    const options: Completion[] = [];

    // Highest priority: the innermost unclosed environment matching this \end
    if (latestUnclosed) {
      options.push({
        label: latestUnclosed,
        type: 'class',
        detail: 'Matching unclosed \\begin',
        apply: `${latestUnclosed}}`,
        boost: 120,
      });
    }

    // Secondary priority: other unclosed parent environments
    for (let i = unclosedStack.length - 2; i >= 0; i--) {
      const parentEnv = unclosedStack[i];
      if (parentEnv && parentEnv !== latestUnclosed) {
        options.push({
          label: parentEnv,
          type: 'class',
          detail: 'Unclosed parent environment',
          apply: `${parentEnv}}`,
          boost: 110,
        });
      }
    }

    // Tertiary priority: custom project environments (\newenvironment, \newtheorem)
    const customEnvs = latexSymbolsIndex.getEnvironments();
    for (const cEnv of customEnvs) {
      if (!unclosedSet.has(cEnv.name)) {
        options.push({
          label: cEnv.name,
          type: 'class',
          detail: `Custom environment (${cEnv.sourceFile})`,
          apply: `${cEnv.name}}`,
          boost: 70,
        });
      }
    }

    // Standard environments
    for (const env of LATEX_ENVIRONMENTS) {
      if (!unclosedSet.has(env.label)) {
        options.push({
          label: env.label,
          type: 'class',
          detail: env.detail,
          apply: `${env.label}}`,
          boost: 50,
        });
      }
    }

    return {
      from,
      to,
      options,
      validFor: /^[a-zA-Z*0-9_]*$/,
    };
  }

  // ── B. \begin{...} Environment Completion ───────────────────────────────────
  const beginMatch = context.matchBefore(/\\begin\{[a-zA-Z*0-9_]*/);
  if (beginMatch) {
    const from = beginMatch.from + 7; // after \begin{
    const hasClosingBrace = context.state.sliceDoc(context.pos, context.pos + 1) === '}';
    const to = hasClosingBrace ? context.pos + 1 : context.pos;

    // Custom project environments (\newtheorem, \newenvironment)
    const customOptions: Completion[] = latexSymbolsIndex.getEnvironments().map((cEnv) => ({
      label: cEnv.name,
      type: 'class',
      detail: `Custom Environment (${cEnv.sourceFile})`,
      apply: snippet(`${cEnv.name}}\n\t\${1}\n\\end{${cEnv.name}}`),
      boost: 95,
    }));

    const standardOptions: Completion[] = LATEX_ENVIRONMENTS.map((env) => ({
      label: env.label,
      type: 'class',
      detail: env.detail,
      apply: snippet(`${env.label}}\n\t\${1}\n\\end{${env.label}}`),
      boost: 100,
    }));

    return {
      from,
      to,
      options: [...standardOptions, ...customOptions],
      validFor: /^[a-zA-Z*0-9_]*$/,
    };
  }

  // ── C. Package Completion (\usepackage{...}) ────────────────────────────────
  const packageMatch = context.matchBefore(/\\usepackage(?:\s*\[[^\]]*\])?\s*\{[^}]*/);
  if (packageMatch) {
    const lastDelim = Math.max(packageMatch.text.lastIndexOf('{'), packageMatch.text.lastIndexOf(','));
    const textAfterDelim = packageMatch.text.slice(lastDelim + 1);
    const leadingWs = textAfterDelim.match(/^\s*/)?.[0]?.length || 0;
    const from = packageMatch.from + lastDelim + 1 + leadingWs;

    return {
      from,
      options: LATEX_PACKAGES.map((pkg) => ({
        ...pkg,
        boost: 100,
      })),
      validFor: /^[^},\s]*$/,
    };
  }

  // ── D. Document Class Completion (\documentclass{...}) ─────────────────────
  const docClassMatch = context.matchBefore(/\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]*/);
  if (docClassMatch) {
    const lastBrace = docClassMatch.text.lastIndexOf('{');
    const from = docClassMatch.from + lastBrace + 1;

    return {
      from,
      options: LATEX_DOCUMENTCLASSES.map((cls) => ({
        ...cls,
        boost: 100,
      })),
      validFor: /^[^}\s]*$/,
    };
  }

  // ── E. Cross-File BibTeX Citations (\cite{...}, \citep{...}, [@key], etc.) ─
  const citeRegex = /\\(?:cite|citep|citet|nocite|textcite|autocite|parencite|supercite|footcite|fullcite|citeauthor|citeyear|citeyearpar|citealp|citealt|citenum|Cite|Parencite|Autocite|Textcite|footfullcite)\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{[^}]*/;
  const citeMatch = context.matchBefore(citeRegex);
  const pandocMatch = !citeMatch ? context.matchBefore(/\[@[^\]]*/) : null;

  if (citeMatch || pandocMatch) {
    const matchText = citeMatch ? citeMatch.text : pandocMatch!.text;
    const matchFrom = citeMatch ? citeMatch.from : pandocMatch!.from;

    const lastDelim = Math.max(
      matchText.lastIndexOf('{'),
      matchText.lastIndexOf(','),
      matchText.lastIndexOf('@'),
      matchText.lastIndexOf(';')
    );
    const textAfterDelim = matchText.slice(lastDelim + 1);
    const leadingWs = textAfterDelim.match(/^\s*/)?.[0]?.length || 0;
    const from = matchFrom + lastDelim + 1 + leadingWs;
    const query = textAfterDelim.trim();

    const citations = latexSymbolsIndex.getCitations(query);
    const nextChar = context.state.sliceDoc(context.pos, context.pos + 1);
    const hasClosingBrace = nextChar === '}';
    const to = hasClosingBrace ? context.pos + 1 : context.pos;
    const shouldAddClosingBrace = !hasClosingBrace && nextChar !== ',';

    return {
      from,
      to,
      options: citations.map((entry) => {
        const typeStr = (entry.type || 'bib').toUpperCase();
        const authorStr = getCachedShortAuthor(entry);
        const yearStr = entry.year ? `(${entry.year})` : '';
        const detailSuffix = [authorStr, yearStr].filter(Boolean).join(' ');

        return {
          label: entry.key,
          type: 'constant',
          detail: detailSuffix ? `[${typeStr}] ${detailSuffix}` : `[${typeStr}]`,
          info: formatCitationInfo(entry),
          apply: (!pandocMatch && (hasClosingBrace || shouldAddClosingBrace)) ? `${entry.key}}` : entry.key,
          boost: 100,
        };
      }),
      validFor: /^[^},\s\];]*$/,
    };
  }

  // ── F. Cross-File Labels (\ref{...}, \eqref{...}, \cref{...}, \hyperref[...]) ─
  const refRegex = /\\(?:ref|eqref|pageref|autoref|cref|Cref|cpageref|Cpageref|vref|Vref|nameref|namecref|nameCref)\*?(?:\[[^\]]*\])*\{[^}]*/;
  const refMatch = context.matchBefore(refRegex);
  const hyperrefMatch = !refMatch ? context.matchBefore(/\\hyperref\[[^\]]*/) : null;

  if (refMatch || hyperrefMatch) {
    let from: number;
    let query: string;
    let isBracket = false;

    if (refMatch) {
      const lastDelim = Math.max(refMatch.text.lastIndexOf('{'), refMatch.text.lastIndexOf(','));
      const textAfterDelim = refMatch.text.slice(lastDelim + 1);
      const leadingWs = textAfterDelim.match(/^\s*/)?.[0]?.length || 0;
      from = refMatch.from + lastDelim + 1 + leadingWs;
      query = textAfterDelim.trim();
    } else {
      isBracket = true;
      const lastBracket = hyperrefMatch!.text.lastIndexOf('[');
      const textAfterDelim = hyperrefMatch!.text.slice(lastBracket + 1);
      const leadingWs = textAfterDelim.match(/^\s*/)?.[0]?.length || 0;
      from = hyperrefMatch!.from + lastBracket + 1 + leadingWs;
      query = textAfterDelim.trim();
    }

    const nextChar = context.state.sliceDoc(context.pos, context.pos + 1);
    const hasClosing = isBracket ? nextChar === ']' : nextChar === '}';
    const to = hasClosing ? context.pos + 1 : context.pos;
    const shouldAddClosing = !hasClosing && nextChar !== ',';

    const labels = latexSymbolsIndex.getLabels(query);

    return {
      from,
      to,
      options: labels.map((entry: LabelEntry) => {
        const closingChar = isBracket ? ']' : '}';
        const applyText = (hasClosing || shouldAddClosing) ? `${entry.name}${closingChar}` : entry.name;
        return {
          label: entry.name,
          type: 'variable',
          detail: `[${entry.type.toUpperCase()}]`,
          info: `Defined in ${entry.sourceFile} (line ${entry.line})`,
          apply: applyText,
          boost: 100,
        };
      }),
      validFor: isBracket ? /^[^\]\s]*$/ : /^[^},\s]*$/,
    };
  }

  // ── G. File Inclusions (\input{...}, \include{...}, \subfile{...}) ──────────
  const inputMatch = context.matchBefore(/\\(?:input|include|subfile|includeonly|bibliography|addbibresource)\*?\{[^}]*/);
  if (inputMatch) {
    const lastBrace = inputMatch.text.lastIndexOf('{');
    const from = inputMatch.from + lastBrace + 1;
    const query = inputMatch.text.slice(lastBrace + 1).trim();
    const includeFiles = latexSymbolsIndex.getIncludeFiles(query);

    return {
      from,
      options: includeFiles.map((file) => ({
        label: file,
        type: 'text',
        detail: 'LaTeX / Project File',
        apply: file.replace(/\.tex$/, ''),
        boost: 100,
      })),
      validFor: /^[^}\s]*$/,
    };
  }

  // ── G2. Image Inclusions (\includegraphics[...]{...} - Overleaf 1:1 Parity) ──
  const imageMatch = context.matchBefore(/\\includegraphics\*?(?:\s*\[[^\]]*\])?\s*\{[^}]*/);
  if (imageMatch) {
    const lastBrace = imageMatch.text.lastIndexOf('{');
    const from = imageMatch.from + lastBrace + 1;
    const query = imageMatch.text.slice(lastBrace + 1).trim();
    const imageFiles = getProjectImageFiles(query);

    return {
      from,
      options: imageFiles.map((file) => ({
        label: file,
        type: 'file',
        detail: 'Project Graphic',
        apply: file,
        boost: 110,
      })),
      validFor: /^[^}\s]*$/,
    };
  }

  // ── H. Standard Commands, Math Symbols & Dynamic Project Macros ─────────────
  const word = context.matchBefore(/\\?[a-zA-Z*0-9_]*/);
  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  const isBackslash = word.text.startsWith('\\');
  const filteredCommands = isBackslash
    ? LATEX_COMMANDS
    : LATEX_COMMANDS.map((c) => ({
        ...c,
        label: c.label.replace(/^\\/, ''),
      }));

  // Dynamic user-defined macros from \newcommand across project files
  const customCommands: Completion[] = latexSymbolsIndex.getCommands().map((cmd) => {
    const label = isBackslash ? cmd.name : cmd.name.replace(/^\\/, '');
    const argsSnippet =
      cmd.argsCount > 0
        ? Array.from({ length: cmd.argsCount }, (_, i) => `{\${${i + 1}}}`).join('')
        : '';

    return {
      label,
      type: 'function',
      detail: `Macro (${cmd.argsCount} arg${cmd.argsCount === 1 ? '' : 's'})`,
      info: `User macro defined in ${cmd.sourceFile}`,
      apply: argsSnippet ? snippet(`${cmd.name}${argsSnippet}`) : cmd.name,
      boost: 60,
    };
  });

  return {
    from: word.from,
    options: [...filteredCommands, ...customCommands, ...LATEX_ENVIRONMENTS],
    validFor: /^\\?[a-zA-Z*0-9_]*$/,
  };
}

export function createLatexAutocompleteExtension() {
  return autocompletion({
    override: [latexAutocompleteSource],
    defaultKeymap: true,
    icons: true,
  });
}

// ── 7. Factory Export for Custom Source Injection ────────────────────────────

export type LatexBibEntryInput =
  | string
  | {
      key?: string;
      citationKey?: string;
      id?: string;
      title?: string;
      authors?: string[];
      author?: string;
      year?: string | number;
      journal?: string;
      source?: string;
    };

export type LatexFileInput =
  | string
  | {
      name?: string;
      path?: string;
      title?: string;
    };

export interface NormalizedCiteItem {
  key: string;
  title?: string;
  authors: string[];
  authorStr?: string;
  year?: string;
  journal?: string;
  source: 'bib' | 'library' | 'server';
}

interface DocTokens {
  bibItems: NormalizedCiteItem[];
  labels: string[];
}

function scanDocTokens(docText: string): DocTokens {
  const bibItems: NormalizedCiteItem[] = [];
  const bibitemRegex = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let bMatch: RegExpExecArray | null;
  while ((bMatch = bibitemRegex.exec(docText)) !== null) {
    const key = bMatch[1]?.trim();
    if (key) {
      bibItems.push({
        key,
        authors: [],
        authorStr: 'Document bibliography',
        source: 'bib',
      });
    }
  }

  const labels = new Set<string>();
  const labelRegex = /\\label\{([^}]+)\}/g;
  let lMatch: RegExpExecArray | null;
  while ((lMatch = labelRegex.exec(docText)) !== null) {
    labels.add(lMatch[1]);
  }

  return { bibItems, labels: Array.from(labels) };
}

export function createLatexCompletionSource(
  bibSource: LatexBibEntryInput[] | (() => LatexBibEntryInput[]) = [],
  fileSource: LatexFileInput[] | (() => LatexFileInput[]) = [],
) {
  return function latexCompletionSource(context: CompletionContext): CompletionResult | null {
    const rawKeys = typeof bibSource === 'function' ? bibSource() : bibSource;
    const rawFiles = typeof fileSource === 'function' ? fileSource() : fileSource;
    const docText = context.state.doc.toString();
    const docTokens = scanDocTokens(docText);

    // 1. Check for \begin{...}
    const beginMatch = context.matchBefore(/\\begin\{[a-zA-Z0-9*_-]*/);
    if (beginMatch) {
      const from = beginMatch.from + 7;
      const options: Completion[] = LATEX_ENVIRONMENTS.map((env) => ({
        label: env.label,
        type: 'class',
        apply: snippet(`${env.label}}\n  \${1}\n\\end{${env.label}}`),
        detail: env.detail,
      }));
      return { from, options, validFor: /^[a-zA-Z0-9*_-]*$/ };
    }

    // 2. Check for citation commands
    const citeMatch = context.matchBefore(
      /\\(?:auto|paren|text|foot|no)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])*\{[^}]*$/i,
    );
    if (citeMatch) {
      const matchText = citeMatch.text;
      const lastSep = Math.max(matchText.lastIndexOf('{'), matchText.lastIndexOf(','));
      const afterSep = matchText.slice(lastSep + 1);
      const leadingSpaces = afterSep.length - afterSep.trimStart().length;
      const searchQuery = afterSep.trimStart().toLowerCase();
      const from = citeMatch.from + lastSep + 1 + leadingSpaces;

      const allBibItems = new Map<string, NormalizedCiteItem>();

      for (const item of rawKeys) {
        if (typeof item === 'string' && item) {
          allBibItems.set(item.toLowerCase(), {
            key: item,
            authors: [],
            source: 'bib',
          });
        } else if (item && typeof item === 'object') {
          const key = item.key || item.citationKey || item.id;
          if (key) {
            const authors = Array.isArray(item.authors)
              ? item.authors
              : item.author
              ? [item.author]
              : [];
            const authorStr =
              authors.length > 0
                ? authors.length <= 2
                  ? authors.join(' & ')
                  : `${authors[0]} et al.`
                : '';
            const year = item.year ? String(item.year) : undefined;
            allBibItems.set(key.toLowerCase(), {
              key,
              title: item.title,
              authors,
              authorStr,
              year,
              journal: item.journal,
              source: (item.source as 'bib' | 'library' | 'server') || 'bib',
            });
          }
        }
      }

      for (const b of docTokens.bibItems) {
        const lowerKey = b.key.toLowerCase();
        if (!allBibItems.has(lowerKey)) {
          allBibItems.set(lowerKey, b);
        }
      }

      const itemsList = Array.from(allBibItems.values());
      const options: Completion[] = itemsList.map((item) => {
        const isProject = item.source === 'bib';
        const authorYear = [item.authorStr, item.year ? `(${item.year})` : ''].filter(Boolean).join(' ');
        const detail = authorYear
          ? `${authorYear}${isProject ? '' : ' · [Library]'}`
          : isProject
          ? 'Project Reference'
          : 'Library Reference';

        return {
          label: item.key,
          type: isProject ? 'constant' : 'variable',
          detail,
          info: item.title,
          boost: isProject ? 2 : 1,
          apply: `${item.key}}`,
        };
      });

      return {
        from,
        options,
        validFor: /^[^},\s]*$/,
      };
    }

    // 3. Check for cross-references
    const refMatch = context.matchBefore(/\\(?:eq|page|auto|c|C|name)?ref\{[a-zA-Z0-9:_-]*/);
    if (refMatch) {
      const from = refMatch.text.lastIndexOf('{') + refMatch.from + 1;
      const options: Completion[] = docTokens.labels.map((lbl) => ({
        label: lbl,
        type: 'variable',
        apply: `${lbl}}`,
        detail: 'Cross-reference label',
      }));

      return { from, options, validFor: /^[a-zA-Z0-9:_-]*$/ };
    }

    // 4. Check for \usepackage[...]{...} or \usepackage{...}
    const pkgMatch = context.matchBefore(/\\usepackage(?:\[[^\]]*\])?\{[a-zA-Z0-9_-]*/);
    if (pkgMatch) {
      const from = pkgMatch.text.lastIndexOf('{') + pkgMatch.from + 1;
      return {
        from,
        options: LATEX_PACKAGES,
        validFor: /^[a-zA-Z0-9_-]*$/,
      };
    }

    // 5. Check for \input{...}, \include{...}, \subfile{...}
    const inputMatch = context.matchBefore(/\\(?:input|include|subfile)\{[a-zA-Z0-9_\-\./]*/);
    if (inputMatch) {
      const from = inputMatch.text.lastIndexOf('{') + inputMatch.from + 1;
      const fileNames = rawFiles
        .map((f) => (typeof f === 'string' ? f : f.name || f.path || f.title || ''))
        .filter(Boolean);

      const texFiles = fileNames.filter(
        (name) => name.toLowerCase().endsWith('.tex') || !name.includes('.')
      );
      const candidateFiles = texFiles.length > 0 ? texFiles : fileNames;

      const options: Completion[] = candidateFiles.map((name) => ({
        label: name,
        type: 'text',
        apply: `${name}}`,
        detail: 'Document file',
      }));

      return { from, options, validFor: /^[a-zA-Z0-9_\-\./]*$/ };
    }

    // 6. Check for \includegraphics[...]{...} or \includegraphics{...}
    const graphicsMatch = context.matchBefore(/\\includegraphics(?:\[[^\]]*\])?\{[a-zA-Z0-9_\-\./]*/);
    if (graphicsMatch) {
      const from = graphicsMatch.text.lastIndexOf('{') + graphicsMatch.from + 1;
      const fileNames = rawFiles
        .map((f) => (typeof f === 'string' ? f : f.name || f.path || f.title || ''))
        .filter(Boolean);

      const imageExts = ['.png', '.jpg', '.jpeg', '.pdf', '.eps', '.svg'];
      const imgFiles = fileNames.filter((name) => {
        const lower = name.toLowerCase();
        return imageExts.some((ext) => lower.endsWith(ext));
      });
      const candidateFiles = imgFiles.length > 0 ? imgFiles : fileNames;

      const options: Completion[] = candidateFiles.map((name) => ({
        label: name,
        type: 'constant',
        apply: `${name}}`,
        detail: 'Graphic file',
      }));

      return { from, options, validFor: /^[a-zA-Z0-9_\-\./]*$/ };
    }

    return latexAutocompleteSource(context);
  };
}
