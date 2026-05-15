import React, { useEffect, useState } from "react";
import { ChevronRight, Hash } from "lucide-react";
import { pdfjs } from "react-pdf";
import { cn } from "~/lib/utils";
import { usePageContext } from "../../PageContext";
import { SidebarEmptyState, SidebarHeader, SidebarPanel } from "../SidebarChrome";

interface OutlineEntry {
  level: number; // 0=section,1=subsection,2=subsubsection,3=paragraph
  title: string;
  line: number;
}

const SECTION_PATTERNS: { regex: RegExp; level: number }[] = [
  { regex: /^\\section\*?\{(.+?)\}/, level: 0 },
  { regex: /^\\subsection\*?\{(.+?)\}/, level: 1 },
  { regex: /^\\subsubsection\*?\{(.+?)\}/, level: 2 },
  { regex: /^\\paragraph\*?\{(.+?)\}/, level: 3 },
];

function parseOutline(content: string): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  const lines = content.split("\n");
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimStart();
    for (const { regex, level } of SECTION_PATTERNS) {
      const m = line.match(regex);
      if (m) {
        entries.push({ level, title: m[1].trim(), line: idx + 1 });
        break;
      }
    }
  });
  return entries;
}

const LEVEL_INDENT = [0, 12, 24, 32];
const LEVEL_COLORS = [
  "text-foreground font-medium",
  "text-foreground/80",
  "text-muted-foreground",
  "text-muted-foreground/70 italic",
];

// ── PDF page lookup ────────────────────────────────────────────────────────

function flattenPdfOutline(items: any[]): any[] {
  const result: any[] = [];
  for (const item of items) {
    result.push(item);
    if (item.items?.length) result.push(...flattenPdfOutline(item.items));
  }
  return result;
}

async function findPdfPageForTitle(
  doc: any,
  title: string,
): Promise<number | null> {
  const needle = title.toLowerCase().trim();

  // Strategy 1: PDF bookmarks (works when \usepackage{hyperref} is loaded)
  try {
    const outline = await doc.getOutline();
    if (outline?.length) {
      for (const item of flattenPdfOutline(outline)) {
        if (item.title && item.title.toLowerCase().includes(needle)) {
          const dest = Array.isArray(item.dest)
            ? item.dest
            : await doc.getDestination(item.dest);
          if (dest) {
            const pageIndex = await doc.getPageIndex(dest[0]);
            return pageIndex + 1;
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  // Strategy 2: Text search across pages
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = (content.items as any[]).map((it) => it.str).join(" ");
      if (text.toLowerCase().includes(needle)) return i;
    } catch {
      /* ignore */
    }
  }

  return null;
}

export default function OutlineTab({ onClose }: { onClose?: () => void }) {
  const { editorRef, getEditorContent, pdfDocRef, gotoPageRef } =
    usePageContext();
  const [outline, setOutline] = useState<OutlineEntry[]>([]);

  useEffect(() => {
    // Initial parse
    const initial = getEditorContent.current?.() ?? "";
    setOutline(parseOutline(initial));

    // Subscribe to Monaco model changes
    const editor = editorRef.current;
    if (!editor) return;
    const disposable = editor.onDidChangeModelContent(() => {
      setOutline(parseOutline(editor.getValue()));
    });
    return () => disposable.dispose();
  }, [editorRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = async (line: number, title: string) => {
    // Scroll editor to the section line
    const editor = editorRef.current;
    if (editor) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    }

    // Scroll PDF to the matching page
    const doc = pdfDocRef.current;
    const scrollFn = gotoPageRef.current;
    if (!doc || !scrollFn) return;

    const page = await findPdfPageForTitle(doc, title);
    if (page !== null) scrollFn(page);
  };

  return (
    <SidebarPanel>
      <SidebarHeader title="Outline" icon={Hash} onClose={onClose} />

      {/* Entries */}
      <div className="flex-1 overflow-y-auto py-1">
        {outline.length === 0 ? (
          <SidebarEmptyState icon={Hash} title="No sections found">
            <p>
              No sections found.
              <br />
              Use{" "}
              <code className="bg-muted px-1 rounded text-[11px]">
                \section
              </code>{" "}
              to add structure.
            </p>
          </SidebarEmptyState>
        ) : (
          outline.map((entry, i) => (
            <button
              key={i}
              onClick={() => handleClick(entry.line, entry.title)}
              style={{ paddingLeft: `${8 + LEVEL_INDENT[entry.level]}px` }}
              className={cn(
                "w-full flex items-center gap-1.5 py-1 pr-2 text-xs transition-colors hover:bg-primary/5 text-left",
                LEVEL_COLORS[entry.level],
              )}
            >
              <ChevronRight
                className={cn(
                  "shrink-0",
                  entry.level === 0 ? "size-3.5" : "size-3 opacity-50",
                )}
              />
              <span className="truncate">{entry.title}</span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/50">
                :{entry.line}
              </span>
            </button>
          ))
        )}
      </div>
    </SidebarPanel>
  );
}
