import { describe, it, expect } from "vitest";
import { parseLatexOutline } from "@/features/editor/utils/sidebar.util";

describe("parseLatexOutline", () => {
  it("should return empty array for empty or non-string input", () => {
    expect(parseLatexOutline("")).toEqual([]);
    expect(parseLatexOutline(null)).toEqual([]);
    expect(parseLatexOutline(undefined)).toEqual([]);
  });

  it("should extract sections, subsections, and subsubsections with correct 1-based line numbers", () => {
    const doc = [
      "\\documentclass{article}",
      "\\section{Introduction}",
      "Some text",
      "\\subsection{Background}",
      "More text",
      "\\subsubsection{Specific Detail}",
    ].join("\n");

    const outline = parseLatexOutline(doc);
    expect(outline).toHaveLength(3);
    expect(outline[0]).toEqual({
      level: 2,
      title: "Introduction",
      line: 2,
      type: "section",
    });
    expect(outline[1]).toEqual({
      level: 3,
      title: "Background",
      line: 4,
      type: "subsection",
    });
    expect(outline[2]).toEqual({
      level: 4,
      title: "Specific Detail",
      line: 6,
      type: "subsubsection",
    });
  });

  it("should extract figures and tables with captions", () => {
    const doc = [
      "\\section{Methods}",
      "\\begin{figure}",
      "  \\centering",
      "  \\caption{Model Architecture}",
      "\\end{figure}",
      "\\begin{table}",
      "  \\caption{Accuracy Benchmark}",
      "\\end{table}",
    ].join("\n");

    const outline = parseLatexOutline(doc);
    expect(outline).toHaveLength(3);
    expect(outline[0].title).toBe("Methods");
    expect(outline[1].title).toBe("🖼️ Model Architecture");
    expect(outline[1].line).toBe(2);
    expect(outline[2].title).toBe("📊 Accuracy Benchmark");
    expect(outline[2].line).toBe(6);
  });
});
