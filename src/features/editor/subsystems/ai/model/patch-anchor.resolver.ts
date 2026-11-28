/**
 * patch-anchor.resolver.ts
 *
 * Pure text anchor matching & diff range resolution for AI-generated LaTeX patches.
 */

import type { EditorPatchItem } from '@/features/ai';

export interface ResolvedAnchorRange {
  from: number;
  to: number;
  originalText: string;
  replacementText: string;
}

function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function findAllExactRanges(haystack: string, needle: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  if (!needle) return ranges;
  let pos = 0;
  while (pos <= haystack.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    ranges.push({ from: idx, to: idx + needle.length });
    pos = idx + 1;
  }
  return ranges;
}

function findTrimmedLineRanges(content: string, searchText: string): Array<{ from: number; to: number }> {
  const searchLines = normalizeEol(searchText)
    .split('\n')
    .map((line) => line.trim());
  while (searchLines.length > 0 && searchLines[0] === '') searchLines.shift();
  while (searchLines.length > 0 && searchLines[searchLines.length - 1] === '') searchLines.pop();
  if (searchLines.length === 0) return [];

  const docLines = content.split('\n');
  if (docLines.length < searchLines.length) return [];

  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of docLines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  const trimmedDoc = docLines.map((line) => line.replace(/\r$/, '').trim());
  const window = searchLines.length;
  const ranges: Array<{ from: number; to: number }> = [];

  for (let i = 0; i <= docLines.length - window; i++) {
    let allEqual = true;
    for (let j = 0; j < window; j++) {
      if (trimmedDoc[i + j] !== searchLines[j]) {
        allEqual = false;
        break;
      }
    }
    if (allEqual) {
      const from = lineStarts[i];
      const lastRaw = docLines[i + window - 1].replace(/\r$/, '');
      const to = lineStarts[i + window - 1] + lastRaw.length;
      ranges.push({ from, to });
    }
  }
  return ranges;
}

function pickDisambiguatedRange(
  content: string,
  ranges: Array<{ from: number; to: number }>,
  fromLine?: number,
): { from: number; to: number } | null {
  if (ranges.length === 0) return null;
  if (ranges.length === 1) return ranges[0];
  if (typeof fromLine !== 'number' || fromLine < 1) return null;

  let best: { range: { from: number; to: number }; dist: number } | null = null;
  let tied = false;

  for (const r of ranges) {
    const lineNum = content.slice(0, r.from).split('\n').length;
    const dist = Math.abs(lineNum - fromLine);
    if (dist > 5) continue;
    if (!best || dist < best.dist) {
      best = { range: r, dist };
      tied = false;
    } else if (dist === best.dist) {
      tied = true;
    }
  }

  return best && !tied ? best.range : null;
}

const DOC_CLASS_RE = /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/;

function findAfterDocumentClassPos(content: string): number {
  const match = DOC_CLASS_RE.exec(content);
  if (!match) return -1;
  const endOfMatch = match.index + match[0].length;
  const nextNewline = content.indexOf('\n', endOfMatch);
  return nextNewline === -1 ? content.length : nextNewline + 1;
}

function formatLineInsertion(content: string, pos: number, lines: string[]): string {
  const needsLeadingNewline = pos > 0 && content[pos - 1] !== '\n';
  return `${needsLeadingNewline ? '\n' : ''}${lines.join('\n')}\n`;
}

export function resolveAnchorInContent(
  content: string,
  patch: Pick<EditorPatchItem, 'kind' | 'searchText' | 'replaceText' | 'fromLine' | 'toLine'>,
): ResolvedAnchorRange | null {
  if (typeof content !== 'string') return null;
  const search = normalizeEol(patch.searchText || '');
  const replacement = normalizeEol(patch.replaceText || '');
  const afterDocClass = findAfterDocumentClassPos(content);
  const insertsUsepackageOnly =
    /\\usepackage/.test(replacement) && !DOC_CLASS_RE.test(replacement);

  const buildMatchResult = (chosen: { from: number; to: number }): ResolvedAnchorRange => {
    if (afterDocClass !== -1 && chosen.from < afterDocClass && insertsUsepackageOnly) {
      const addedLines = replacement
        .split('\n')
        .filter((ln) => ln.trim().length > 0);
      if (addedLines.length > 0) {
        return {
          from: afterDocClass,
          to: afterDocClass,
          originalText: '',
          replacementText: formatLineInsertion(content, afterDocClass, addedLines),
        };
      }
    }
    return {
      from: chosen.from,
      to: chosen.to,
      originalText: content.slice(chosen.from, chosen.to),
      replacementText: replacement,
    };
  };

  if (search.length > 0) {
    const exact = findAllExactRanges(content, search);
    const chosen = pickDisambiguatedRange(content, exact, patch.fromLine);
    if (chosen) return buildMatchResult(chosen);

    const trimmed = findTrimmedLineRanges(content, search);
    const chosenTrimmed = pickDisambiguatedRange(content, trimmed, patch.fromLine);
    if (chosenTrimmed) return buildMatchResult(chosenTrimmed);
  }

  if (patch.kind === 'insert_preamble') {
    const addedLines = replacement
      .split('\n')
      .filter((ln) => ln.trim() !== '\\begin{document}' && !DOC_CLASS_RE.test(ln) && ln.trim().length > 0);
    if (addedLines.length === 0) return null;

    const beginIdx = content.indexOf('\\begin{document}');
    let insertPos = -1;
    if (beginIdx !== -1) {
      const beginLineStart = content.lastIndexOf('\n', beginIdx) + 1;
      insertPos =
        afterDocClass !== -1 && beginLineStart < afterDocClass
          ? afterDocClass
          : beginLineStart;
    } else if (afterDocClass !== -1) {
      insertPos = afterDocClass;
    }

    if (insertPos !== -1) {
      return {
        from: insertPos,
        to: insertPos,
        originalText: '',
        replacementText: formatLineInsertion(content, insertPos, addedLines),
      };
    }
  }

  return null;
}
