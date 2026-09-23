/**
 * math-hover.provider.ts
 *
 * Math syntax detection for LaTeX math regions ($...$, $$...$$, \[...\], \begin{equation}...\end{equation}).
 * Pure TypeScript, zero external dependencies.
 */

export interface MathHoverMatch {
  type: 'inline' | 'display' | 'bracket' | 'environment';
  formula: string;
  startCol: number;
  endCol: number;
}

export function detectMathAtPosition(lineContent: string, col: number): MathHoverMatch | null {
  // 1. Check for display math $$...$$ first (to avoid conflict with inline $...$)
  let match: RegExpExecArray | null;
  const displayMathRegex = /\$\$([^$]+?)\$\$/g;
  while ((match = displayMathRegex.exec(lineContent)) !== null) {
    const startCol = match.index + 1;
    const endCol = startCol + match[0].length;
    if (col >= startCol && col <= endCol) {
      return {
        type: 'display',
        formula: match[1].trim(),
        startCol,
        endCol,
      };
    }
  }

  // 2. Check for \[ ... \]
  const bracketMathRegex = /\\\[([\s\S]*?)\\\]/g;
  while ((match = bracketMathRegex.exec(lineContent)) !== null) {
    const startCol = match.index + 1;
    const endCol = startCol + match[0].length;
    if (col >= startCol && col <= endCol) {
      return {
        type: 'bracket',
        formula: match[1].trim(),
        startCol,
        endCol,
      };
    }
  }

  // 3. Check for inline math $...$
  const inlineMathRegex = /(?<!\\)\$([^$]+?)(?<!\\)\$/g;
  while ((match = inlineMathRegex.exec(lineContent)) !== null) {
    const startCol = match.index + 1;
    const endCol = startCol + match[0].length;
    if (col >= startCol && col <= endCol) {
      return {
        type: 'inline',
        formula: match[1].trim(),
        startCol,
        endCol,
      };
    }
  }

  // 4. Check for \begin{equation} or \begin{align} environments
  if (
    lineContent.includes('\\begin{equation') ||
    lineContent.includes('\\begin{align') ||
    lineContent.includes('\\end{equation') ||
    lineContent.includes('\\end{align')
  ) {
    return {
      type: 'environment',
      formula: lineContent.trim(),
      startCol: 1,
      endCol: lineContent.length + 1,
    };
  }

  return null;
}
