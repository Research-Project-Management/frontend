import { describe, it, expect } from "vitest";
import {
  extractCodeBlocks,
  resolveSlashCommandPrompt,
  SLASH_COMMANDS,
} from "@/features/editor/utils/ai.util";

describe("editor-ai.engine", () => {
  it("should list available slash commands", () => {
    expect(SLASH_COMMANDS.length).toBeGreaterThanOrEqual(8);
    expect(SLASH_COMMANDS.some((c) => c.cmd === "/fix")).toBe(true);
  });

  it("should extract fenced code blocks from markdown", () => {
    const md = `Here is the fix:
\`\`\`latex
\\section{Test}
\\textbf{Bold}
\`\`\`
And another block:
\`\`\`bib
@article{key, title={Paper}}
\`\`\``;

    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.language).toBe("latex");
    expect(blocks[0]!.code).toContain("\\section{Test}");
    expect(blocks[1]!.language).toBe("bib");
  });

  it("should resolve slash command prompts with context", () => {
    const prompt = resolveSlashCommandPrompt("/explain", "/explain how does this macro work?", "\\newcommand{\\foo}{bar}");
    expect(prompt).toContain("Please provide a clear explanation");
    expect(prompt).toContain("\\newcommand{\\foo}{bar}");
    expect(prompt).toContain("how does this macro work?");
  });
});
