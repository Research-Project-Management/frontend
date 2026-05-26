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
import { useParams } from "react-router";
import { useUpdatePageContent } from "~/query/page";
import { usePageComments } from "~/query/comment";
import type { Page } from "~/types/page";
import type { PageComment } from "~/types/page";
import { useWorkspaceActionsStore } from "~/stores/workspace-actions";
import { useDebounce } from "~/hooks/useDebounce";
import { useEditorContext } from "./EditorLayout";
import { usePageContext } from "../PageContext";
import { useEditorSettingsStore } from "~/stores/editor-settings";
import { useCompileStore } from "~/stores/compile";
import { cn } from "~/lib/utils";
import { useSocket } from "~/contexts/SocketProvider";
import { usePagePresence } from "~/hooks/usePagePresence";
import { useRemoteCursors } from "~/hooks/useRemoteCursors";
import EditorToolbar from "./EditorToolbar";


// Register LaTeX language and custom theme before Monaco loads
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

/** Deterministic HSL colour from an arbitrary string (e.g. user._id). */
function stringToColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360},65%,42%)`;
}

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

export default function Editor({ page }: EditorProps) {
  const { editorRef } = useEditorContext();
  const { compileRef, scrollToLineRef, scrollToPdfLineRef, isAiPreviewingRef } =
    usePageContext();
  const { markDirty } = useCompileStore();
  const { editorTheme, autoCompile, fontSize, wordWrap, lineNumbers } = useEditorSettingsStore();
  const [content, setContent] = useState(page.content || "");
  // Tracks the current page._id to detect tab switches
  const activePageIdRef = useRef(page._id);
  const debouncedContent = useDebounce(content, 1000);
  // Ref to schedule a compile after the next successful save+sync.
  const pendingCompileRef = useRef(false);
  const updateMutation = useUpdatePageContent();
  const { pageId: pageIdParam } = useParams<{ pageId: string }>();
  const { setPendingComment, setPendingAiText, setPendingAiContext } = useWorkspaceActionsStore();
  const { data: comments = [] } = usePageComments(pageIdParam ?? null);
  const [ctxMenu, setCtxMenu] = useState<CtxPos | null>(null);
  // Adjusted position after measuring the menu DOM (avoids pre-paint flash)
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
  const socket = useSocket();
  // Tracks the last content received via socket to avoid re-saving/re-emitting remote changes.
  const lastRemoteContentRef = useRef<string | null>(null);
  // Remote cursor widgets
  const presenceUsers = usePagePresence(pageIdParam);
  const remoteCursors = useRemoteCursors(pageIdParam);
  const [editorMounted, setEditorMounted] = useState(false);
  const cursorWidgetsRef = useRef<Map<string, editor.IContentWidget>>(
    new Map(),
  );

  // Realtime: receive content changes from other collaborators
  useEffect(() => {
    if (!socket || !page._id) return;
    const handleRemote = ({
      pageId,
      content: remote,
    }: {
      pageId: string;
      content: string;
    }) => {
      if (pageId !== page._id) return;
      const ed = editorRef.current;
      if (ed && ed.getValue() === remote) return;
      lastRemoteContentRef.current = remote;
      setContent(remote);
    };
    socket.on("page:content", handleRemote);
    return () => {
      socket.off("page:content", handleRemote);
    };
  }, [socket, page._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save when content changes (debounced) — skip if it originated from socket.
  // Guard against stale debounce firing after a tab switch: compare the page id
  // captured when the debounce started with the currently-active page.
  useEffect(() => {
    if (activePageIdRef.current !== page._id) return;
    if (debouncedContent === lastRemoteContentRef.current) return;
    if (debouncedContent && debouncedContent !== page.content) {
      // Push into global dirty map so compile can flush ALL open tabs
      markDirty(page._id, debouncedContent);
      updateMutation.mutate({ pageId: page._id, content: debouncedContent });
      // Mark that we want to auto-compile after this save confirms the sync.
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

  // Realtime: broadcast local content changes to other collaborators (debounced)
  useEffect(() => {
    if (!socket || !page._id || !debouncedContent) return;
    if (activePageIdRef.current !== page._id) return;
    if (debouncedContent === lastRemoteContentRef.current) return;
    // Never broadcast AI preview edits to other users
    if (isAiPreviewingRef.current) return;
    socket.emit("page:content", {
      pageId: page._id,
      content: debouncedContent,
    });
  }, [debouncedContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset editor state only when switching to a different page.
  // IMPORTANT: Do NOT include `content` or `page.content` in the deps — that would cause
  // this to fire on every keystroke (content !== page.content while typing → reset loop).
  // Collaborative content sync is handled by the socket "page:content" effect above.
  useEffect(() => {
    // Update the ref FIRST so any in-flight debounce from the old page is rejected.
    activePageIdRef.current = page._id;
    lastRemoteContentRef.current = null;
    pendingCompileRef.current = false;
    setContent(page.content || "");
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

  // Smart-position the context menu: measure actual DOM size then adjust
  // so it never overflows the viewport edges.
  useLayoutEffect(() => {
    if (!ctxMenu || !ctxMenuRef.current) return;
    if (ctxPos) return; // already positioned for this open
    const el = ctxMenuRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rawX = ctxMenu.x;
    const rawY = ctxMenu.y;
    // Flip left if it would overflow the right edge
    const x = Math.max(4, rawX + w + 4 > vw ? rawX - w - 4 : rawX);
    // Flip upward if it would overflow the bottom edge
    const y = Math.max(4, rawY + h + 4 > vh ? rawY - h - 8 : rawY);
    setCtxPos({ x, y });
  }, [ctxMenu, ctxPos]);

  // Close selection floating bar when clicking outside
  useEffect(() => {
    if (!selFloating) return;
    const handler = (e: MouseEvent) => {
      if (!selFloatingRef.current?.contains(e.target as Node))
        setSelFloating(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selFloating]);

  // Auto-focus and select the rename input when the dialog opens
  useEffect(() => {
    if (renameDialog) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 30);
    }
  }, [renameDialog]);

  // Update comment glyph decorations when comments change
  useEffect(() => {
    const coll = decorationCollRef.current;
    if (!coll) return;

    // Build map: line → comments that cover that line
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

    // Keep ref in sync so the onMouseMove handler always sees fresh data.
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

  // ── Context menu helpers ────────────────────────────────────────────────────
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
    // Whole-word case-sensitive match using Monaco's findMatches with wordSeparators
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

  // ── Menu definition ─────────────────────────────────────────────────────────
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
          document.dispatchEvent(
            new CustomEvent("flux:open-panel", { detail: "Review" }),
          );
          closeMenu();
        },
      },
      {
        icon: Sparkles,
        label: "Ask Flux AI about this",
        action: () => {
          if (ctxSelText) {
            setPendingAiContext({
              selectedText: ctxSelText,
              startLine: ctxStartLine ?? 1,
              endLine: ctxEndLine ?? ctxStartLine ?? 1,
            });
          }
          document.dispatchEvent(new CustomEvent("flux:open-ai-panel"));
          closeMenu();
        },
      },
    ],
  ];


  // Draw / update remote cursor content widgets whenever cursors or presence changes
  useEffect(() => {
    const ed = editorRef.current;
    if (!editorMounted || !ed) return;

    // Remove stale widgets first
    cursorWidgetsRef.current.forEach((w) => ed.removeContentWidget(w));
    cursorWidgetsRef.current.clear();

    // Add a widget for each remote cursor we know about
    remoteCursors.forEach((cursor, socketId) => {
      const user = presenceUsers.find((u) => u.socketId === socketId);
      if (!user) return;

      const color = stringToColor(user._id);

      const outer = document.createElement("div");
      outer.style.cssText = "position:relative;pointer-events:none;";

      const label = document.createElement("div");
      // Show label below the cursor bar when near the top of the editor to
      // avoid it being clipped by Monaco's overflow:hidden container.
      const labelAbove = cursor.line > 3;
      label.style.cssText = [
        "position:absolute",
        labelAbove ? "bottom:100%" : "top:110%",
        "left:0",
        `background:${color}`,
        "color:#fff",
        "font-size:10px",
        "padding:1px 5px",
        labelAbove
          ? "border-radius:3px 3px 3px 0"
          : "border-radius:0 3px 3px 3px",
        "white-space:nowrap",
        "font-family:system-ui,sans-serif",
        "line-height:1.5",
        "user-select:none",
      ].join(";");
      label.textContent = user.name;

      const bar = document.createElement("div");
      bar.style.cssText = `width:2px;height:1.3em;background:${color};margin-top:-1px;`;

      outer.appendChild(label);
      outer.appendChild(bar);

      const capturedCursor = cursor;
      const widget: editor.IContentWidget = {
        getId: () => `rc:${socketId}`,
        getDomNode: () => outer,
        getPosition: () => ({
          position: {
            lineNumber: capturedCursor.line,
            column: capturedCursor.column,
          },
          preference: [0 as editor.ContentWidgetPositionPreference],
        }),
      };
      ed.addContentWidget(widget);
      cursorWidgetsRef.current.set(socketId, widget);
    });

    return () => {
      cursorWidgetsRef.current.forEach((w) => ed.removeContentWidget(w));
      cursorWidgetsRef.current.clear();
    };
  }, [editorMounted, remoteCursors, presenceUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reactively apply editor settings whenever they change in the SettingsPanel.
  // Theme is handled separately — it's a controlled prop on <MonacoEditor>.
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

  // Keep a stable ref so the F2 command always calls the latest openRenameDialog.
  const openRenameDialogLatestRef = useRef(openRenameDialog);
  openRenameDialogLatestRef.current = openRenameDialog;

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setEditorMounted(true);

    // Intercept right-clicks to show our custom menu.
    // Also attach native dblclick to reliably scroll the PDF to the current line.
    const domNode = editor.getDomNode();
    if (domNode) {
      const dblClickHandler = () => {
        const pos = editor.getPosition();
        if (pos) scrollToPdfLineRef.current?.(pos.lineNumber);
      };
      domNode.addEventListener("dblclick", dblClickHandler);

      const keydownHandler = (e: KeyboardEvent) => {
        const isCtrl = e.ctrlKey || e.metaKey;
        if (isCtrl) {
          const key = e.key.toLowerCase();
          if (key === "s") {
            e.preventDefault();
            e.stopPropagation();
            compileRef.current?.();
          } else if (key === "a") {
            e.preventDefault();
            e.stopPropagation();
            const model = editor.getModel();
            if (model) {
              const lineCount = model.getLineCount();
              const lastLineLength = model.getLineMaxColumn(lineCount);
              editor.setSelection(new monaco.Selection(1, 1, lineCount, lastLineLength));
            }
          }
        }
      };
      domNode.addEventListener("keydown", keydownHandler, true);

      // Clean up when the editor is disposed
      editor.onDidDispose(() => {
        domNode.removeEventListener("dblclick", dblClickHandler);
        domNode.removeEventListener("keydown", keydownHandler, true);
      });

      domNode.addEventListener("contextmenu", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const ed = editorRef.current;
        const sel = ed?.getSelection();
        const curLine = ed?.getPosition()?.lineNumber ?? null;
        setCtxStartLine(sel?.startLineNumber ?? curLine);
        setCtxEndLine(sel?.endLineNumber ?? curLine);
        setCtxSelText(sel ? (ed?.getModel()?.getValueInRange(sel) ?? "") : "");
        // Store raw click position; useLayoutEffect will adjust after measuring
        setCtxPos(null);
        setCtxMenu({ x: e.clientX + 2, y: e.clientY + 2 });
      });
    }

    // Show floating bar on non-empty selection
    editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      const isEmpty =
        sel.startLineNumber === sel.endLineNumber &&
        sel.startColumn === sel.endColumn;
      if (isEmpty) {
        setSelFloating(null);
        return;
      }
      const text = editor.getModel()?.getValueInRange(sel) ?? "";
      if (!text.trim()) {
        setSelFloating(null);
        return;
      }

      // Position the bar just above the selection using Monaco's scroll/layout
      const domNode = editor.getDomNode();
      if (!domNode) return;
      const rect = domNode.getBoundingClientRect();
      const layoutInfo = editor.getLayoutInfo();
      const scrollLeft = editor.getScrollLeft();

      // Use Monaco's built-in API to get the exact pixel position of the selection start line
      const visiblePos = editor.getScrolledVisiblePosition({
        lineNumber: sel.startLineNumber,
        column: sel.startColumn,
      });

      const TOOLBAR_H = 36;
      const GAP = 8;

      let rawY: number;
      if (visiblePos) {
        // visiblePos.top is relative to the editor DOM node top
        rawY = rect.top + visiblePos.top - TOOLBAR_H - GAP;
      } else {
        // Fallback: approximate with lineHeight
        const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
        const scrollTop = editor.getScrollTop();
        const lineTop = rect.top + (sel.startLineNumber - 1) * lineHeight - scrollTop;
        rawY = lineTop - TOOLBAR_H - GAP;
      }
      const clampedY = Math.max(rect.top + 4, rawY);

      // x: centre over selection, clamped to viewport
      const contentLeft = rect.left + layoutInfo.contentLeft - scrollLeft;
      const midX = contentLeft + ((sel.startColumn + sel.endColumn) / 2) * 7.8;
      const TOOLBAR_W = 160;
      const clampedX = Math.min(
        Math.max(midX - TOOLBAR_W / 2, rect.left + 4),
        rect.right - TOOLBAR_W - 4,
      );
      setSelFloating({
        x: clampedX,
        y: clampedY,
        startLine: sel.startLineNumber,
        endLine: sel.endLineNumber,
        text,
      });
    });

    // Emit cursor position to collaborators on every cursor move
    editor.onDidChangeCursorPosition((e) => {
      socket?.emit("page:cursor", {
        pageId: page._id,
        line: e.position.lineNumber,
        column: e.position.column,
      });
    });

    // Ctrl+Enter and Ctrl+S → compile
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      compileRef.current?.(),
    );
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      compileRef.current?.(),
    );

    // Ctrl+A → select all.
    // Monaco's built-in binding requires the EditorTextFocus context key to be
    // active. That key can go stale after transient focus shifts (floating bar,
    // context menu, toolbar clicks). Overriding with addCommand bypasses the
    // context check and guarantees Ctrl+A always works while the editor is focused.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA, () => {
      const model = editor.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        const lastLineLength = model.getLineMaxColumn(lineCount);
        editor.setSelection(new monaco.Selection(1, 1, lineCount, lastLineLength));
      }
    });

    // Ctrl+Alt+A → open/focus AI chat panel
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyA,
      () => {
        // Dispatch custom event so EditorLayout can toggle the AI panel
        document.dispatchEvent(new CustomEvent("flux:toggle-ai-panel"));
      },
    );

    // Override F2 to show our custom rename confirmation dialog
    editor.addCommand(monaco.KeyCode.F2, () =>
      openRenameDialogLatestRef.current(),
    );


    // Configure editor options — use persisted store values so settings survive reloads.
    editor.updateOptions({
      wordWrap: wordWrap ? "on" : "off",
      minimap: { enabled: false },
      lineNumbers: lineNumbers ? "on" : "off",
      fontSize,
      lineHeight: Math.round(fontSize * 1.65),
      letterSpacing: 0.1,
      fontFamily:
        "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'SFMono-Regular', Consolas, monospace",
      fontLigatures: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      cursorWidth: 2,
      renderLineHighlight: "all",
      renderWhitespace: "selection",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      mouseWheelScrollSensitivity: 1.2,
      padding: { top: 18, bottom: 24 },
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 4,
      glyphMargin: true,
      folding: false,
      foldingStrategy: "indentation",
      showFoldingControls: "mouseover",
      bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
      guides: {
        indentation: true,
        bracketPairs: true,
        bracketPairsHorizontal: false,
        highlightActiveIndentation: true,
      },
      stickyScroll: { enabled: false },
      suggest: { preview: true, showStatusBar: true },
      quickSuggestions: { other: true, comments: false, strings: false },
      parameterHints: { enabled: true },
      contextmenu: false,
      // Position overlay widgets relative to viewport to avoid overflow:hidden clipping.
      fixedOverflowWidgets: true,
    });

    // Decoration collection for inline comment glyph indicators
    decorationCollRef.current = editor.createDecorationsCollection([]);

    const highlightDecorations = editor.createDecorationsCollection([]);
    let highlightTimeout: any = null;

    // Register line-scroll ref so ReviewTab/others can jump to a specific line
    scrollToLineRef.current = (line: number) => {
      editor.revealLineInCenter(line, 0 /* Immediate */);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();

      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }

      highlightDecorations.set([
        {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "flux-active-line-flash",
          },
        },
      ]);

      highlightTimeout = setTimeout(() => {
        highlightDecorations.clear();
      }, 2000);
    };

    // Single click on glyph margin → open Review panel.
    // Double-click anywhere in editor → scroll PDF (handled by native dblclick above).
    editor.onMouseMove((e) => {
      if (e.target.type === 2 /* GUTTER_GLYPH_MARGIN */) {
        const line = e.target.position?.lineNumber;
        if (line != null) {
          const lineCs = lineCommentsRef.current.get(line);
          if (lineCs?.length) {
            const domNode = editor.getDomNode();
            const domRect = domNode?.getBoundingClientRect();
            const pos = editor.getScrolledVisiblePosition({
              lineNumber: line,
              column: 1,
            });
            if (domRect && pos) {
              const lineTopViewport = domRect.top + pos.top;
              setGlyphTooltip({
                x: domRect.left + 4,
                // Place tooltip bottom edge 6px above the line top
                bottom: window.innerHeight - lineTopViewport + 6,
                comments: lineCs,
              });
              return;
            }
          }
        }
      }
      setGlyphTooltip(null);
    });

    editor.onMouseLeave(() => setGlyphTooltip(null));

    editor.onMouseDown((e) => {
      if (e.target.type === 2 /* GUTTER_GLYPH_MARGIN */) {
        document.dispatchEvent(
          new CustomEvent("flux:open-panel", { detail: "Review" }),
        );
      }
    });

    // NOTE: No compile-on-mount here. The initial compile is triggered by
    // EditorLayout after syncProjectMutation succeeds, ensuring the compiler
    // has all project files before the first compilation attempt.
  };

  const defaultValue =
    page.content ||
    `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{${page.title}}
\\author{${page.author.name}}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Write your introduction here.

\\section{Methods}
Describe your methods.

\\subsection{Mathematical Formulas}
Here is an example equation:
$$
E = mc^2
$$

And an inline formula: $a^2 + b^2 = c^2$

\\section{Conclusion}
Your conclusions here.

\\end{document}
`;

  return (
    <div className="h-full w-full flex flex-col">
      <EditorToolbar />
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

      {/* Glyph comment tooltip — appears ABOVE the hovered line, never covers it */}
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
                document.dispatchEvent(
                  new CustomEvent("flux:open-panel", { detail: "Review" }),
                );
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
                document.dispatchEvent(new CustomEvent("flux:open-ai-panel"));
                setSelFloating(null);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
              title="Ask Flux AI"
            >
              <Sparkles className="size-3.5" />
              <span>Ask Flux AI</span>
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
              // Hidden until useLayoutEffect measures and adjusts position
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
          <div className="fixed inset-0 z-10000 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setRenameDialog(null)}
            />
            <div className="relative z-10 w-80 rounded-xl border border-border bg-popover shadow-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Rename Occurrences
                </span>
                <button
                  onClick={() => setRenameDialog(null)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">
                  Rename{" "}
                  <code className="font-mono bg-muted px-1 rounded text-foreground">
                    {renameDialog.word}
                  </code>{" "}
                  to:
                </label>
                <input
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
                  onClick={() => setRenameDialog(null)}
                  className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
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
