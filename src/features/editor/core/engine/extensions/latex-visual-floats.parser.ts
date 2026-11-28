/**
 * latex-visual-floats.parser.ts
 *
 * Pure LaTeX float block scanner & figure metadata extractor (figure/table/tabular).
 */

import type { Text } from '@codemirror/state';
import { findBeginDocumentLine } from './latex-visual-document-shell';
import { cleanInlineLatexText, findMatchingBrace } from './latex-visual-headings';

const END_DOC_RE = /^\s*\\end\{document\}\s*(?:%.*)?$/;
const BEGIN_FLOAT_RE = /^\s*\\begin\{(figure\*?|table\*?|tabular\*?)\}(.*)$/;

export interface FloatBlockMatch {
  readonly baseKind: 'figure' | 'table' | 'tabular';
  readonly envName: string;
  readonly from: number;
  readonly to: number;
  readonly raw: string;
}

export interface FigureImageInfo {
  readonly path: string;
  readonly options: string;
}

export interface FigureMetadata {
  readonly images: FigureImageInfo[];
  readonly caption?: string;
  readonly label?: string;
}

export function stripLatexLineComments(text: string): string {
  return text.replace(/(^|[^\\])%.*$/gm, '$1');
}

function extractBalancedCommand(text: string, prefixPattern: RegExp): string | undefined {
  const re = new RegExp(prefixPattern.source, 'g');
  const match = re.exec(text);
  if (!match) return undefined;
  const openBrace = match.index + match[0].length - 1;
  const closeBrace = findMatchingBrace(text, openBrace);
  if (closeBrace === null) return undefined;
  const value = text.slice(openBrace + 1, closeBrace).trim();
  return value || undefined;
}

export function parseFigureMetadata(rawBlock: string): FigureMetadata {
  const cleaned = stripLatexLineComments(rawBlock);
  const images: FigureImageInfo[] = [];

  const imgRegex = /\\includegraphics\*?(?:\s*\[([^\]]*)\])?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(cleaned)) !== null) {
    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(cleaned, openBrace);
    if (closeBrace !== null) {
      const path = cleaned.slice(openBrace + 1, closeBrace).trim();
      if (path) {
        images.push({
          path,
          options: match[1]?.trim() ?? '',
        });
      }
      imgRegex.lastIndex = closeBrace + 1;
    }
  }

  const rawCaption = extractBalancedCommand(cleaned, /\\caption\*?(?:\s*\[[^\]]*\])?\s*\{/);
  const caption = rawCaption ? cleanInlineLatexText(rawCaption) : undefined;
  const label = extractBalancedCommand(cleaned, /\\label\s*\{/);

  return { images, caption, label };
}

export function findFloatBlocks(doc: Text): FloatBlockMatch[] {
  if (doc.length === 0) return [];

  const beginDocLine = findBeginDocumentLine(doc);
  const bodyStartLine = beginDocLine ? beginDocLine.number + 1 : 1;

  const blocks: FloatBlockMatch[] = [];
  let active: {
    baseKind: 'figure' | 'table' | 'tabular';
    envName: string;
    from: number;
    nesting: number;
  } | null = null;

  for (let l = bodyStartLine; l <= doc.lines; l++) {
    const line = doc.line(l);
    const text = line.text;

    if (END_DOC_RE.test(text)) break;

    if (!active) {
      const beginMatch = BEGIN_FLOAT_RE.exec(text);
      if (!beginMatch) continue;

      const envName = beginMatch[1]!;
      const restOfLine = beginMatch[2] ?? '';
      const baseKind = envName.startsWith('figure')
        ? 'figure'
        : envName.startsWith('table')
          ? 'table'
          : 'tabular';

      const escapedEnv = envName.replace(/\*/g, '\\*');
      const sameLineEndRe = new RegExp(`\\\\end\\{${escapedEnv}\\}`);
      if (sameLineEndRe.test(restOfLine)) {
        blocks.push({
          baseKind,
          envName,
          from: line.from,
          to: line.to,
          raw: doc.sliceString(line.from, line.to),
        });
        continue;
      }

      active = { baseKind, envName, from: line.from, nesting: 1 };
      continue;
    }

    const lineNoComment = stripLatexLineComments(text);
    const escapedEnv = active.envName.replace(/\*/g, '\\*');
    const nestedBeginRe = new RegExp(`\\\\begin\\{${escapedEnv}\\}`, 'g');
    const nestedEndRe = new RegExp(`\\\\end\\{${escapedEnv}\\}`, 'g');

    const beginsOnLine = lineNoComment.match(nestedBeginRe)?.length ?? 0;
    const endsOnLine = lineNoComment.match(nestedEndRe)?.length ?? 0;
    active.nesting += beginsOnLine - endsOnLine;

    if (active.nesting <= 0) {
      blocks.push({
        baseKind: active.baseKind,
        envName: active.envName,
        from: active.from,
        to: line.to,
        raw: doc.sliceString(active.from, line.to),
      });
      active = null;
    }
  }

  return blocks;
}
