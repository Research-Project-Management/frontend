/**
 * tikz-transpiler.ts
 *
 * AST TikZ Transpiler for converting diagram canvas elements into compilable LaTeX/TikZ code.
 */

import type { CanvasElement } from './canvas-types';

export interface TikZTranspileOptions {
  scale?: number;
  includeDocumentWrapper?: boolean;
}

/**
 * Escapes special LaTeX characters in prose while preserving inline math ($...$).
 */
export function escapeLatexText(text: string): string {
  if (!text) return '';

  // Split by inline math segments $...$ so math contents are preserved untouched
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
        return part;
      }
      return part
        .replace(/\\/g, '\x00BACKSLASH\x00')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/\x00BACKSLASH\x00/g, '\\textbackslash{}');
    })
    .join('');
}

function sanitizeNodeId(id: string): string {
  return `node_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function normalizeHexColor(color?: string): { name: string; hex: string } | null {
  if (!color) return null;
  const clean = color.trim().replace(/^#/, '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(clean)) return null;
  return {
    name: `c_${clean.toLowerCase()}`,
    hex: clean,
  };
}

export class TikZTranspiler {
  public static transpile(
    elements: CanvasElement[],
    options: TikZTranspileOptions = {},
  ): string {
    const scale = options.scale && options.scale > 0 ? options.scale : 50;
    const colorDefs = new Map<string, string>();
    const nodeLines: string[] = [];
    const edgeLines: string[] = [];

    for (const el of elements) {
      const fill = normalizeHexColor(el.fillColor);
      if (fill) colorDefs.set(fill.name, fill.hex);
      const stroke = normalizeHexColor(el.strokeColor);
      if (stroke) colorDefs.set(stroke.name, stroke.hex);

      if (el.type === 'arrow') {
        const src = el.sourceElementId ? sanitizeNodeId(el.sourceElementId) : '';
        const dst = el.targetElementId ? sanitizeNodeId(el.targetElementId) : '';
        const arrowStyle = el.arrowStart && el.arrowEnd ? '<->' : '->';
        const label = el.text ? ` node[midway, above, font=\\footnotesize] {${escapeLatexText(el.text)}}` : '';
        if (src && dst) {
          edgeLines.push(`  \\draw[${arrowStyle}, thick] (${src}) --${label} (${dst});`);
        } else {
          const x1 = ((el.x || 0) / scale).toFixed(2);
          const y1 = (-((el.y || 0) / scale)).toFixed(2);
          const x2 = (((el.x || 0) + (el.width || 0)) / scale).toFixed(2);
          const y2 = (-(((el.y || 0) + (el.height || 0)) / scale)).toFixed(2);
          edgeLines.push(`  \\draw[${arrowStyle}, thick] (${x1},${y1}) --${label} (${x2},${y2});`);
        }
      } else {
        const nodeId = sanitizeNodeId(el.id);
        const cx = (((el.x || 0) + (el.width || 0) / 2) / scale).toFixed(2);
        const cy = (-(((el.y || 0) + (el.height || 0) / 2) / scale)).toFixed(2);
        const shape =
          el.type === 'diamond'
            ? 'diamond'
            : el.type === 'ellipse'
              ? 'ellipse'
              : el.type === 'database'
                ? 'cylinder, shape border rotate=90'
                : 'rectangle, rounded corners=2pt';
        const styleParts = ['draw', shape, 'align=center'];
        if (stroke) styleParts.push(`draw=${stroke.name}`);
        if (fill) styleParts.push(`fill=${fill.name}`);
        const label = escapeLatexText(el.text || '');
        nodeLines.push(`  \\node[${styleParts.join(', ')}] (${nodeId}) at (${cx}, ${cy}) {${label}};`);
      }
    }

    const lines: string[] = [];
    if (options.includeDocumentWrapper) {
      lines.push('\\documentclass[border=10pt]{standalone}');
      lines.push('\\usepackage{tikz}');
      lines.push('\\usepackage{xcolor}');
      lines.push('\\usetikzlibrary{shapes.geometric, arrows.meta, positioning}');
      lines.push('\\begin{document}');
    }

    lines.push('\\begin{tikzpicture}[>=Latex]');
    for (const [name, hex] of colorDefs.entries()) {
      lines.push(`  \\definecolor{${name}}{HTML}{${hex}}`);
    }
    lines.push(...nodeLines);
    lines.push(...edgeLines);
    lines.push('\\end{tikzpicture}');

    if (options.includeDocumentWrapper) {
      lines.push('\\end{document}');
    }

    return lines.join('\n');
  }
}
