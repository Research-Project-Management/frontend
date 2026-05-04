/**
 * latex-utils.ts — Editor-AI integration utilities
 *
 * parseLatexStructure: extract document map from LaTeX source
 * parseCompileErrors: structured error extraction from pdflatex log
 * buildEditorContext: rich context object for AI system prompts
 */

// ── Document Structure ────────────────────────────────────────────────────────

export interface LatexSection {
  level: "section" | "subsection" | "subsubsection";
  title: string;
  startLine: number;
}

export interface LatexEnvironment {
  type: string;
  startLine: number;
  endLine: number;
}

export interface LatexStructure {
  sections: LatexSection[];
  environments: LatexEnvironment[];
  packages: string[];
  labels: string[];
  citations: string[];
  totalLines: number;
}

export function parseLatexStructure(content: string): LatexStructure {
  const lines = content.split("\n");
  const sections: LatexSection[] = [];
  const environments: LatexEnvironment[] = [];
  const packages: string[] = [];
  const labels: string[] = [];
  const citations: string[] = [];

  const envStack: { type: string; startLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ln = i + 1; // 1-based

    // Sections
    const secMatch = line.match(/\\((?:sub){0,2}section)\*?\{([^}]*)\}/);
    if (secMatch) {
      const raw = secMatch[1] as string;
      const level =
        raw === "section"
          ? "section"
          : raw === "subsection"
            ? "subsection"
            : "subsubsection";
      sections.push({ level, title: secMatch[2], startLine: ln });
    }

    // Packages
    const pkgMatch = line.match(/\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (pkgMatch) {
      pkgMatch[1].split(",").forEach((p) => {
        const pkg = p.trim();
        if (pkg && !packages.includes(pkg)) packages.push(pkg);
      });
    }

    // Labels
    const labelMatch = line.match(/\\label\{([^}]+)\}/);
    if (labelMatch && !labels.includes(labelMatch[1])) {
      labels.push(labelMatch[1]);
    }

    // Citations
    const citeMatch = line.match(/\\cite(?:\[[^\]]*\])?\{([^}]+)\}/g);
    if (citeMatch) {
      citeMatch.forEach((m) => {
        const inner = m.match(/\{([^}]+)\}/)?.[1] ?? "";
        inner.split(",").forEach((c) => {
          const cite = c.trim();
          if (cite && !citations.includes(cite)) citations.push(cite);
        });
      });
    }

    // Environments
    const beginMatch = line.match(/\\begin\{([^}]+)\}/);
    if (beginMatch) envStack.push({ type: beginMatch[1], startLine: ln });

    const endMatch = line.match(/\\end\{([^}]+)\}/);
    if (endMatch && envStack.length > 0) {
      const top = envStack[envStack.length - 1];
      if (top.type === endMatch[1]) {
        envStack.pop();
        if (top.type !== "document") {
          environments.push({ type: top.type, startLine: top.startLine, endLine: ln });
        }
      }
    }
  }

  return { sections, environments, packages, labels, citations, totalLines: lines.length };
}

/** Find what section and environment a line falls inside */
export function getLineContext(
  lineNumber: number,
  structure: LatexStructure,
): { section: string | null; environment: string | null } {
  // Find deepest section before this line
  let section: string | null = null;
  for (const s of structure.sections) {
    if (s.startLine <= lineNumber) section = `\\${s.level}{${s.title}}`;
    else break;
  }

  // Find innermost environment containing this line
  let environment: string | null = null;
  for (const env of structure.environments) {
    if (env.startLine <= lineNumber && env.endLine >= lineNumber) {
      environment = env.type;
    }
  }

  return { section, environment };
}

// ── Compile Error Parser ───────────────────────────────────────────────────────

export interface ParsedCompileError {
  line: number | null;
  message: string;
  context: string;
}

/** Parse pdflatex/xelatex log to extract error entries */
export function parseCompileErrors(log: string): ParsedCompileError[] {
  const errors: ParsedCompileError[] = [];
  const lines = log.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // LaTeX error: ! Error message
    if (line.startsWith("!")) {
      const message = line.slice(1).trim();
      // Look ahead for line number
      let errorLine: number | null = null;
      let context = "";
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const m = lines[j].match(/^l\.(\d+)/);
        if (m) {
          errorLine = parseInt(m[1], 10);
          context = lines.slice(i, j + 2).join("\n");
          break;
        }
      }
      if (!context) context = lines.slice(i, i + 4).join("\n");

      // Deduplicate
      if (!errors.find((e) => e.message === message && e.line === errorLine)) {
        errors.push({ line: errorLine, message, context });
      }
    }

    // Warning: Undefined reference
    const warnMatch = line.match(/LaTeX Warning:.*?on input line (\d+)/);
    if (warnMatch) {
      const warnLine = parseInt(warnMatch[1], 10);
      const message = line.replace(/^LaTeX Warning:\s*/, "").trim();
      if (!errors.find((e) => e.message === message)) {
        errors.push({ line: warnLine, message, context: line });
      }
    }
  }

  return errors.slice(0, 20); // cap at 20
}

// ── Rich Editor Context ────────────────────────────────────────────────────────

export interface RichEditorContext {
  // Full file
  fileContent: string;
  filename: string;
  totalLines: number;

  // Selection
  hasSelection: boolean;
  selectedText: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  selectedLineCount: number;
  selectedCharCount: number;
  selectedWordCount: number;

  // Surrounding context (±15 lines)
  contextBefore: string;
  contextAfter: string;

  // Where in document
  currentSection: string | null;
  currentEnvironment: string | null;

  // Document map
  structure: LatexStructure;

  // Cursor (when no selection)
  cursorLine: number;
  cursorCol: number;
  cursorContext: string; // ±10 lines around cursor
}

export function buildRichContext(
  editor: import("monaco-editor").editor.IStandaloneCodeEditor,
  filename: string,
): RichEditorContext {
  const model = editor.getModel();
  const fullContent = model?.getValue() ?? "";
  const totalLines = model?.getLineCount() ?? 0;
  const position = editor.getPosition();
  const selectionRange = editor.getSelection();

  const cursorLine = position?.lineNumber ?? 1;
  const cursorCol = position?.column ?? 1;

  // Cursor context ±10
  const ctxStart = Math.max(1, cursorLine - 10);
  const ctxEnd = Math.min(totalLines, cursorLine + 10);
  const cursorContext = Array.from(
    { length: ctxEnd - ctxStart + 1 },
    (_, i) => model?.getLineContent(ctxStart + i) ?? "",
  ).join("\n");

  // Selection
  const hasSelection =
    !!selectionRange &&
    (selectionRange.startLineNumber !== selectionRange.endLineNumber ||
      selectionRange.startColumn !== selectionRange.endColumn);

  const selectedText = hasSelection && selectionRange && model
    ? model.getValueInRange(selectionRange)
    : "";

  const startLine = selectionRange?.startLineNumber ?? cursorLine;
  const endLine = selectionRange?.endLineNumber ?? cursorLine;
  const startCol = selectionRange?.startColumn ?? cursorCol;
  const endCol = selectionRange?.endColumn ?? cursorCol;

  const selectedLineCount = endLine - startLine + 1;
  const selectedCharCount = selectedText.length;
  const selectedWordCount = selectedText
    ? selectedText.split(/\s+/).filter(Boolean).length
    : 0;

  // Surrounding context ±15 lines around selection
  const surStart = Math.max(1, startLine - 15);
  const surEnd = Math.min(totalLines, endLine + 15);

  const contextBefore = Array.from(
    { length: Math.max(0, startLine - surStart) },
    (_, i) => model?.getLineContent(surStart + i) ?? "",
  ).join("\n");

  const contextAfter = Array.from(
    { length: Math.max(0, surEnd - endLine) },
    (_, i) => model?.getLineContent(endLine + 1 + i) ?? "",
  ).join("\n");

  // Document structure
  const structure = parseLatexStructure(fullContent);
  const { section, environment } = getLineContext(startLine, structure);

  return {
    fileContent: fullContent,
    filename,
    totalLines,
    hasSelection,
    selectedText,
    startLine,
    endLine,
    startCol,
    endCol,
    selectedLineCount,
    selectedCharCount,
    selectedWordCount,
    contextBefore,
    contextAfter,
    currentSection: section,
    currentEnvironment: environment,
    structure,
    cursorLine,
    cursorCol,
    cursorContext,
  };
}

/** Format rich context into a system-prompt-friendly string */
export function formatContextForPrompt(ctx: RichEditorContext): string {
  const parts: string[] = [];

  parts.push(`File: ${ctx.filename} (${ctx.totalLines} lines total)`);

  if (ctx.currentSection) parts.push(`Current section: ${ctx.currentSection}`);
  if (ctx.currentEnvironment) parts.push(`Inside environment: \\begin{${ctx.currentEnvironment}}`);

  if (ctx.structure.packages.length > 0) {
    parts.push(`Packages: ${ctx.structure.packages.slice(0, 10).join(", ")}`);
  }
  if (ctx.structure.labels.length > 0) {
    parts.push(`Defined labels: ${ctx.structure.labels.slice(0, 15).join(", ")}`);
  }

  if (ctx.hasSelection) {
    const range =
      ctx.startLine === ctx.endLine
        ? `line ${ctx.startLine}`
        : `lines ${ctx.startLine}–${ctx.endLine}`;
    parts.push(`\nSelected (${range}, ${ctx.selectedWordCount} words):\n\`\`\`latex\n${ctx.selectedText}\n\`\`\``);
    if (ctx.contextBefore) parts.push(`\nContext before:\n\`\`\`latex\n${ctx.contextBefore}\n\`\`\``);
    if (ctx.contextAfter) parts.push(`\nContext after:\n\`\`\`latex\n${ctx.contextAfter}\n\`\`\``);
  } else {
    parts.push(`Cursor at line ${ctx.cursorLine}, col ${ctx.cursorCol}`);
    parts.push(`\nSurrounding context:\n\`\`\`latex\n${ctx.cursorContext}\n\`\`\``);
  }

  return parts.join("\n");
}
