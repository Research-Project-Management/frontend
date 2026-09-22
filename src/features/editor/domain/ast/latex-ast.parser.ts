/**
 * latex-ast.parser.ts
 *
 * Pure domain logic: Parses LaTeX document structure, sections, environments, packages, labels, and citations.
 * Dependency Rule: ZERO framework dependencies, ZERO DOM/React imports.
 */

export interface LatexSection {
  level: 'section' | 'subsection' | 'subsubsection';
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

export interface LineContext {
  section: string | null;
  environment: string | null;
}

export interface RichEditorContext {
  filename: string;
  totalLines: number;
  selectedText: string;
  hasSelection: boolean;
  startLine: number;
  endLine: number;
  selectedWordCount: number;
  contextBefore: string;
  contextAfter: string;
  currentSection: string | null;
  currentEnvironment: string | null;
  structure: LatexStructure;
  cursorLine: number;
  cursorCol: number;
  cursorContext: string;
}

/**
 * Parses raw LaTeX text into a structured AST representation.
 */
export function parseLatexStructure(content: unknown): LatexStructure {
  const str =
    typeof content === 'string'
      ? content
      : content && typeof content === 'object'
        ? ((content as Record<string, unknown>).source ||
            (content as Record<string, unknown>).text ||
            (content as Record<string, unknown>).content ||
            '')
        : '';

  const lines = (str as string).split('\n');
  const sections: LatexSection[] = [];
  const environments: LatexEnvironment[] = [];
  const packages: string[] = [];
  const labels: string[] = [];
  const citations: string[] = [];

  const envStack: { type: string; startLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ln = i + 1; // 1-based line indexing

    // Section parsing
    const secMatch = line.match(/\\((?:sub){0,2}section)\*?\{([^}]*)\}/);
    if (secMatch) {
      const raw = secMatch[1];
      const level =
        raw === 'section'
          ? 'section'
          : raw === 'subsection'
            ? 'subsection'
            : 'subsubsection';
      sections.push({ level, title: secMatch[2], startLine: ln });
    }

    // Packages parsing
    const pkgMatch = line.match(/\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (pkgMatch) {
      pkgMatch[1].split(',').forEach((p: string) => {
        const pkg = p.trim();
        if (pkg && !packages.includes(pkg)) packages.push(pkg);
      });
    }

    // Labels parsing
    const labelMatch = line.match(/\\label\{([^}]+)\}/);
    if (labelMatch && !labels.includes(labelMatch[1])) {
      labels.push(labelMatch[1]);
    }

    // Citations parsing
    const citeMatch = line.match(/\\cite(?:\[[^\]]*\])?\{([^}]+)\}/g);
    if (citeMatch) {
      citeMatch.forEach((m: string) => {
        const inner = m.match(/\{([^}]+)\}/)?.[1] ?? '';
        inner.split(',').forEach((c: string) => {
          const cite = c.trim();
          if (cite && !citations.includes(cite)) citations.push(cite);
        });
      });
    }

    // Environments parsing (stack-based matching)
    const beginMatch = line.match(/\\begin\{([^}]+)\}/);
    if (beginMatch) envStack.push({ type: beginMatch[1], startLine: ln });

    const endMatch = line.match(/\\end\{([^}]+)\}/);
    if (endMatch && envStack.length > 0) {
      const top = envStack[envStack.length - 1];
      if (top.type === endMatch[1]) {
        envStack.pop();
        if (top.type !== 'document') {
          environments.push({ type: top.type, startLine: top.startLine, endLine: ln });
        }
      }
    }
  }

  return {
    sections,
    environments,
    packages,
    labels,
    citations,
    totalLines: lines.length,
  };
}

/**
 * Finds which section and environment a given line number falls inside.
 */
export function getLineContext(lineNumber: number, structure: LatexStructure): LineContext {
  let section: string | null = null;
  for (const s of structure.sections) {
    if (s.startLine <= lineNumber) {
      section = `\\${s.level}{${s.title}}`;
    } else {
      break;
    }
  }

  let environment: string | null = null;
  for (const env of structure.environments) {
    if (env.startLine <= lineNumber && env.endLine >= lineNumber) {
      environment = env.type;
    }
  }

  return { section, environment };
}

/**
 * Formats rich editor context into a system-prompt-friendly string for AI agents.
 */
export function formatContextForPrompt(ctx: RichEditorContext): string {
  const parts: string[] = [];

  parts.push(`File: ${ctx.filename} (${ctx.totalLines} lines total)`);

  if (ctx.currentSection) parts.push(`Current section: ${ctx.currentSection}`);
  if (ctx.currentEnvironment) parts.push(`Inside environment: \\begin{${ctx.currentEnvironment}}`);

  if (ctx.structure.packages.length > 0) {
    parts.push(`Packages: ${ctx.structure.packages.slice(0, 10).join(', ')}`);
  }
  if (ctx.structure.labels.length > 0) {
    parts.push(`Defined labels: ${ctx.structure.labels.slice(0, 15).join(', ')}`);
  }

  if (ctx.hasSelection) {
    const range =
      ctx.startLine === ctx.endLine
        ? `line ${ctx.startLine}`
        : `lines ${ctx.startLine}–${ctx.endLine}`;
    parts.push(
      `\nSelected (${range}, ${ctx.selectedWordCount} words):\n\`\`\`latex\n${ctx.selectedText}\n\`\`\``,
    );
    if (ctx.contextBefore) parts.push(`\nContext before:\n\`\`\`latex\n${ctx.contextBefore}\n\`\`\``);
    if (ctx.contextAfter) parts.push(`\nContext after:\n\`\`\`latex\n${ctx.contextAfter}\n\`\`\``);
  } else {
    parts.push(`Cursor at line ${ctx.cursorLine}, col ${ctx.cursorCol}`);
    parts.push(`\nSurrounding context:\n\`\`\`latex\n${ctx.cursorContext}\n\`\`\``);
  }

  return parts.join('\n');
}
