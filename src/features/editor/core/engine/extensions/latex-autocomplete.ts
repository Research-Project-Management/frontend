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
import { formatShortAuthor } from '@/features/editor/subsystems/citation';

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

const STANDARD_BEGIN_ENV_OPTIONS: readonly Completion[] = LATEX_ENVIRONMENTS.map((env) => ({
  label: env.label,
  type: 'class',
  detail: env.detail,
  apply: snippet(`${env.label}}\n\t\${1}\n\\end{${env.label}}`),
  boost: 100,
}));

const BOOSTED_PACKAGE_OPTIONS: Completion[] = LATEX_PACKAGES.map((pkg) => ({
  ...pkg,
  boost: 100,
}));

const BOOSTED_DOCCLASS_OPTIONS: Completion[] = LATEX_DOCUMENTCLASSES.map((cls) => ({
  ...cls,
  boost: 100,
}));

const LATEX_COMMANDS_NO_SLASH: readonly Completion[] = LATEX_COMMANDS.map((c) => ({
  ...c,
  label: c.label.replace(/^\\/, ''),
}));

const COMMENT_STRIP_REGEX = /(^|[^\\])%.*$/gm;
const ENV_PAIR_REGEX = /\\(begin|end)\{([a-zA-Z*0-9_]+)\}/g;
const END_MATCH_REGEX = /\\end\{[a-zA-Z*0-9_]*/;
const BEGIN_MATCH_REGEX = /\\begin\{[a-zA-Z*0-9_]*/;
const PACKAGE_MATCH_REGEX = /\\usepackage(?:\s*\[[^\]]*\])?\s*\{[^}]*/;
const DOCCLASS_MATCH_REGEX = /\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]*/;
const CITE_MATCH_REGEX = /\\(?:cite|citep|citet|nocite|textcite|autocite|parencite|supercite|footcite|fullcite|citeauthor|citeyear|citeyearpar|citealp|citealt|citenum|Cite|Parencite|Autocite|Textcite|footfullcite)\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{[^}]*/;
const PANDOC_CITE_REGEX = /\[@[^\]]*/;
const REF_MATCH_REGEX = /\\(?:ref|eqref|pageref|autoref|cref|Cref|cpageref|Cpageref|vref|Vref|nameref|namecref|nameCref)\*?(?:\[[^\]]*\])*\{[^}]*/;
const HYPERREF_MATCH_REGEX = /\\hyperref\[[^\]]*/;
const INPUT_MATCH_REGEX = /\\(?:input|include|subfile|includeonly|bibliography|addbibresource)\*?\{[^}]*/;
const IMAGE_MATCH_REGEX = /\\includegraphics\*?(?:\s*\[[^\]]*\])?\s*\{[^}]*/;
const WORD_MATCH_REGEX = /\\?[a-zA-Z*0-9_]*/;
const VALID_ENV_REGEX = /^[a-zA-Z*0-9_]*$/;
const VALID_PKG_REGEX = /^[^},\s]*$/;
const VALID_CLS_REGEX = /^[^}\s]*$/;
const VALID_CITE_REGEX = /^[^},\s\];]*$/;
const VALID_BRACKET_REF_REGEX = /^[^\]\s]*$/;
const VALID_WORD_REGEX = /^\\?[a-zA-Z*0-9_]*$/;

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
  if (entry.sourceFile) lines.push(`Source: ${entry.sourceFile}`);
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
  const clean = docText.replace(COMMENT_STRIP_REGEX, '$1');

  ENV_PAIR_REGEX.lastIndex = 0;
  const stack: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = ENV_PAIR_REGEX.exec(clean)) !== null) {
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
  const endMatch = context.matchBefore(END_MATCH_REGEX);
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
      validFor: VALID_ENV_REGEX,
    };
  }

  // ── B. \begin{...} Environment Completion ───────────────────────────────────
  const beginMatch = context.matchBefore(BEGIN_MATCH_REGEX);
  if (beginMatch) {
    const from = beginMatch.from + 7; // after \begin{
    const hasClosingBrace = context.state.sliceDoc(context.pos, context.pos + 1) === '}';
    const to = hasClosingBrace ? context.pos + 1 : context.pos;

    // Custom project environments (\newtheorem, \newenvironment)
    const customEnvs = latexSymbolsIndex.getEnvironments();
    const customOptions: Completion[] = customEnvs.length > 0
      ? customEnvs.map((cEnv) => ({
          label: cEnv.name,
          type: 'class',
          detail: `Custom Environment (${cEnv.sourceFile})`,
          apply: snippet(`${cEnv.name}}\n\t\${1}\n\\end{${cEnv.name}}`),
          boost: 95,
        }))
      : [];

    return {
      from,
      to,
      options: customOptions.length > 0 ? [...STANDARD_BEGIN_ENV_OPTIONS, ...customOptions] : (STANDARD_BEGIN_ENV_OPTIONS as Completion[]),
      validFor: VALID_ENV_REGEX,
    };
  }

  // ── C. Package Completion (\usepackage{...}) ────────────────────────────────
  const packageMatch = context.matchBefore(PACKAGE_MATCH_REGEX);
  if (packageMatch) {
    const lastDelim = Math.max(packageMatch.text.lastIndexOf('{'), packageMatch.text.lastIndexOf(','));
    const textAfterDelim = packageMatch.text.slice(lastDelim + 1);
    const leadingWs = textAfterDelim.match(/^\s*/)?.[0]?.length || 0;
    const from = packageMatch.from + lastDelim + 1 + leadingWs;

    return {
      from,
      options: BOOSTED_PACKAGE_OPTIONS,
      validFor: VALID_PKG_REGEX,
    };
  }

  // ── D. Document Class Completion (\documentclass{...}) ─────────────────────
  const docClassMatch = context.matchBefore(DOCCLASS_MATCH_REGEX);
  if (docClassMatch) {
    const lastBrace = docClassMatch.text.lastIndexOf('{');
    const from = docClassMatch.from + lastBrace + 1;

    return {
      from,
      options: BOOSTED_DOCCLASS_OPTIONS,
      validFor: VALID_CLS_REGEX,
    };
  }

  // ── E. Cross-File BibTeX Citations (\cite{...}, \citep{...}, [@key], etc.) ─
  const citeMatch = context.matchBefore(CITE_MATCH_REGEX);
  const pandocMatch = !citeMatch ? context.matchBefore(PANDOC_CITE_REGEX) : null;

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
      validFor: VALID_CITE_REGEX,
    };
  }

  // ── F. Cross-File Labels (\ref{...}, \eqref{...}, \cref{...}, \hyperref[...]) ─
  const refMatch = context.matchBefore(REF_MATCH_REGEX);
  const hyperrefMatch = !refMatch ? context.matchBefore(HYPERREF_MATCH_REGEX) : null;

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
      validFor: isBracket ? VALID_BRACKET_REF_REGEX : VALID_PKG_REGEX,
    };
  }

  // ── G. File Inclusions (\input{...}, \include{...}, \subfile{...}) ──────────
  const inputMatch = context.matchBefore(INPUT_MATCH_REGEX);
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
      validFor: VALID_CLS_REGEX,
    };
  }

  // ── G2. Image Inclusions (\includegraphics[...]{...} - Overleaf 1:1 Parity) ──
  const imageMatch = context.matchBefore(IMAGE_MATCH_REGEX);
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
      validFor: VALID_CLS_REGEX,
    };
  }

  // ── H. Standard Commands, Math Symbols & Dynamic Project Macros ─────────────
  const word = context.matchBefore(WORD_MATCH_REGEX);
  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  const isBackslash = word.text.startsWith('\\');
  const filteredCommands = isBackslash ? LATEX_COMMANDS : LATEX_COMMANDS_NO_SLASH;

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
    validFor: VALID_WORD_REGEX,
  };
}

export function createLatexAutocompleteExtension() {
  return autocompletion({
    override: [latexAutocompleteSource],
    defaultKeymap: true,
    icons: true,
  });
}

