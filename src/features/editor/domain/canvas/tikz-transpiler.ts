/**
 * tikz-transpiler.ts
 *
 * Transpiles visual Canvas Elements into clean, idiomatic LaTeX TikZ code.
 * Supports shapes, styling, directional connectors, typography, and standalone document wrapping.
 */

import type { CanvasElement, TikZExportOptions } from './canvas-types';

export function sanitizeTikzId(id: string): string {
  return `node_${id.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function escapePlainLatexSegment(segment: string): string {
  return segment
    .replace(/\\/g, '\u0000BACKSLASH\u0000')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\u0000BACKSLASH\u0000/g, '\\textbackslash{}')
    .replace(/\n/g, '\\\\ ');
}

export function escapeLatexText(text: string): string {
  if (!text) return '';
  // Preserve balanced inline math ($...$) in academic diagram node/edge labels while escaping prose
  const parts = text.split(/(\$[^$\n]+\$)/g);
  return parts
    .map((part) => (part.startsWith('$') && part.endsWith('$') && part.length >= 2 ? part : escapePlainLatexSegment(part)))
    .join('');
}

export function hexToTikzColorName(hex?: string): string {
  if (!hex) return 'black';
  const cleanHex = hex.replace('#', '').toLowerCase();

  const standardColors: Record<string, string> = {
    '000000': 'black',
    'ffffff': 'white',
    'ef4444': 'red!80!black',
    'f97316': 'orange',
    'f59e0b': 'yellow!70!black',
    '10b981': 'green!70!black',
    '06b6d4': 'cyan',
    '3b82f6': 'blue!80!black',
    '6366f1': 'indigo',
    '8b5cf6': 'purple!70!black',
    'ec4899': 'pink',
    '64748b': 'gray',
  };

  if (standardColors[cleanHex]) {
    return standardColors[cleanHex];
  }

  return `c_${cleanHex}`;
}

export class TikZTranspiler {
  public static transpile(
    elements: CanvasElement[],
    options: TikZExportOptions = {}
  ): string {
    if (!elements || elements.length === 0) {
      return '% Empty canvas diagram\n\\begin{tikzpicture}\n\\end{tikzpicture}';
    }

    const scale = options.scale && options.scale > 0 ? options.scale : 40; // 40px = 1cm
    const nodes = elements.filter((el) => el.type !== 'arrow');
    const arrows = elements.filter((el) => el.type === 'arrow');

    // Calculate bounding box for normalization (so diagram is anchored near (0, 0))
    let minX = Infinity;
    let minY = Infinity;

    for (const el of elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      if (el.points && el.points.length > 0) {
        for (const pt of el.points) {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
        }
      }
    }

    if (minX === Infinity) minX = 0;
    if (minY === Infinity) minY = 0;

    const lines: string[] = [];
    const customColors = new Map<string, string>();

    // Discover custom hex colors
    for (const el of elements) {
      if (el.fillColor && el.fillColor.startsWith('#')) {
        const name = hexToTikzColorName(el.fillColor);
        if (name.startsWith('c_')) {
          customColors.set(name, el.fillColor.replace('#', ''));
        }
      }
      if (el.strokeColor && el.strokeColor.startsWith('#')) {
        const name = hexToTikzColorName(el.strokeColor);
        if (name.startsWith('c_')) {
          customColors.set(name, el.strokeColor.replace('#', ''));
        }
      }
    }

    // Generate TikZ content
    lines.push('\\begin{tikzpicture}[');
    lines.push('  >=stealth,');
    lines.push('  node distance=2cm,');
    lines.push('  every node/.style={font=\\small},');
    lines.push('  every edge/.style={draw, thick}');
    lines.push(']');
    lines.push('');

    // Generate Nodes
    const elementIdToTikzId = new Map<string, string>();
    for (const el of nodes) {
      const tikzId = sanitizeTikzId(el.id);
      elementIdToTikzId.set(el.id, tikzId);

      // In TikZ, center of shape is (x + w/2, -(y + h/2)) relative to top-left origin
      const cx = ((el.x + el.width / 2 - minX) / scale).toFixed(2);
      const cy = (-((el.y + el.height / 2 - minY) / scale)).toFixed(2);
      const widthCm = (Math.max(20, el.width) / scale).toFixed(2);
      const heightCm = (Math.max(20, el.height) / scale).toFixed(2);

      const styleAttrs: string[] = [];

      switch (el.type) {
        case 'rectangle':
          styleAttrs.push('rectangle', 'draw');
          break;
        case 'ellipse':
          styleAttrs.push('ellipse', 'draw');
          break;
        case 'diamond':
          styleAttrs.push('diamond', 'aspect=2', 'draw');
          break;
        case 'database':
          styleAttrs.push('cylinder', 'shape border rotate=90', 'aspect=0.25', 'draw');
          break;
        case 'cloud':
          styleAttrs.push('cloud', 'cloud puffs=10', 'aspect=2', 'draw');
          break;
        case 'text':
          styleAttrs.push(`text width=${widthCm}cm`, 'align=center');
          break;
        default:
          styleAttrs.push('rectangle', 'draw');
      }

      if (el.type !== 'text') {
        styleAttrs.push(`minimum width=${widthCm}cm`);
        styleAttrs.push(`minimum height=${heightCm}cm`);

        if (el.fillColor) {
          const fillName = hexToTikzColorName(el.fillColor);
          styleAttrs.push(`fill=${fillName}!20`);
        }
        if (el.strokeColor) {
          const strokeName = hexToTikzColorName(el.strokeColor);
          styleAttrs.push(`draw=${strokeName}`);
        }
        if (el.strokeStyle === 'dashed') {
          styleAttrs.push('dashed');
        } else if (el.strokeStyle === 'dotted') {
          styleAttrs.push('dotted');
        }
      }

      const label = el.text ? escapeLatexText(el.text) : '';
      lines.push(`  \\node[${styleAttrs.join(', ')}] (${tikzId}) at (${cx}, ${cy}) {${label}};`);
    }

    if (arrows.length > 0) {
      lines.push('');
      lines.push('  % Connectors & Relationships');
    }

    // Generate Connectors / Arrows
    for (const arrow of arrows) {
      const sourceId = arrow.sourceElementId;
      const targetId = arrow.targetElementId;
      const arrowStart = arrow.arrowStart ?? false;
      const arrowEnd = arrow.arrowEnd ?? true;

      let arrowSpec = '--';
      if (arrowStart && arrowEnd) {
        arrowSpec = '<->';
      } else if (arrowEnd) {
        arrowSpec = '->';
      } else if (arrowStart) {
        arrowSpec = '<-';
      }

      const styleAttrs: string[] = [arrowSpec, 'thick'];
      if (arrow.strokeColor) {
        const strokeName = hexToTikzColorName(arrow.strokeColor);
        styleAttrs.push(`draw=${strokeName}`);
      }
      if (arrow.strokeStyle === 'dashed') {
        styleAttrs.push('dashed');
      } else if (arrow.strokeStyle === 'dotted') {
        styleAttrs.push('dotted');
      }

      const labelNode = arrow.text
        ? ` node[midway, above, font=\\footnotesize] {${escapeLatexText(arrow.text)}}`
        : '';

      if (sourceId && targetId && elementIdToTikzId.has(sourceId) && elementIdToTikzId.has(targetId)) {
        const fromNode = elementIdToTikzId.get(sourceId);
        const toNode = elementIdToTikzId.get(targetId);
        lines.push(`  \\draw[${styleAttrs.join(', ')}] (${fromNode}) --${labelNode} (${toNode});`);
      } else if (arrow.points && arrow.points.length >= 2) {
        const pointStrs = arrow.points.map((pt) => {
          const px = ((pt.x - minX) / scale).toFixed(2);
          const py = (-((pt.y - minY) / scale)).toFixed(2);
          return `(${px}, ${py})`;
        });
        lines.push(`  \\draw[${styleAttrs.join(', ')}] ${pointStrs.join(' --')}${labelNode};`);
      }
    }

    lines.push('\\end{tikzpicture}');

    let result = lines.join('\n');

    // Prepend custom color definitions if any were defined
    if (customColors.size > 0) {
      const colorDefs: string[] = [];
      for (const [name, hex] of customColors.entries()) {
        colorDefs.push(`\\definecolor{${name}}{HTML}{${hex.toUpperCase()}}`);
      }
      result = `${colorDefs.join('\n')}\n\n${result}`;
    }

    // Wrap in full document if requested
    if (options.includeDocumentWrapper) {
      result = `\\documentclass[border=10pt]{standalone}
\\usepackage{tikz}
\\usetikzlibrary{shapes.geometric, arrows.meta, positioning, shapes.symbols}
\\usepackage{xcolor}

\\begin{document}
${result}
\\end{document}`;
    }

    return result;
  }
}
