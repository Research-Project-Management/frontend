'use client';
import React, { useEffect, useState } from "react";
import { ChevronRight, Hash } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { usePageStore } from "@/features/editor/store/page.store";
import {
  parseLatexOutline,
  type OutlineEntry,
} from "@/features/editor/utils/sidebar.util";

const LEVEL_INDENT = [0, 12, 24, 32];
const LEVEL_COLORS = [
  "text-foreground font-medium",
  "text-foreground/90 font-normal",
  "text-muted-foreground",
  "text-muted-foreground/80",
];

export default function OutlineTab() {
  const { editorRef, getEditorContent, scrollToLineRef, scrollToPdfLineRef } =
    usePageStore();
  const [outline, setOutline] = useState<OutlineEntry[]>([]);

  useEffect(() => {
    let disposed = false;

    const setupListener = () => {
      const editor = editorRef?.current;
      if (!editor) return false;

      const initial = getEditorContent?.current?.() ?? editor.getValue();
      setOutline(parseLatexOutline(initial));

      const disposable = editor.onDidChangeModelContent(() => {
        if (!disposed) {
          setOutline(parseLatexOutline(editor.getValue()));
        }
      });

      return () => disposable.dispose();
    };

    if (editorRef?.current) {
      const cleanup = setupListener();
      return () => {
        disposed = true;
        if (typeof cleanup === "function") cleanup();
      };
    }

    const interval = setInterval(() => {
      if (editorRef?.current) {
        clearInterval(interval);
        if (!disposed) {
          setupListener();
        }
      }
    }, 200);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [editorRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = (entry: OutlineEntry) => {
    scrollToLineRef?.current?.(entry.line);
    scrollToPdfLineRef?.current?.(entry.line);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Hash className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-semibold text-muted-foreground">
            Outline
          </span>
          {outline.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {outline.length}
            </span>
          )}
        </div>
      </div>

      {outline.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-5 py-10 text-center text-muted-foreground">
          <Hash className="size-8 opacity-25" />
          <p className="text-xs font-medium text-foreground/70">No sections found.</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Use \section&#123;&#125;, \subsection&#123;&#125;, etc. to structure your document.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1 px-1 select-none">
          {outline.map((entry, idx) => (
            <button
              key={`${entry.line}-${idx}`}
              onClick={() => handleClick(entry)}
              style={{ paddingLeft: `${8 + (LEVEL_INDENT[entry.level] ?? 0)}px` }}
              className={cn(
                "w-full flex items-center gap-1.5 py-1 px-2 rounded-sm text-xs text-left",
                "hover:bg-accent/60 hover:text-foreground transition-colors group cursor-pointer",
                LEVEL_COLORS[entry.level] ?? "text-muted-foreground",
              )}
            >
              <ChevronRight className="size-3 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
              <span className="truncate flex-1">{entry.title}</span>
              <span className="text-[10px] text-muted-foreground/50 font-mono shrink-0 ml-1">
                L{entry.line}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
