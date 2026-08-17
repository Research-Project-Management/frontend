/**
 * sidebar.util.ts — Sidebar utilities (Outline parser & AST section hierarchy)
 */

export interface OutlineEntry {
  level: number;
  title: string;
  line: number;
  type:
    | "part"
    | "chapter"
    | "section"
    | "subsection"
    | "subsubsection"
    | "paragraph"
    | "figure"
    | "table"
    | "algorithm";
}

interface PatternRule {
  regex: RegExp;
  level: number;
  type: OutlineEntry["type"];
}

const OUTLINE_RULES: PatternRule[] = [
  { regex: /^\\part\*?\{([^}]+)\}/, level: 0, type: "part" },
  { regex: /^\\chapter\*?\{([^}]+)\}/, level: 1, type: "chapter" },
  { regex: /^\\section\*?\{([^}]+)\}/, level: 2, type: "section" },
  { regex: /^\\subsection\*?\{([^}]+)\}/, level: 3, type: "subsection" },
  { regex: /^\\subsubsection\*?\{([^}]+)\}/, level: 4, type: "subsubsection" },
  { regex: /^\\paragraph\*?\{([^}]+)\}/, level: 5, type: "paragraph" },
];

/**
 * Parses LaTeX content into a structured list of outline entries.
 * Safe against empty strings, non-string payloads, and malformed LaTeX.
 */
export function parseLatexOutline(content: unknown): OutlineEntry[] {
  const str =
    typeof content === "string"
      ? content
      : content && typeof content === "object"
        ? ((content as any).source || (content as any).text || (content as any).content || "")
        : "";

  if (!str) return [];

  const entries: OutlineEntry[] = [];
  const lines = str.split("\n");

  let currentEnv: string | null = null;
  let currentCaption: string | null = null;
  let envStartLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimStart();
    const lineNum = i + 1;

    // Check headings
    let matchedHeading = false;
    for (const rule of OUTLINE_RULES) {
      const m = line.match(rule.regex);
      if (m) {
        entries.push({
          level: rule.level,
          title: m[1].trim(),
          line: lineNum,
          type: rule.type,
        });
        matchedHeading = true;
        break;
      }
    }

    if (matchedHeading) continue;

    // Environment tracking for Figures / Tables / Algorithms
    const beginMatch = line.match(/^\\begin\{(figure\*?|table\*?|algorithm\*?)\}/);
    if (beginMatch) {
      currentEnv = beginMatch[1].replace("*", "");
      envStartLine = lineNum;
      currentCaption = null;
      continue;
    }

    if (currentEnv) {
      const capMatch = line.match(/\\caption\{([^}]+)\}/);
      if (capMatch) {
        currentCaption = capMatch[1].trim();
      }

      const endMatch = line.match(/^\\end\{(figure\*?|table\*?|algorithm\*?)\}/);
      if (endMatch) {
        const title = currentCaption || `Untitled ${currentEnv.charAt(0).toUpperCase() + currentEnv.slice(1)}`;
        entries.push({
          level: 4,
          title: `${currentEnv === "figure" ? "🖼️ " : currentEnv === "table" ? "📊 " : "⚙️ "}${title}`,
          line: envStartLine,
          type: currentEnv as OutlineEntry["type"],
        });
        currentEnv = null;
        currentCaption = null;
      }
    }
  }

  return entries;
}
