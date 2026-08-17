'use client';

import React, { useRef, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import MonacoEditor, { loader } from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { registerLaTeXLanguage } from "monaco-latex";
import type { editor } from "monaco-editor";
import {
  Bold,
  BookOpen,
  Braces,
  ChevronRight,
  Clipboard,
  Code,
  Copy,
  Hash,
  Italic,
  List,
  MessageSquarePlus,
  Pencil,
  Scissors,
  X,
  Search,
  Sigma,
  Sparkles,
  Strikethrough,
  Subscript,
  Superscript,
  Tag,
  Underline,
  Zap,
  Check,
  Plus,
  Circle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { usePageActions } from '@/features/editor/hooks/use-page';
import { usePageComments } from '@/features/editor/services/comment.service';
import type { Page, PageComment } from "@/features/editor/types/document.types";
import { useActionsStore } from '@/features/editor/store/actions.store';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { usePageStore } from "@/features/editor/store/page.store";
import { useSettingsStore } from "@/features/editor/store/settings.store";
import { useCompileStore } from "@/features/editor/store/compile.store";
import { cn } from "@/shared/lib/utils";
import { EditorEventBus } from "@/features/editor/utils/editor.util";
const FluxIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
);
import Format from "./Format";

// Register LaTeX language and custom theme before Monaco loads
if (typeof window !== 'undefined') {
loader.init().then((monaco) => {
  registerLaTeXLanguage(monaco);

  // Calm light theme tuned for long LaTeX/code editing sessions.
  monaco.editor.defineTheme("latex-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7c8698", fontStyle: "italic" },
      { token: "keyword", foreground: "255fdc", fontStyle: "bold" },
      { token: "string", foreground: "1a7f4b" },
      { token: "number", foreground: "9a5b00" },
      { token: "delimiter", foreground: "4b5563" },
      { token: "operator", foreground: "b4235b" },
      { token: "type", foreground: "7c3aed" },
      { token: "tag", foreground: "255fdc" },
      { token: "attribute.name", foreground: "b45309" },
    ],
    colors: {
      "editor.background": "#fffefe",
      "editor.foreground": "#1f2328",
      "editor.lineHighlightBackground": "#eef4ff80",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#9aa4b2",
      "editorLineNumber.activeForeground": "#255fdc",
      "editorGutter.background": "#f8fafc",
      "editorGutter.modifiedBackground": "#f59e0b",
      "editorGutter.addedBackground": "#16a34a",
      "editorGutter.deletedBackground": "#dc2626",
      "editor.selectionBackground": "#255fdc2e",
      "editor.inactiveSelectionBackground": "#255fdc18",
      "editor.selectionHighlightBackground": "#facc1530",
      "editor.wordHighlightBackground": "#facc1526",
      "editor.wordHighlightStrongBackground": "#f59e0b30",
      "editor.findMatchBackground": "#facc1555",
      "editor.findMatchHighlightBackground": "#fde68a66",
      "editorCursor.foreground": "#255fdc",
      "editorWhitespace.foreground": "#d7dce3",
      "editorIndentGuide.background1": "#e6eaf0",
      "editorIndentGuide.activeBackground1": "#94a3b8",
      "editorBracketMatch.background": "#255fdc16",
      "editorBracketMatch.border": "#255fdc80",
      "editorOverviewRuler.border": "#00000000",
      "scrollbarSlider.background": "#94a3b833",
      "scrollbarSlider.hoverBackground": "#94a3b855",
      "scrollbarSlider.activeBackground": "#64748b66",
    },
  });

  // Soft dark theme with enough contrast without the harsh pure-black feel.
  monaco.editor.defineTheme("latex-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7a8699", fontStyle: "italic" },
      { token: "keyword", foreground: "7aa2ff", fontStyle: "bold" },
      { token: "string", foreground: "7dd3a7" },
      { token: "number", foreground: "f6c177" },
      { token: "delimiter", foreground: "cbd5e1" },
      { token: "operator", foreground: "f0abfc" },
      { token: "type", foreground: "c4b5fd" },
      { token: "tag", foreground: "93c5fd" },
      { token: "attribute.name", foreground: "fbbf24" },
    ],
    colors: {
      "editor.background": "#111827",
      "editor.foreground": "#dbeafe",
      "editor.lineHighlightBackground": "#1e293b",
      "editor.lineHighlightBorder": "#00000000",
      "editorLineNumber.foreground": "#64748b",
      "editorLineNumber.activeForeground": "#93c5fd",
      "editorGutter.background": "#0f172a",
      "editor.selectionBackground": "#3b82f64a",
      "editor.inactiveSelectionBackground": "#3b82f626",
      "editor.selectionHighlightBackground": "#fbbf2430",
      "editor.wordHighlightBackground": "#fbbf2426",
      "editor.wordHighlightStrongBackground": "#f59e0b30",
      "editor.findMatchBackground": "#fbbf2455",
      "editor.findMatchHighlightBackground": "#fde68a33",
      "editorCursor.foreground": "#93c5fd",
      "editorWhitespace.foreground": "#334155",
      "editorIndentGuide.background1": "#263449",
      "editorIndentGuide.activeBackground1": "#64748b",
      "editorBracketMatch.background": "#3b82f61f",
      "editorBracketMatch.border": "#93c5fd80",
      "editorOverviewRuler.border": "#00000000",
      "scrollbarSlider.background": "#64748b33",
      "scrollbarSlider.hoverBackground": "#64748b55",
      "scrollbarSlider.activeBackground": "#94a3b866",
    },
  });
  });
} // end typeof window !== 'undefined'

interface EditorProps {
  page: Page;
}

type CtxPos = { x: number; y: number };
type SelFloating = {
  x: number;
  y: number;
  startLine: number;
  endLine: number;
  text: string;
};

interface MenuAction {
  icon?: React.ElementType;
  label: string;
  kbd?: string;
  action: () => void;
  disabled?: boolean;
}

const extractStringContent = (c: any): string =>
  typeof c === 'string' ? c : c && typeof c === 'object' ? (c.source || c.text || c.content || '') : '';

export default function Editor({ page }: EditorProps) {
  const { editorRef, compileRef, scrollToLineRef, scrollToPdfLineRef, isAiPreviewingRef } =
    usePageStore();
  const { markDirty } = useCompileStore();
  const { editorTheme, autoCompile, fontSize, wordWrap, lineNumbers } = useSettingsStore();
  const [content, setContent] = useState(extractStringContent(page.content));
  const [editorMounted, setEditorMounted] = useState(false);
  const activePageIdRef = useRef(page._id);
  const debouncedContent = useDebounce(content, 1000);
  const pendingCompileRef = useRef(false);
  const { updateContent: updateMutation } = usePageActions();
  const { pageId: pageIdParam } = useParams<{ pageId: string }>();
  const { setPendingComment, setPendingAiText, setPendingAiContext } = useActionsStore();
  const { data: comments = [] } = usePageComments(pageIdParam ?? null);
  const [ctxMenu, setCtxMenu] = useState<CtxPos | null>(null);
  const [ctxPos, setCtxPos] = useState<CtxPos | null>(null);
  const [ctxStartLine, setCtxStartLine] = useState<number | null>(null);
  const [ctxEndLine, setCtxEndLine] = useState<number | null>(null);
  const [ctxSelText, setCtxSelText] = useState("");
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const decorationCollRef = useRef<any>(null);
  const lineCommentsRef = useRef<Map<number, PageComment[]>>(new Map());
  const [glyphTooltip, setGlyphTooltip] = useState<{
    x: number;
    bottom: number;
    comments: PageComment[];
  } | null>(null);
  const [selFloating, setSelFloating] = useState<SelFloating | null>(null);
  const selFloatingRef = useRef<HTMLDivElement>(null);
  const [renameDialog, setRenameDialog] = useState<{
    word: string;
    newName: string;
  } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const domCleanupRef = useRef<(() => void) | null>(null);

  // Unmount cleanup for Monaco DOM listeners and disposables
  useEffect(() => {
    return () => {
      domCleanupRef.current?.();
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  // Auto-save when content changes (debounced)
  useEffect(() => {
    if (activePageIdRef.current !== page._id) return;
    if (debouncedContent && debouncedContent !== page.content) {
      markDirty(page._id, debouncedContent);
      updateMutation.mutate({ pageId: page._id, content: debouncedContent });
      if (autoCompile) pendingCompileRef.current = true;
    }
  }, [debouncedContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compile: trigger compile after save mutation succeeds.
  useEffect(() => {
    const { compileStatus } = useCompileStore.getState();
    if (!autoCompile || compileStatus !== "idle") return;
    if (updateMutation.isSuccess && !updateMutation.isPending && pendingCompileRef.current) {
      pendingCompileRef.current = false;
      const timer = setTimeout(() => {
        compileRef.current?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [updateMutation.isSuccess, updateMutation.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activePageIdRef.current = page._id;
    pendingCompileRef.current = false;
    setContent(extractStringContent(page.content));
  }, [page._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close context menu when clicking outside
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (!ctxMenuRef.current?.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxMenu]);

  useLayoutEffect(() => {
    if (!ctxMenu || !ctxMenuRef.current) return;
    if (ctxPos) return;
    const el = ctxMenuRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rawX = ctxMenu.x;
    const rawY = ctxMenu.y;
    const x = Math.max(4, rawX + w + 4 > vw ? rawX - w - 4 : rawX);
    const y = Math.max(4, rawY + h + 4 > vh ? rawY - h - 8 : rawY);
    setCtxPos({ x, y });
  }, [ctxMenu, ctxPos]);

  useEffect(() => {
    if (!selFloating) return;
    const handler = (e: MouseEvent) => {
      if (!selFloatingRef.current?.contains(e.target as Node))
        setSelFloating(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selFloating]);

  useEffect(() => {
    if (renameDialog) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 30);
    }
  }, [renameDialog]);

  useEffect(() => {
    editorRef.current?.updateOptions({
      wordWrap: wordWrap ? "on" : "off",
      lineNumbers: lineNumbers ? "on" : "off",
      fontSize,
      lineHeight: Math.round(fontSize * 1.65),
    });
  }, [wordWrap, lineNumbers, fontSize, editorRef]);

  useEffect(() => {
    const coll = decorationCollRef.current;
    if (!coll) return;

    const lineComments = new Map<number, PageComment[]>();
    comments.forEach((c) => {
      if (c.line == null) return;
      const from = c.line;
      const to = (c as any).lineEnd ?? c.line;
      for (let l = from; l <= to; l++) {
        if (!lineComments.has(l)) lineComments.set(l, []);
        lineComments.get(l)!.push(c);
      }
    });

    lineCommentsRef.current = lineComments;

    coll.set(
      Array.from(lineComments.entries()).map(([line]) => ({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          glyphMarginClassName: "flux-comment-glyph",
        },
      })),
    );
  }, [comments, editorMounted]);

  const closeMenu = () => setCtxMenu(null);

  const trigger = (action: string) => {
    editorRef.current?.trigger("ctx-menu", action, null);
    editorRef.current?.focus();
    closeMenu();
  };

  const wrapSel = (before: string, after: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    const text = ed.getModel()?.getValueInRange(sel) ?? "";
    ed.executeEdits("ctx-menu", [
      { range: sel, text: `${before}${text}${after}`, forceMoveMarkers: true },
    ]);
    ed.focus();
    closeMenu();
  };

  const insertAt = (text: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    ed.executeEdits("ctx-menu", [{ range: sel, text, forceMoveMarkers: true }]);
    ed.focus();
    closeMenu();
  };

  const openRenameDialog = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const pos = ed.getPosition();
    const word = pos ? ed.getModel()?.getWordAtPosition(pos) : null;
    if (!word) return;
    closeMenu();
    setRenameDialog({ word: word.word, newName: word.word });
  };

  const applyRename = (word: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === word) {
      setRenameDialog(null);
      return;
    }
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;
    const wordSep = "`~!@#$%^&*()-=+[{]}\\|;:'\",./<>?";
    const matches = model.findMatches(word, false, false, true, wordSep, false);
    if (matches.length > 0) {
      ed.executeEdits(
        "rename",
        matches.map((m) => ({ range: m.range, text: trimmed })),
      );
    }
    setRenameDialog(null);
    ed.focus();
  };

  const menuGroups: MenuAction[][] = [
    [
      {
        icon: Scissors,
        label: "Cut",
        kbd: "Ctrl+X",
        action: () => trigger("editor.action.clipboardCutAction"),
      },
      {
        icon: Copy,
        label: "Copy",
        kbd: "Ctrl+C",
        action: () => trigger("editor.action.clipboardCopyAction"),
      },
      {
        icon: Clipboard,
        label: "Paste",
        kbd: "Ctrl+V",
        action: () => trigger("editor.action.clipboardPasteAction"),
      },
    ],
    [
      { label: "Undo", kbd: "Ctrl+Z", action: () => trigger("undo") },
      { label: "Redo", kbd: "Ctrl+Y", action: () => trigger("redo") },
    ],
    [
      { icon: Bold, label: "Bold", action: () => wrapSel("\\textbf{", "}") },
      {
        icon: Italic,
        label: "Italic",
        action: () => wrapSel("\\textit{", "}"),
      },
      {
        icon: Underline,
        label: "Underline",
        action: () => wrapSel("\\underline{", "}"),
      },
      {
        icon: Code,
        label: "Typewriter",
        action: () => wrapSel("\\texttt{", "}"),
      },
      {
        icon: Strikethrough,
        label: "Strikethrough",
        action: () => wrapSel("\\sout{", "}"),
      },
      {
        icon: Superscript,
        label: "Superscript",
        action: () => wrapSel("^{", "}"),
      },
      { icon: Subscript, label: "Subscript", action: () => wrapSel("_{", "}") },
    ],
    [
      {
        icon: Sigma,
        label: "Inline Math",
        kbd: "$…$",
        action: () => wrapSel("$", "$"),
      },
      {
        icon: Braces,
        label: "Display Math",
        action: () => wrapSel("\\[\n  ", "\n\\]"),
      },
      {
        label: "Equation env",
        action: () => wrapSel("\\begin{equation}\n  ", "\n\\end{equation}"),
      },
      {
        label: "Align env",
        action: () => wrapSel("\\begin{align}\n  ", "\n\\end{align}"),
      },
    ],
    [
      { icon: Hash, label: "Section", action: () => insertAt("\\section{}") },
      {
        icon: ChevronRight,
        label: "Subsection",
        action: () => insertAt("\\subsection{}"),
      },
      { icon: List, label: "List item", action: () => insertAt("\\item ") },
      { icon: Tag, label: "Label", action: () => insertAt("\\label{}") },
      { icon: BookOpen, label: "Citation", action: () => insertAt("\\cite{}") },
    ],
    [
      {
        icon: Search,
        label: "Find / Replace",
        kbd: "Ctrl+F",
        action: () => trigger("actions.find"),
      },
      {
        icon: Pencil,
        label: "Rename Occurrences",
        kbd: "F2",
        action: openRenameDialog,
      },
      {
        icon: Zap,
        label: "Compile",
        kbd: "Ctrl+↵",
        action: () => {
          compileRef.current?.();
          closeMenu();
        },
      },
    ],
    [
      {
        icon: MessageSquarePlus,
        label: "Add Comment",
        action: () => {
          setPendingComment({
            startLine: ctxStartLine ?? 1,
            endLine: ctxEndLine ?? ctxStartLine ?? 1,
            selectedText: ctxSelText,
          });
          EditorEventBus.emit("flux:open-panel", "Review");
          closeMenu();
        },
      },
      {
        icon: FluxIcon,
        label: "Ask AI about this",
        action: () => {
          if (ctxSelText) {
            setPendingAiContext({
              selectedText: ctxSelText,
              startLine: ctxStartLine ?? 1,
              endLine: ctxEndLine ?? ctxStartLine ?? 1,
            });
          }
          EditorEventBus.emit("flux:open-ai-panel");
          closeMenu();
        },
      },
    ],
  ];

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontSize,
      lineHeight: Math.round(fontSize * 1.65),
      wordWrap: wordWrap ? "on" : "off",
      lineNumbers: lineNumbers ? "on" : "off",
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 4,
      folding: false,
    });
  }, [fontSize, wordWrap, lineNumbers]); // eslint-disable-line react-hooks/exhaustive-deps

  const openRenameDialogLatestRef = useRef(openRenameDialog);
  openRenameDialogLatestRef.current = openRenameDialog;

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setEditorMounted(true);

    const domNode = editor.getDomNode();
    if (domNode) {
      const dblClickHandler = () => {
        const pos = editor.getPosition();
        if (pos) scrollToPdfLineRef.current?.(pos.lineNumber);
      };
      domNode.addEventListener("dblclick", dblClickHandler);
      domCleanupRef.current = () => domNode.removeEventListener("dblclick", dblClickHandler);
    }

    disposablesRef.current.push(
      editor.onContextMenu((e) => {
        e.event.preventDefault();
        e.event.stopPropagation();
        const pos = e.target.position;
        const sel = editor.getSelection();
        const hasSel = sel && !sel.isEmpty();
        const sLine = hasSel ? sel.startLineNumber : (pos?.lineNumber ?? null);
        const eLine = hasSel ? sel.endLineNumber : (pos?.lineNumber ?? null);
        const selTxt = hasSel ? (editor.getModel()?.getValueInRange(sel) ?? "") : "";

        setCtxStartLine(sLine);
        setCtxEndLine(eLine);
        setCtxSelText(selTxt);
        setCtxPos(null);
        setCtxMenu({ x: e.event.posx, y: e.event.posy });
      }),
    );

    scrollToLineRef.current = (line: number) => {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    };

    decorationCollRef.current = editor.createDecorationsCollection([]);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      compileRef.current?.();
    });

    editor.addCommand(monaco.KeyCode.F2, () => {
      openRenameDialogLatestRef.current();
    });

    disposablesRef.current.push(
      editor.onDidChangeCursorSelection((e) => {
        if (isAiPreviewingRef?.current) {
          setSelFloating(null);
          return;
        }
        const sel = e.selection;
        if (sel.isEmpty()) {
          setSelFloating(null);
        } else {
          const model = editor.getModel();
          const text = model ? model.getValueInRange(sel) : "";
          if (text.trim().length > 0) {
            const endPos = { lineNumber: sel.endLineNumber, column: sel.endColumn };
            const coords = editor.getScrolledVisiblePosition(endPos);
            const editorDom = editor.getDomNode();
            if (coords && editorDom) {
              const rect = editorDom.getBoundingClientRect();
              setSelFloating({
                x: Math.min(rect.left + coords.left + 8, window.innerWidth - 180),
                y: Math.max(rect.top + coords.top + coords.height + 4, 8),
                startLine: sel.startLineNumber,
                endLine: sel.endLineNumber,
                text,
              });
            }
          } else {
            setSelFloating(null);
          }
        }
      }),

      editor.onMouseMove((e) => {
        const target = e.target;
        const isGlyph =
          target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
          target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;

        if (isGlyph && target.position) {
          const line = target.position.lineNumber;
          const matched = lineCommentsRef.current.get(line);
          if (matched && matched.length > 0) {
            const editorDom = editor.getDomNode();
            if (editorDom) {
              const rect = editorDom.getBoundingClientRect();
              const glyphLeft = rect.left + (e.event.posx - rect.left);
              const bottomFromViewport = window.innerHeight - e.event.posy + 8;
              setGlyphTooltip({
                x: glyphLeft,
                bottom: bottomFromViewport,
                comments: matched,
              });
            }
            return;
          }
        }
        setGlyphTooltip(null);
      }),

      editor.onMouseLeave(() => {
        setGlyphTooltip(null);
      }),
    );

    editor.onMouseDown((e) => {
      const target = e.target;
      if (
        (target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
          target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) &&
        target.position
      ) {
        const line = target.position.lineNumber;
        const matched = lineCommentsRef.current.get(line);
        if (matched && matched.length > 0) {
          EditorEventBus.emit("flux:open-panel", {
            panel: "Review",
            commentId: matched[0]._id,
          });
        }
      }
    });
  };

  return (
    <div className="h-full w-full flex flex-col">
      <Format />
      <div className="flex-1 w-full relative min-h-0">
        <MonacoEditor
          height="100%"
          defaultLanguage="latex"
          value={content}
          onChange={(value) => setContent(value || "")}
          theme={editorTheme === "dark" ? "latex-dark" : "latex-light"}
          className=""
          onMount={handleEditorMount}
          options={{ automaticLayout: true }}
        />
      </div>

      {/* Glyph comment tooltip */}
      {glyphTooltip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-9997 max-w-xs rounded-lg border border-border bg-popover shadow-xl py-2 px-3 pointer-events-none"
            style={{ left: glyphTooltip.x, bottom: glyphTooltip.bottom }}
          >
            {glyphTooltip.comments.map((c, idx) => (
              <div key={c._id}>
                {idx > 0 && <div className="my-1.5 h-px bg-border" />}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-semibold text-foreground leading-tight">
                    {c.author.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] p-1 py-px rounded-full font-medium",
                      c.status === "resolved"
                        ? "bg-green-500/15 text-green-600"
                        : "bg-blue-500/15 text-blue-600",
                    )}
                  >
                    {c.status === "resolved" ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Circle className="size-3.5" />
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">
                  {c.content}
                </p>
                {c.replies.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {c.replies.length}{" "}
                    {c.replies.length === 1 ? "reply" : "replies"}
                  </p>
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}

      {/* Selection floating action bar */}
      {selFloating &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={selFloatingRef}
            className="fixed z-9998 flex items-center gap-px rounded-lg border border-border bg-popover shadow-lg px-1 py-1"
            style={{ left: selFloating.x, top: selFloating.y }}
          >
            <button
              onClick={() => {
                setPendingComment({
                  startLine: selFloating.startLine,
                  endLine: selFloating.endLine,
                  selectedText: selFloating.text,
                });
                EditorEventBus.emit("flux:open-panel", "Review");
                setSelFloating(null);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-primary/80 hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Add Comment"
            >
              <MessageSquarePlus className="size-3.5" />
              <span>Comment</span>
            </button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
              onClick={() => {
                if (selFloating.text) {
                  setPendingAiContext({
                    selectedText: selFloating.text,
                    startLine: selFloating.startLine,
                    endLine: selFloating.endLine,
                  });
                }
                EditorEventBus.emit("flux:open-ai-panel");
                setSelFloating(null);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors"
              title="Ask AI"
            >
              <img src="/Flux.svg" alt="Flux" className="size-3.5" />
              <span>Ask AI</span>
            </button>
          </div>,
          document.body,
        )}

      {/* Custom context menu portal */}
      {ctxMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={ctxMenuRef}
            className="fixed z-9999 w-52 rounded-lg border border-border bg-popover shadow-xl py-1 overflow-hidden"
            style={{
              left: ctxPos?.x ?? ctxMenu.x,
              top: ctxPos?.y ?? ctxMenu.y,
              visibility: ctxPos ? "visible" : "hidden",
            }}
          >
            {menuGroups.map((group, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <div className="my-1 mx-2 h-px bg-border" />}
                {group.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      disabled={item.disabled}
                      onClick={item.action}
                      className={cn(
                        "group w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs",
                        "hover:bg-accent hover:text-accent-foreground transition-colors",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                      )}
                    >
                      {Icon ? (
                        <Icon className="size-3.5 shrink-0 text-muted-foreground group-hover:text-accent-foreground" />
                      ) : (
                        <span className="size-3.5 shrink-0" />
                      )}
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.kbd && (
                        <kbd className="text-[9px] text-muted-foreground font-mono tracking-tight">
                          {item.kbd}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>,
          document.body,
        )}

      {/* Rename occurrences confirmation dialog */}
      {renameDialog &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-dialog-title"
            className="fixed inset-0 z-9999 flex items-center justify-center bg-background/50 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl space-y-3">
              <h3
                id="rename-dialog-title"
                className="text-sm font-semibold text-foreground"
              >
                Rename Occurrences
              </h3>
              <div className="space-y-1">
                <label
                  htmlFor="rename-input"
                  className="text-xs text-muted-foreground"
                >
                  Rename{" "}
                  <code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground">
                    {renameDialog.word}
                  </code>{" "}
                  to:
                </label>
                <input
                  id="rename-input"
                  ref={renameInputRef}
                  value={renameDialog.newName}
                  onChange={(e) =>
                    setRenameDialog((d) =>
                      d ? { ...d, newName: e.target.value } : null,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      applyRename(renameDialog.word, renameDialog.newName);
                    if (e.key === "Escape") setRenameDialog(null);
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
                  spellCheck={false}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameDialog(null)}
                  className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyRename(renameDialog.word, renameDialog.newName)
                  }
                  disabled={
                    !renameDialog.newName.trim() ||
                    renameDialog.newName === renameDialog.word
                  }
                  className="px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
