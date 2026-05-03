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

// Register LaTeX language and custom theme before Monaco loads
loader.init().then((monaco) => {
  registerLaTeXLanguage(monaco);

  // Define custom light theme with darker line number background
  monaco.editor.defineTheme("latex-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a737d", fontStyle: "italic" },
      { token: "keyword", foreground: "d73a49" },
      { token: "string", foreground: "032f62" },
      { token: "number", foreground: "005cc5" },
      { token: "delimiter", foreground: "24292e" },
      { token: "operator", foreground: "d73a49" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292e",
      "editor.lineHighlightBackground": "#f6f8fa",
      "editorLineNumber.foreground": "#5d646c",
      "editorLineNumber.activeForeground": "#24292e",
      "editorGutter.background": "#f0f1f3",
      "editor.selectionBackground": "#0366d625",
      "editor.inactiveSelectionBackground": "#0366d615",
      "editorCursor.foreground": "#24292e",
      "editorWhitespace.foreground": "#d1d5da",
      "editorIndentGuide.background": "#e1e4e8",
      "editorIndentGuide.activeBackground": "#c8c8c8",
    },
  });

  // Define custom dark theme with darker line number background
  monaco.editor.defineTheme("latex-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a9955", fontStyle: "italic" },
      { token: "keyword", foreground: "569cd6" },
      { token: "string", foreground: "ce9178" },
      { token: "number", foreground: "b5cea8" },
      { token: "delimiter", foreground: "d4d4d4" },
      { token: "operator", foreground: "d4d4d4" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "editor.lineHighlightBackground": "#2a2d2e",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#c6c6c6",
      "editorGutter.background": "#141414",
      "editor.selectionBackground": "#264f78",
      "editor.inactiveSelectionBackground": "#3a3d41",
      "editorCursor.foreground": "#aeafad",
      "editorWhitespace.foreground": "#3b3b3b",
      "editorIndentGuide.background": "#404040",
      "editorIndentGuide.activeBackground": "#707070",
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
  const { compileRef, scrollToLineRef, scrollToPdfLineRef } =
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
  const { setPendingComment, setPendingAiText } = useWorkspaceActionsStore();
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
    // If the active page changed while the debounce was pending, discard this save.
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
        label: "Ask AI about this",
        action: () => {
          if (ctxSelText) setPendingAiText(ctxSelText);
          // Open the in-editor AI chat panel (keyboard shortcut Ctrl+Alt+A)
          document.dispatchEvent(new CustomEvent("flux:toggle-ai-panel"));
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
      wordWrap: wordWrap ? "on" : "off",
      lineNumbers: lineNumbers ? "on" : "off",
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
      // Clean up when the editor is disposed
      editor.onDidDispose(() =>
        domNode.removeEventListener("dblclick", dblClickHandler),
      );

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
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      scrollBeyondLastLine: false,
      padding: { top: 2, bottom: 2 },
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 6,
      glyphMargin: true,
      folding: true,
      foldingStrategy: "indentation",
      contextmenu: false,
      // Position overlay widgets relative to viewport to avoid overflow:hidden clipping.
      fixedOverflowWidgets: true,
    });

    // Decoration collection for inline comment glyph indicators
    decorationCollRef.current = editor.createDecorationsCollection([]);

    // Register line-scroll ref so ReviewTab/others can jump to a specific line
    scrollToLineRef.current = (line: number) => {
      editor.revealLineInCenter(line, 0 /* Immediate */);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
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
    <div className="h-full w-full">
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
                if (selFloating.text) setPendingAiText(selFloating.text);
                document.dispatchEvent(
                  new CustomEvent("flux:open-panel", { detail: "Ask AI" }),
                );
                setSelFloating(null);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-primary/80 hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Ask Flux AI"
            >
              <img src="/Chat.svg" alt="Flux AI Comment" className="size-3.5" />
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
