/**
 * compiler-logs.parser.ts
 *
 * Domain logic for parsing raw LaTeX compiler log streams:
 * - Extracts hard errors, file:line pairs, line excerpts
 * - Captures packages/class warnings
 * - Detects Overfull/Underfull bad boxes
 *
 * Domain: Layer 1 (Pure Domain Model & Compiler Log Processing).
 */

import type { LogEntry, ParsedLog } from '@/features/editor/domain/types/compiler.types';

export type { LogEntry, ParsedLog };

export const DEFAULT_OUTPUT_FILES = [
  'output.aux',
  'output.chktex',
  'output.log',
  'output.out',
  'output.stderr',
  'output.stdout',
  'output.toc',
];

const PARSED_LOG_CACHE_MAX = 5;
const parsedLogCache = new Map<string, ParsedLog>();

/**
 * Official Overleaf `LatexLogParser` constant (`services/web/frontend/js/ide/log-parser/latex-log-parser.ts`):
 * TeX hard-wraps log output at 79 characters per line.
 * Overleaf's `LogText` unwraps lines of length 79 (unless ending with '...' or next line starts with '!').
 */
const LOG_WRAP_LIMIT = 79;

const FATAL_SUMMARY_ERROR_MESSAGE =
  '==> Fatal error occurred, no output PDF file produced!';

const PKG_LOOKUP: Record<string, string> = {
  includegraphics: 'graphicx',
  includesvg: 'svg',
  toprule: 'booktabs',
  midrule: 'booktabs',
  bottomrule: 'booktabs',
  cmidrule: 'booktabs',
  multirow: 'multirow',
  justifying: 'ragged2e',
  tag: 'amsmath',
  notag: 'amsmath',
  text: 'amsmath',
  boldsymbol: 'amsmath',
  eqref: 'amsmath',
  iint: 'amsmath',
  iiint: 'amsmath',
  nmid: 'amssymb',
  varnothing: 'amssymb',
  Box: 'amssymb',
  citep: 'natbib',
  citet: 'natbib',
  citepalias: 'natbib',
  citetalias: 'natbib',
  url: 'url',
  href: 'hyperref',
  texorpdfstring: 'hyperref',
  phantomsection: 'hyperref',
  arraybackslash: 'array',
  textcolor: 'xcolor',
};

const ENV_PKG_LOOKUP: Record<string, string> = {
  justify: 'ragged2e',
  align: 'amsmath',
  'align*': 'amsmath',
  split: 'amsmath',
  gather: 'amsmath',
  cases: 'amsmath',
  matrix: 'amsmath',
  pmatrix: 'amsmath',
  bmatrix: 'amsmath',
  subequations: 'amsmath',
};

export function unwrapLatexLogLines(raw: string): string[] {
  const rawLines = raw.replace(/\r\n|\r/g, '\n').split('\n');
  if (rawLines.length === 0) return [];
  const wrappedLines: string[] = [rawLines[0]];
  for (let i = 1; i < rawLines.length; i++) {
    // Official Overleaf `LogText` checks `rawLines[i - 1].length === LOG_WRAP_LIMIT` (original line length before unwrapping)
    const prevLine = rawLines[i - 1];
    const currentLine = rawLines[i];
    if (
      prevLine.length === LOG_WRAP_LIMIT &&
      prevLine.slice(-3) !== '...' &&
      currentLine.charAt(0) !== '!'
    ) {
      wrappedLines[wrappedLines.length - 1] += currentLine;
    } else {
      wrappedLines.push(currentLine);
    }
  }
  return wrappedLines;
}

export function normalizeCompilerLogPath(rawPath: string): string {
  if (!rawPath) return '';
  let clean = rawPath
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
  clean = clean.replace(
    /^(?:.*\/)?compiles\/[0-9a-zA-Z_-]+(?:-[0-9a-zA-Z_-]+)?\/(?:\.\/)?/,
    '',
  );
  clean = clean.replace(/^\/?compile\//, '');
  clean = clean.replace(/^(\.\/)+/, '').replace(/^\/+/, '');
  return clean;
}

export function parseLatexLog(raw: string): ParsedLog {
  if (!raw) return { errors: [], warnings: [], badBoxes: [] };
  const cached = parsedLogCache.get(raw);
  if (cached) return cached;

  const lines = unwrapLatexLogLines(raw);
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];
  const indexMaps = new WeakMap<LogEntry[], Map<string, number>>();
  let seenEnvironmentError = false;

  const hasSpecificHardError = lines.some((l) => {
    const trimmed = l.trim();
    return (
      (trimmed.startsWith('!') &&
        trimmed.slice(1).trim() !== FATAL_SUMMARY_ERROR_MESSAGE) ||
      /^Runaway argument\??/i.test(trimmed)
    );
  });

  const tryAdd = (arr: LogEntry[], entry: LogEntry, max: number = 300) => {
    if (arr.length >= max) return;
    const normalizedFile = entry.file ? normalizeCompilerLogPath(entry.file) : undefined;
    const sanitizedEntry: LogEntry = {
      ...entry,
      file: normalizedFile || undefined,
      message: entry.message ? entry.message.replace(/—/g, '-') : '',
      detail: entry.detail ? entry.detail.replace(/—/g, '-') : undefined,
      rawExcerpt: entry.rawExcerpt ? entry.rawExcerpt.replace(/—/g, '-') : undefined,
    };
    const normMsg = sanitizedEntry.message.replace(/\.$/, '').trim().toLowerCase();
    const dedupKey = `${sanitizedEntry.file ?? ''}|${sanitizedEntry.line ?? ''}|${normMsg}`;

    let idxMap = indexMaps.get(arr);
    if (!idxMap) {
      idxMap = new Map<string, number>();
      indexMaps.set(arr, idxMap);
    }

    const existingIdx = idxMap.get(dedupKey);
    if (existingIdx !== undefined) {
      // Merge missing fields (e.g. file, detail, rawExcerpt) into existing entry
      const existing = arr[existingIdx];
      arr[existingIdx] = {
        ...existing,
        file: existing.file || sanitizedEntry.file,
        detail: existing.detail || sanitizedEntry.detail,
        rawExcerpt: existing.rawExcerpt || sanitizedEntry.rawExcerpt,
      };
      return;
    }

    idxMap.set(dedupKey, arr.length);
    arr.push(sanitizedEntry);
  };

  let openParens = 0;
  let rootUserFile: string | undefined;
  const fileStack: string[] = [];
  const getCurrentTrackedFile = (): string | undefined => {
    return fileStack.length > 0 ? fileStack[fileStack.length - 1] : rootUserFile;
  };
  const consumeFilePath = (rest: string): { path: string; consumed: number } | null => {
    if (rest.startsWith('"')) {
      const closeQuote = rest.indexOf('"', 1);
      if (closeQuote !== -1) {
        const candidate = rest.slice(1, closeQuote);
        if (candidate.includes('/') || /\.(?:tex|sty|cls|bib|bbl|aux|toc|out|def|cfg|clo|dfu|fd|mkii|ldf)$/i.test(candidate)) {
          return { path: candidate, consumed: closeQuote + 1 };
        }
      }
    }
    const hasSlashPrefix = /^[\\/]?([^ ()]+[\\/])+/.test(rest);
    const hasExtPrefix = /^[^\s()]+\.(?:tex|sty|cls|bib|bbl|aux|toc|out|def|cfg|clo|dfu|fd|mkii|ldf)/i.test(rest);
    if (!hasSlashPrefix && !hasExtPrefix) {
      return null;
    }
    // Stop at space, parens, or a TeX macro backslash (unless it's a Windows path like `.\appendix\proofs_v1.tex`)
    const isWindowsPath = /^\.\\|^[A-Za-z]:\\/.test(rest);
    let endOfFilePath = rest.search(isWindowsPath ? /[ ()]/ : /[ ()\\]/);
    while (endOfFilePath !== -1 && rest[endOfFilePath] === ' ') {
      const partialPath = rest.slice(0, endOfFilePath);
      if (/\.\w+$/.test(partialPath)) {
        break;
      }
      const remainingPath = rest.slice(endOfFilePath + 1);
      if (/^\s*["()[\]]/.test(remainingPath)) {
        break;
      }
      const nextEndOfPath = remainingPath.search(/[ "()[\]]/);
      if (nextEndOfPath === -1) {
        endOfFilePath = -1;
      } else {
        endOfFilePath += nextEndOfPath + 1;
      }
    }
    const matchedPath = endOfFilePath === -1 ? rest : rest.slice(0, endOfFilePath);
    // Reject author initial slashes like `PK/JW/AB` that have no lowercase letters or file extension
    if (!/[a-z]/.test(matchedPath) && !/\.\w+$/.test(matchedPath)) {
      return null;
    }
    return { path: matchedPath, consumed: matchedPath.length };
  };

  const updateParenStack = (text: string) => {
    let idx = 0;
    while (idx < text.length) {
      const ch = text[idx];
      if (ch === '(') {
        const rest = text.slice(idx + 1);
        const consumed = consumeFilePath(rest);
        if (consumed) {
          const rawMatched = consumed.path.replace(/\\/g, '/');
          const isSystemTexPath =
            rawMatched.includes('texmf') ||
            rawMatched.includes('texlive') ||
            /\.(?:sty|cls|def|cfg|clo|dfu|fd|mkii|ldf)$/i.test(rawMatched);
          if (!isSystemTexPath) {
            const normalizedPath = normalizeCompilerLogPath(rawMatched);
            if (normalizedPath) {
              if (!rootUserFile) rootUserFile = normalizedPath;
              fileStack.push(normalizedPath);
            } else {
              openParens++;
            }
          } else {
            openParens++;
          }
          idx += 1 + consumed.consumed;
          continue;
        } else {
          openParens++;
        }
      } else if (ch === ')') {
        if (openParens > 0) {
          openParens--;
        } else if (fileStack.length > 1) {
          // Official Overleaf `LatexLogParser`: keep root file on stack (`if (this.fileStack.length > 1) this.fileStack.pop()`)
          fileStack.pop();
        }
      }
      idx++;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Official Overleaf `parseRunawayArgumentError`: lines starting with `Runaway argument?`
    if (/^Runaway argument\??$/i.test(line.trim())) {
      const currentTrackedFile = getCurrentTrackedFile();
      let message = line.trim();
      let lineNum: number | undefined;
      let detail: string | undefined;
      const excerptLines: string[] = [line];

      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const cur = lines[j];
        if (cur.startsWith('!')) {
          const bangMsg = cur.slice(1).trim();
          // Consume only the immediate `! Paragraph ended...` or `! File ended...` line associated with the runaway argument;
          // if a subsequent `! Emergency stop.` appears, leave it for the main loop just like Overleaf's `parseRunawayArgumentError`.
          if (bangMsg && bangMsg !== FATAL_SUMMARY_ERROR_MESSAGE && !/^Emergency stop/i.test(bangMsg)) {
            excerptLines.push(cur);
            if (message === line.trim()) {
              message = `Runaway argument? ${bangMsg}`;
            }
            i = j;
            continue;
          } else {
            break;
          }
        }
        excerptLines.push(cur);
        const m = cur.match(/^l\.(\d+)\s*(.*)/);
        if (m) {
          lineNum = parseInt(m[1], 10);
          const rawDetail = m[2].trim();
          detail =
            rawDetail && !/^[@^~.?!\s]+$/.test(rawDetail) && rawDetail.length > 1
              ? rawDetail
              : undefined;
          i = Math.max(i, j);
          break;
        }
      }
      tryAdd(errors, {
        message,
        file: currentTrackedFile,
        line: lineNum,
        detail,
        rawExcerpt: excerptLines.filter((l) => l.trim().length > 0).join('\n'),
      });
      continue;
    }

    // Hard errors: lines starting with !
    if (line.startsWith('!')) {
      let message = line.slice(1).trim();
      // Official Overleaf `currentLineIsError`: ignore final fatal summary line when specific errors already exist
      if (message === FATAL_SUMMARY_ERROR_MESSAGE && hasSpecificHardError) {
        continue;
      }

      // Official Overleaf `HumanReadableLogsRules.tsx` cascading environment suppression (`cascadesFrom: ['environment']`)
      const isCascadingEnvError =
        /Error:\s*`\\end\{([^}]+)\}'\s*expected,?\s*but\s*found\s*`\\end\{([^}]+)\}'/i.test(message) ||
        /Error:\s*Found\s*`\\end\{([^}]+)\}'\s*without\s*corresponding\s*\\begin/i.test(message);
      if (isCascadingEnvError && seenEnvironmentError) {
        continue;
      }
      const isPrimaryEnvError =
        /LaTeX Error:\s*\\begin\{([^}]+)\}(?:\s+on input line \d+)?\s+ended by\s+\\end\{([^}]+)\}/i.test(message) ||
        /Error:\s*`([^']{2,})'\s*expected,\s*found\s*`([^']{2,})'/i.test(message) ||
        isCascadingEnvError;
      if (isPrimaryEnvError) {
        seenEnvironmentError = true;
      }

      const currentTrackedFile = getCurrentTrackedFile();
      let lineNum: number | undefined;
      let detail: string | undefined;
      const excerptLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const cur = lines[j];
        if (cur.startsWith('!')) break;
        excerptLines.push(cur);
        const m = cur.match(/^l\.(\d+)\s*(.*)/);
        if (m) {
          lineNum = parseInt(m[1], 10);
          const rawDetail = m[2].trim();
          detail = rawDetail && !/^[@^~.?!\s]+$/.test(rawDetail) && rawDetail.length > 1 ? rawDetail : undefined;
          for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
            if (lines[k] && !lines[k].startsWith('!')) {
              excerptLines.push(lines[k]);
            }
          }
          break;
        }
      }
      const rawExcerpt = excerptLines.filter((l) => l.trim().length > 0).join('\n');

      // Official Overleaf `HumanReadableLogsPackageSuggestions.ts`: auto-attach quickFix for missing package or mismatched env
      let quickFix: { description: string; replacementText: string } | undefined;
      const envMismatchMatch = message.match(
        /\\begin\{([^}]+)\}(?:\s+on input line \d+)?\s+ended by\s+\\end\{([^}]+)\}/i,
      );
      if (envMismatchMatch) {
        const beginEnv = envMismatchMatch[1];
        quickFix = {
          description: `Replace with \\end{${beginEnv}}`,
          replacementText: `\\end{${beginEnv}}`,
        };
      } else if (/Undefined control sequence/i.test(message) && rawExcerpt) {
        const firstLineCmd = rawExcerpt.match(/^[^\n]*\\([a-zA-Z]+)\s*(?:\n|$)/);
        const anyLineCmd = rawExcerpt.match(/\\([a-zA-Z]+)\s*(?:\n|$)/m) || (detail ? detail.match(/\\([a-zA-Z]+)/) : null);
        const cmdName = firstLineCmd ? firstLineCmd[1] : anyLineCmd ? anyLineCmd[1] : '';
        if (cmdName && PKG_LOOKUP[cmdName]) {
          const pkg = PKG_LOOKUP[cmdName];
          quickFix = {
            description: `Add \\usepackage{${pkg}} to preamble`,
            replacementText: `\\usepackage{${pkg}}`,
          };
        }
      } else {
        const undefEnvMatch = message.match(/LaTeX Error:\s*Environment\s+([^\s]+)\s+undefined/i);
        if (undefEnvMatch && ENV_PKG_LOOKUP[undefEnvMatch[1]]) {
          const pkg = ENV_PKG_LOOKUP[undefEnvMatch[1]];
          quickFix = {
            description: `Add \\usepackage{${pkg}} to preamble`,
            replacementText: `\\usepackage{${pkg}}`,
          };
        }
      }

      tryAdd(errors, {
        message,
        file: currentTrackedFile,
        line: lineNum,
        detail,
        rawExcerpt: rawExcerpt || undefined,
        quickFix,
      });
    }

    // File:line: format errors (e.g. ./main.tex:10: Undefined control sequence)
    const fle = line.match(/^([^:!]*\.(?:tex|sty|cls|bib)):(\d+):\s*(.+)$/);
    if (fle) {
      const excerptLines: string[] = [line];
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (lines[j] && !lines[j].startsWith('!') && !lines[j].includes('Warning:')) {
          excerptLines.push(lines[j]);
        } else {
          break;
        }
      }
      tryAdd(errors, {
        message: fle[3].trim(),
        file: normalizeCompilerLogPath(fle[1]),
        line: parseInt(fle[2], 10),
        rawExcerpt: excerptLines.join('\n'),
      });
    }

    // Official Overleaf `BibLogParser` — BibTeX Errors:
    // Format 1: `<Reason>---line <N> of file <file.bib>` OR `<Reason>\n---line <N> of file <file.aux>`
    const bibErrMatch = line.trim().match(/^(.*?)---line\s+(\d+)\s+of\s+file\s+(\S+)$/i);
    if (bibErrMatch && !/^Warning--/i.test(line.trim())) {
      const prevLineText = i > 0 ? lines[i - 1].trim() : '';
      const reason = bibErrMatch[1].trim() || prevLineText;
      const bibLine = parseInt(bibErrMatch[2], 10);
      const bibFile = bibErrMatch[3].replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
      const excerptLines: string[] = reason && !bibErrMatch[1].trim() ? [prevLineText, line.trim()] : [line.trim()];
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        excerptLines.push(lines[j]);
        if (/I'm skipping whatever remains of this (?:entry|command)/i.test(lines[j])) {
          i = j;
          break;
        }
      }
      tryAdd(errors, {
        message: `BibTeX error: ${reason} (in ${bibFile}, line ${bibLine})`,
        file: bibFile,
        line: bibLine,
        rawExcerpt: excerptLines.join('\n'),
      });
      continue;
    }

    // Format 2: BibTeX bad cross reference (`A bad cross reference---entry "..." refers to entry "...", which doesn't exist`)
    const badCrossRefMatch = line.trim().match(/^(A bad cross reference---entry\s+.+)$/i);
    if (badCrossRefMatch) {
      let fullCrossRefMsg = badCrossRefMatch[1].trim();
      if (i + 1 < lines.length && /^refers to entry/i.test(lines[i + 1].trim())) {
        fullCrossRefMsg += ' ' + lines[i + 1].trim();
        i++;
      }
      tryAdd(errors, {
        message: fullCrossRefMsg,
        file: getCurrentTrackedFile(),
        rawExcerpt: fullCrossRefMsg,
      });
      continue;
    }

    // Format 3: BibTeX `.aux` / `.bst` error (`...---while reading file <file.aux>`)
    const bibWhileReadingMatch = line.trim().match(/^(.*?)---while reading file\s+(\S+)$/i);
    if (bibWhileReadingMatch) {
      const reason = bibWhileReadingMatch[1].trim();
      const auxFile = bibWhileReadingMatch[2].replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
      tryAdd(errors, {
        message: `BibTeX error: ${reason} (while reading ${auxFile})`,
        file: auxFile,
        rawExcerpt: line.trim(),
      });
      continue;
    }

    // Official Overleaf `BibLogParser` & `LaTeX-Workshop` — Biber Subsystem Errors & Warnings:
    // Format: `[245] Utils.pm:410> ERROR - BibTeX subsystem: /compile/references.bib_1234.utf8, line 15, syntax error: ...`
    // or `ERROR - BibTeX subsystem encountered ..., line 42, ...` or `Biber warning: WARN - ...`
    const biberMatch = line
      .trim()
      .match(/^(?:Biber\s+warning:\s*|\[\d+\]\s+\S+>\s+)?(WARN|ERROR)\s+-\s+(.*)$/i);
    if (biberMatch) {
      const level = biberMatch[1].toUpperCase();
      const body = biberMatch[2].trim();
      const subsysMatch = body.match(
        /^BibTeX subsystem:\s*(?:.*\/)?([A-Za-z0-9_.-]+\.bib)(?:_\d+\.utf8)?,\s*line\s+(\d+),\s*(.+)$/i
      );
      const genericLineMatch = body.match(/,\s*line\s+(\d+),\s*(.+)$/i);
      const resolvedLine = subsysMatch
        ? parseInt(subsysMatch[2], 10)
        : genericLineMatch
          ? parseInt(genericLineMatch[1], 10)
          : undefined;
      if (level === 'ERROR') {
        tryAdd(errors, {
          message: subsysMatch ? `Biber error: ${subsysMatch[3].trim()}` : `Biber error: ${body}`,
          file: subsysMatch ? subsysMatch[1] : getCurrentTrackedFile(),
          line: resolvedLine,
          rawExcerpt: line.trim(),
        });
        continue;
      } else {
        tryAdd(warnings, {
          message: `WARN - ${body}`,
          file: subsysMatch ? subsysMatch[1] : getCurrentTrackedFile(),
          line: resolvedLine,
        });
        continue;
      }
    }

    // Missing character warnings (Overleaf `HumanReadableLogsRules` `hint_missing_character_there_is_no_in_font` & LaTeX-Workshop)
    if (/^Missing character\s*:\s*There is no\s+.+\s+in font\s+/i.test(line.trim())) {
      tryAdd(warnings, {
        message: line.trim(),
        file: getCurrentTrackedFile(),
      });
      updateParenStack(line);
      continue;
    }

    // Warnings: LaTeX Warning:, LaTeX3 Warning:, LaTeX Font Warning:, Package X Warning:, Class X Warning:, Module X Warning:, pdfTeX warning:, xdvipdfmx warning:
    if (/(?:LaTeX3?|LaTeX\s+Font|(?:Package|Class|Module)\s+\S+|pdfTeX|xdvipdfmx)\s+[Ww]arning:/.test(line)) {
      const currentTrackedFile = getCurrentTrackedFile();
      let msg = line.trim();
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        if (/^\s{2,}/.test(lines[j]) || /^\([A-Za-z0-9_-]+\)\s+/.test(lines[j])) {
          const cleanCont = lines[j].replace(/^\([A-Za-z0-9_-]+\)\s*/, '').trim();
          if (cleanCont) {
            msg += ' ' + cleanCont;
          }
          i = j;
        } else {
          break;
        }
      }
      if (
        seenEnvironmentError &&
        /Warning:\s*No matching \\end found for `\\begin\{/i.test(msg)
      ) {
        updateParenStack(line);
        continue;
      }
      const lineRef = msg.match(/(?:input )?line (\d+)/i);
      tryAdd(warnings, {
        message: msg,
        file: currentTrackedFile,
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
      updateParenStack(line);
      continue;
    }

    // BibTeX warnings (e.g. Warning--empty journal in vaswani2017attention, Warning--I didn't find a database entry for "...")
    if (/^Warning--/i.test(line.trim())) {
      const currentTrackedFile = getCurrentTrackedFile();
      let msg = line.trim();
      if (i + 1 < lines.length && /^--line\s+(\d+)\s+of\s+file\s+(\S+)/i.test(lines[i + 1].trim())) {
        msg += ' ' + lines[i + 1].trim();
        i++;
      }
      const bibLineMatch = msg.match(/--line\s+(\d+)\s+of\s+file\s+([^\s]+)/i);
      tryAdd(warnings, {
        message: msg,
        file: bibLineMatch ? bibLineMatch[2].replace(/^\.\//, '') : currentTrackedFile,
        line: bibLineMatch ? parseInt(bibLineMatch[1], 10) : undefined,
      });
      updateParenStack(line);
      continue;
    }

    // Bad boxes: Overfull/Underfull \hbox or \vbox
    if (/^(Overfull|Underfull)\s*\\[hv]box/.test(line)) {
      const currentTrackedFile = getCurrentTrackedFile();
      const lineRef = line.match(/lines?\s+(\d+)/);
      tryAdd(badBoxes, {
        message: line.trim(),
        file: currentTrackedFile,
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
      updateParenStack(line);
      continue;
    }

    updateParenStack(line);
  }

  const result: ParsedLog = { errors, warnings, badBoxes };
  if (parsedLogCache.size >= PARSED_LOG_CACHE_MAX) {
    const firstKey = parsedLogCache.keys().next().value;
    if (firstKey) parsedLogCache.delete(firstKey);
  }
  parsedLogCache.set(raw, result);

  return result;
}

