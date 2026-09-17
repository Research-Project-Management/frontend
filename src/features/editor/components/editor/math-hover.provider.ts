import type * as Monaco from 'monaco-editor';

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

/**
 * Registers a Monaco Hover Provider that inspects LaTeX math regions
 * ($...$, $$...$$, \[...\], \begin{equation}...\end{equation}) and displays
 * formatted formula previews on hover without requiring full PDF compilation.
 */
export function registerMathHoverPreview(
  monaco: typeof Monaco,
  languages: string[] = ['latex', 'markdown'],
): Monaco.IDisposable {
  const disposables: Monaco.IDisposable[] = [];

  for (const lang of languages) {
    const disposable = monaco.languages.registerHoverProvider(lang, {
      provideHover(model, position) {
        const lineContent = model.getLineContent(position.lineNumber);
        const col = position.column;

        const mathMatch = detectMathAtPosition(lineContent, col);
        if (!mathMatch) return null;

        if (mathMatch.type === 'inline') {
          return {
            range: new monaco.Range(position.lineNumber, mathMatch.startCol, position.lineNumber, mathMatch.endCol),
            contents: [
              { value: '**LaTeX Formula Preview**' },
              { value: `$$\n${mathMatch.formula}\n$$` },
              { value: `*LaTeX:* \`$${mathMatch.formula}$\`` },
            ],
          };
        }

        if (mathMatch.type === 'display' || mathMatch.type === 'bracket') {
          return {
            range: new monaco.Range(position.lineNumber, mathMatch.startCol, position.lineNumber, mathMatch.endCol),
            contents: [
              { value: '**Display Equation Preview**' },
              { value: `$$\n${mathMatch.formula}\n$$` },
            ],
          };
        }

        if (mathMatch.type === 'environment') {
          return {
            range: new monaco.Range(position.lineNumber, 1, position.lineNumber, lineContent.length + 1),
            contents: [
              { value: '**LaTeX Math Environment**' },
              { value: `\`${mathMatch.formula}\`` },
            ],
          };
        }

        return null;
      },
    });

    disposables.push(disposable);
  }

  return {
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
