import type { LogEntry, ParsedLog } from '@/features/editor/domain/types';

export const PARSED_LOG_CACHE_MAX = 5;
export const parsedLogCache = new Map<string, ParsedLog>();

export const DEFAULT_OUTPUT_FILES = [
  'output.aux',
  'output.chktex',
  'output.log',
  'output.pdfxref',
  'output.stderr',
  'output.stdout',
  'output.synctex.gz',
];

export function parseLatexLog(raw: string): ParsedLog {
  if (!raw) return { errors: [], warnings: [], badBoxes: [] };
  const cached = parsedLogCache.get(raw);
  if (cached) return cached;

  const lines = raw.split('\n');
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];
  const seen = new Set<string>();

  const tryAdd = (arr: LogEntry[], entry: LogEntry, max: number = 300) => {
    if (arr.length >= max) return;
    const sanitizedEntry: LogEntry = {
      ...entry,
      message: entry.message ? entry.message.replace(/—/g, '-') : '',
      detail: entry.detail ? entry.detail.replace(/—/g, '-') : undefined,
      rawExcerpt: entry.rawExcerpt ? entry.rawExcerpt.replace(/—/g, '-') : undefined,
    };
    const key = `${sanitizedEntry.file ?? ''}|${sanitizedEntry.line ?? ''}|${sanitizedEntry.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      arr.push(sanitizedEntry);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hard errors: lines starting with !
    if (line.startsWith('!')) {
      const message = line.slice(1).trim();
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
      tryAdd(errors, { message, line: lineNum, detail, rawExcerpt: rawExcerpt || undefined });
    }

    // File:line: format errors (e.g. ./main.tex:10: Undefined control sequence)
    const fle = line.match(/^(\.{1,2}\/[^\s:!]*\.(?:tex|sty|cls|bib)):(\d+):\s*(.+)$/);
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
        file: fle[1].replace(/^\.\//, ''),
        line: parseInt(fle[2], 10),
        rawExcerpt: excerptLines.join('\n'),
      });
    }

    // Warnings: LaTeX Warning:, Package X Warning:, Class X Warning:, pdfTeX warning:
    if (/(?:LaTeX|(?:Package|Class)\s+\S+|pdfTeX|xdvipdfmx)\s+[Ww]arning:/.test(line)) {
      let msg = line.trim();
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (/^\s{2,}/.test(lines[j])) msg += ' ' + lines[j].trim();
        else break;
      }
      const lineRef = msg.match(/input line (\d+)/);
      tryAdd(warnings, {
        message: msg,
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }

    // Bad boxes: Overfull/Underfull \hbox or \vbox
    if (/^(Overfull|Underfull)\s*\\[hv]box/.test(line)) {
      const lineRef = line.match(/lines?\s+(\d+)/);
      tryAdd(badBoxes, {
        message: line.trim(),
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }
  }

  const result: ParsedLog = { errors, warnings, badBoxes };
  if (parsedLogCache.size >= PARSED_LOG_CACHE_MAX) {
    const firstKey = parsedLogCache.keys().next().value;
    if (firstKey) parsedLogCache.delete(firstKey);
  }
  parsedLogCache.set(raw, result);

  return result;
}
