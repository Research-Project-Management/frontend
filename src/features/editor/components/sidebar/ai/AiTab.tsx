'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  X, ArrowUp, Square, Check, FileCode2,
  Loader2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import {
  getPageChat,
  streamEditorChat,
  appendChatMessages,
  createChatSession,
  clearPageChat,
  getChatSession,
} from '@/features/editor/services/ai.service';
import { compilePreview, type PreviewCompileResult } from '@/features/editor/services/document.service';
import type { ChatMessage, ChatSession } from "@/features/editor/types/editor-ai.types";
import { useActionsStore } from "@/features/editor/store/actions.store";
import { usePageStore } from "@/features/editor/store/page.store";
import { useCompileStore } from "@/features/editor/store/compile.store";
import { useSettingsStore } from "@/features/editor/store/settings.store";
import {
  buildRichContext,
  parseLatexStructure,
} from "@/features/editor/utils/editor.util";
import {
  parseAiEditResponse,
  parseAiResponse,
  parseDiffToEdits,
  validateAiEdits,
  isEditSafe,
  applyAiEdits,
  highlightEditedLines,
  previewAiEdits,
  type AiEditPreviewHandle,
  type AiEditResponse,
  type AiEditOperation,
  findLatexCommandRange,
  tryLocalCommandEdit,
  SLASH_COMMANDS,
  type SlashCommand,
} from "@/features/editor/utils/ai.util";
import SuggestionCard from "./SuggestionCard";
import ChatHistory from "./ChatHistory";
import { Button } from '@/shared/components/ui/button';
import {
  AssistantMessage,
  MarkdownAssistantMessage,
  DiffApplyBlock,
  type EditOp,
} from './AssistantMessage';
import { PDFPreviewModal } from './PDFPreviewModal';
import {
  SelectionContextBadge,
  SlashCommandMenu,
  ActiveCommandChip,
} from './ChatInputContext';
import { AiWelcomeScreen } from './AiWelcomeScreen';
import { AiTabHeader } from './AiTabHeader';
import {
  isActionableAiEditResponse,
  isEditorActionMessage,
  hashAiEditContent,
  makeAiEditStatusMessage,
  parseAiEditStatus,
  normalizeSelectionContext,
  EXPLANATION_ONLY_COMMANDS,
  type AiEditStatus,
} from '@/features/editor/utils/ai-message.util';

// ── Main component ──────────────────────────────────────────────────────────

export default function AiTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const { editorRef, currentPage, workspaceId, activeFilePage, isAiPreviewingRef, compileRef } = usePageStore();
  const { pendingAiText, setPendingAiText, pendingAiContext, clearPendingAiContext } = useActionsStore();
  const { compileErrors, compileStatus } = useCompileStore();
  const { autoCompile } = useSettingsStore();

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Slash commands
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [activeCommand, setActiveCommand] = useState<SlashCommand | null>(null);

  // Pinned context
  const [pinnedContext, setPinnedContext] = useState<{ label: string; text: string; startLine: number; endLine: number } | null>(null);

  // Monaco annotations (for /explain)
  const [annotations, setAnnotations] = useState<Array<{ id: string; startLine: number; endLine: number; text: string }>>([]);
  const decorationsRef = useRef<string[]>([]);

  // Live selection context ΓÇö updated real-time from Monaco listener
  const [liveSelection, setLiveSelection] = useState<{
    text: string;
    startLine: number;
    endLine: number;
    charCount: number;
    wordCount: number;
    section: string | null;
    environment: string | null;
  } | null>(null);

  // Current rich editor context snapshot
  const [currentFileContent, setCurrentFileContent] = useState("");

  const [previewPending, setPreviewPending] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewCompileResult | null>(null);
  const [previewSuggestion, setPreviewSuggestion] = useState("");

  // Auto Apply mode
  const [autoApply, setAutoApply] = useState(false);
  // autoApplyToast replaced by sonner toast()

  // Structured JSON edit preview ΓÇö shown before applying
  const [pendingEditResponse, setPendingEditResponse] = useState<AiEditResponse | null>(null);
  const [editSafetyWarning, setEditSafetyWarning] = useState<string | null>(null);
  const previewHandleRef = useRef<AiEditPreviewHandle | null>(null);
  // Snapshot-based revert: saved before preview is applied
  const previewSnapshotRef = useRef<string | null>(null);
  const previewCursorRef = useRef<{ lineNumber: number; column: number } | null>(null);
  // Track resolved historical cards (Keep/Dismiss on reload messages) so they show done state
  const [resolvedMsgIdxes, setResolvedMsgIdxes] = useState<Set<number>>(new Set());
  const [editStatusByHash, setEditStatusByHash] = useState<Record<string, AiEditStatus>>({});
  const pendingEditHashRef = useRef<string | null>(null);

  const lastUserPromptRef = useRef<string>("");
  const lastUserCmdRef = useRef<SlashCommand | null>(null);

  // Save last known Monaco cursor position ΓÇö restored for insert after button click steals focus
  const lastCursorRef = useRef<{ lineNumber: number; column: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef("");
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Load per-page chat ΓÇö re-runs whenever workspaceId becomes available
  useEffect(() => {
    if (!pageId || !workspaceId) return;
    setIsLoading(true);
    // NOTE: keep existing messages visible while re-fetching so the UI never
    // shows a full-page spinner on top of a chat the user has already seen.
    getPageChat(pageId, workspaceId)
      .then((session: any) => {
        setChatId(session.id);
        setMessages(
          (session.messages ?? []).map(({ role, content, selectionContext }: any) => ({
            role,
            content,
            selectionContext: normalizeSelectionContext(selectionContext),
          })),
        );
      })
      .catch((err) => console.error("[ChatAiTab] Failed to load chat:", err))
      .finally(() => setIsLoading(false));
    return () => { abortRef.current?.abort(); };
  }, [pageId, workspaceId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  useEffect(() => {
    const next: Record<string, AiEditStatus> = {};
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const parsed = parseAiEditStatus(message.content);
      if (parsed) next[parsed.hash] = parsed.status;
    }
    if (Object.keys(next).length > 0) {
      setEditStatusByHash((prev) => ({ ...prev, ...next }));
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // Build rich editor context ΓÇö uses activeFilePage for filename
  const getRichContext = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return null;
    // activeFilePage is the open tab (e.g. main.tex); currentPage is the root page container
    const filename = (activeFilePage ?? currentPage)?.title ?? "main.tex";
    return buildRichContext(editor, filename);
  }, [editorRef, activeFilePage, currentPage]);

  // Snapshot file content whenever editor changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    setCurrentFileContent(model.getValue());
    const disposable = model.onDidChangeContent(() => {
      setCurrentFileContent(model.getValue());
    });
    return () => disposable.dispose();
  }, [editorRef]);

  // Track Monaco selection + cursor position in real-time
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Track cursor position so Insert works even after button clicks steal focus
    const cursorDisposable = editor.onDidChangeCursorPosition((e: any) => {
      lastCursorRef.current = { lineNumber: e.position.lineNumber, column: e.position.column };
    });

    const update = () => {
      const model = editor.getModel();
      const sel = editor.getSelection();
      if (!model || !sel) { setLiveSelection(null); return; }
      const hasSelection =
        sel.startLineNumber !== sel.endLineNumber ||
        sel.startColumn !== sel.endColumn;
      if (!hasSelection) { setLiveSelection(null); return; }
      const text = model.getValueInRange(sel);
      if (!text.trim()) { setLiveSelection(null); return; }
      const fullContent = model.getValue();
      const struct = parseLatexStructure(fullContent);
      let section: string | null = null;
      for (const s of struct.sections) {
        if (s.startLine <= sel.startLineNumber) section = s.title;
        else break;
      }
      let environment: string | null = null;
      for (const env of struct.environments) {
        if (env.startLine <= sel.startLineNumber && env.endLine >= sel.startLineNumber) {
          environment = env.type;
        }
      }
      setLiveSelection({
        text,
        startLine: sel.startLineNumber,
        endLine: sel.endLineNumber,
        charCount: text.length,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        section,
        environment,
      });
    };
    const selDisposable = editor.onDidChangeCursorSelection(update);
    update();
    return () => { cursorDisposable.dispose(); selDisposable.dispose(); };
  }, [editorRef]);

  // Monaco inline ghost text (for /complete)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const monaco = (window as any).monaco;
    if (!monaco) return;
    const provider = monaco.languages.registerInlineCompletionsProvider("latex", {
      provideInlineCompletions: async (model: any, position: any) => {
        // Only fire when /complete was explicitly triggered
        if (!activeCommand || activeCommand.cmd !== "/complete") return { items: [] };
        return { items: [] }; // Ghost text filled by AI response applied via handleInsert
      },
      freeInlineCompletions: () => { },
    });
    return () => provider.dispose();
  }, [editorRef, activeCommand]);

  // Apply Monaco decorations for /explain annotations
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || annotations.length === 0) return;
    const monaco = (window as any).monaco;
    if (!monaco) return;
    const newDecorations = annotations.map((a) => ({
      range: new monaco.Range(a.startLine, 1, a.endLine, 1),
      options: {
        isWholeLine: true,
        className: "ai-explain-decoration",
        glyphMarginClassName: "ai-explain-glyph",
        hoverMessage: { value: a.text },
      },
    }));
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [annotations, editorRef]);

  // Apply a structured edit operation from DiffApplyBlock
  const handleApplyOp = useCallback((op: EditOp) => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    const monaco = (window as any).monaco;
    if (!monaco) return;

    let range: any;
    let text = op.newContent ?? "";

    if (op.action === "replace_lines" && op.startLine && op.endLine) {
      range = new monaco.Range(op.startLine, 1, op.endLine, model.getLineMaxColumn(op.endLine));
    } else if (op.action === "insert_after" && op.afterLine) {
      const col = model.getLineMaxColumn(op.afterLine);
      range = new monaco.Range(op.afterLine, col, op.afterLine, col);
      text = "\n" + text;
    } else if (op.action === "insert_before" && op.beforeLine) {
      range = new monaco.Range(op.beforeLine, 1, op.beforeLine, 1);
      text = text + "\n";
    } else if (op.action === "delete_lines" && op.startLine && op.endLine) {
      const endCol = model.getLineMaxColumn(op.endLine);
      range = new monaco.Range(op.startLine, 1, op.endLine, endCol);
      text = "";
    } else return;

    editor.executeEdits("ai-apply", [{ range, text, forceMoveMarkers: true }]);
    editor.focus();
  }, [editorRef]);

  const parseApplyBlocks = useCallback((content: string): EditOp[] => {
    const ops: EditOp[] = [];
    const lines = (typeof content === 'string' ? content : content ? String(content) : '').split("\n");
    let inApply = false;
    let applyLines: string[] = [];
    for (const line of lines) {
      if (line.trim() === "```apply") { inApply = true; applyLines = []; continue; }
      if (inApply && line.trim() === "```") {
        try { ops.push(JSON.parse(applyLines.join("\n")) as EditOp); } catch { /* ignore malformed */ }
        inApply = false; applyLines = [];
        continue;
      }
      if (inApply) applyLines.push(line);
    }
    return ops;
  }, []);

  const recordEditStatus = useCallback((status: AiEditStatus) => {
    const lastAssistant = [...messagesRef.current]
      .reverse()
      .find((m) => m.role === "assistant" && !parseAiEditStatus(m.content));
    const hash = pendingEditHashRef.current ?? (lastAssistant ? hashAiEditContent(lastAssistant.content) : null);
    if (!hash) return;

    pendingEditHashRef.current = null;
    setEditStatusByHash((prev) => ({ ...prev, [hash]: status }));

    if (chatId) {
      appendChatMessages(chatId, [makeAiEditStatusMessage(hash, status)]).catch(() => { });
    }
  }, [chatId]);

  const restorePendingPreview = useCallback(() => {
    const editor = editorRef.current;
    const handle = previewHandleRef.current;
    if (handle && editor) {
      handle.clearDecorations();
      const model = editor.getModel();
      const snapshot = previewSnapshotRef.current;
      if (model && snapshot !== null) {
        isAiPreviewingRef.current = true;
        const totalLines = model.getLineCount();
        const lastCol = model.getLineMaxColumn(totalLines);
        editor.executeEdits("ai-preview-revert", [{
          range: { startLineNumber: 1, startColumn: 1, endLineNumber: totalLines, endColumn: lastCol },
          text: snapshot,
          forceMoveMarkers: true,
        }]);
        if (previewCursorRef.current) editor.setPosition(previewCursorRef.current);
        setTimeout(() => { isAiPreviewingRef.current = false; }, 0);
      }
    }

    previewHandleRef.current = null;
    previewSnapshotRef.current = null;
    previewCursorRef.current = null;
  }, [editorRef, isAiPreviewingRef]);

  const replaceLastAssistantSummary = useCallback((content: string) => {
    setMessages(prev => {
      let idx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === "assistant" && !parseAiEditStatus(prev[i].content)) {
          idx = i;
          break;
        }
      }
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = { ...prev[idx], content };
      return updated;
    });
  }, []);

  const clearPendingEdit = useCallback((status: AiEditStatus) => {
    restorePendingPreview();
    setPendingEditResponse(null);
    setEditSafetyWarning(null);
    recordEditStatus(status);
  }, [recordEditStatus, restorePendingPreview]);

  const jumpToSelectionContext = useCallback((ctx: NonNullable<ChatMessage["selectionContext"]>) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;

    const startLine = Math.min(Math.max(ctx.startLine, 1), model.getLineCount());
    const endLine = Math.min(Math.max(ctx.endLine, startLine), model.getLineCount());
    const endColumn = model.getLineMaxColumn(endLine);

    editor.focus();
    if (typeof editor.revealLinesInCenter === "function") {
      editor.revealLinesInCenter(startLine, endLine);
    } else {
      editor.revealLineInCenter(startLine);
    }
    editor.setSelection({
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn,
    });
  }, [editorRef]);

  // Send message ΓÇö passes full rich context to AI
  const handleSend = useCallback(async (overrideText?: string, overrideCommand?: SlashCommand) => {
    const cmd = overrideCommand ?? activeCommand;
    const defaultText = cmd ? cmd.label : "";
    const text = (overrideText ?? input).trim() || defaultText;
    if (!text || isStreaming || !chatId || !workspaceId) return;

    if (pendingEditResponse) {
      clearPendingEdit("dismissed");
    }

    // Track for Regenerate
    lastUserPromptRef.current = overrideText ?? input;
    lastUserCmdRef.current = overrideCommand ?? activeCommand;

    // Use liveSelection (captured before textarea focus) ΓÇö getRichContext reads Monaco
    // which loses selection once user clicks into the textarea
    const selSrc = pinnedContext ?? liveSelection;
    const richCtx = getRichContext(); // for file content + cursor context only

    // Effective selection fields
    const effectiveSelection = selSrc?.text ?? "";
    const effectiveStartLine = selSrc?.startLine;
    const effectiveEndLine = selSrc?.endLine;
    const effectiveSection = liveSelection?.section ?? richCtx?.currentSection;
    const effectiveEnv = liveSelection?.environment ?? richCtx?.currentEnvironment;
    const effectiveSelectionContext =
      effectiveSelection && effectiveStartLine && effectiveEndLine
        ? {
          filename: (activeFilePage ?? currentPage)?.title ?? "main.tex",
          startLine: effectiveStartLine,
          endLine: effectiveEndLine,
          text: effectiveSelection,
        }
        : undefined;

    // Cursor & selection column info for the JSON edit system
    const editor = editorRef.current;
    const monacoSel = editor?.getSelection();
    const cursorPos = editor?.getPosition();
    const cursorLine = cursorPos?.lineNumber;
    const cursorColumn = cursorPos?.column;
    const selStartColumn = monacoSel?.startColumn;
    const selEndColumn = monacoSel?.endColumn;

    // Build compile errors for /fix
    const errorsForAi = cmd?.cmd === "/fix" ? compileErrors : [];

    // Build structure summary
    const structure = richCtx ? parseLatexStructure(richCtx.fileContent) : null;
    const structureSummary = structure
      ? `Sections: ${structure.sections.map(s => s.title).join(", ") || "none"} | Packages: ${structure.packages.slice(0, 8).join(", ")} | Labels: ${structure.labels.slice(0, 10).join(", ")}`
      : "";

    const finalText = text;

    // Is this command edit-only or explanation-only?
    const isExplanationCmd = cmd && EXPLANATION_ONLY_COMMANDS.includes(cmd.cmd);

    // ΓöÇΓöÇ Local command detection ΓÇö bypass AI for simple requests ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // e.g. "sß╗¡a title th├ánh Hello Demo 123", "change author to John"
    if (!isExplanationCmd) {
      const localEdit = tryLocalCommandEdit(richCtx?.fileContent ?? currentFileContent, finalText);
      if (localEdit) {
        const editResponse: AiEditResponse = {
          intent: "replace_range",
          explanation: localEdit.explanation,
          edits: [localEdit.op],
        };
        const userMsg2: ChatMessage = {
          role: "user",
          content: finalText,
          selectionContext: effectiveSelectionContext,
        };
        const assistantMsg2: ChatMessage = { role: "assistant", content: JSON.stringify(editResponse, null, 2) };
        pendingEditHashRef.current = hashAiEditContent(assistantMsg2.content);
        setMessages(prev => [...prev, userMsg2, assistantMsg2]);
        setInput("");
        setActiveCommand(null);
        setSlashMenuOpen(false);
        if (effectiveSelectionContext) {
          setPinnedContext(null);
          setLiveSelection(null);
        }
        setPendingEditResponse(editResponse);
        setEditSafetyWarning(null);
        appendChatMessages(chatId!, [userMsg2, assistantMsg2]).catch(() => { });
        return;
      }
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: finalText,
      selectionContext: effectiveSelectionContext,
    };
    const newMessages = [...messagesRef.current, userMsg];
    setMessages(newMessages);
    setInput("");
    setActiveCommand(null);
    setSlashMenuOpen(false);
    if (effectiveSelectionContext) {
      setPinnedContext(null);
      setLiveSelection(null);
    }
    streamRef.current = "";
    setStreamContent("");
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const chunk of streamEditorChat(newMessages, {
        chatId,
        workspaceId,
        fileContent: richCtx?.fileContent ?? currentFileContent,
        filename: (activeFilePage ?? currentPage)?.title ?? "main.tex",
        selection: effectiveSelection,
        cursorContext: richCtx?.cursorContext ?? "",
        selectionStartLine: effectiveStartLine,
        selectionEndLine: effectiveEndLine,
        selectionStartColumn: selStartColumn,
        selectionEndColumn: selEndColumn,
        contextBefore: richCtx?.contextBefore ?? "",
        contextAfter: richCtx?.contextAfter ?? "",
        currentSection: effectiveSection,
        currentEnvironment: effectiveEnv,
        documentStructureSummary: structureSummary,
        compileErrors: errorsForAi,
        commandHint: cmd?.hint,
        cursorLine,
        cursorColumn,
        signal: controller.signal,
      })) {
        streamRef.current += chunk;
        setStreamContent(streamRef.current);
      }
      const finalContent = streamRef.current;
      if (!finalContent) return;

      // /explain ΓåÆ add annotation decoration
      if (cmd?.cmd === "/explain" && effectiveSelection && effectiveStartLine && effectiveEndLine) {
        setAnnotations((prev) => [
          ...prev,
          { id: Date.now().toString(), startLine: effectiveStartLine, endLine: effectiveEndLine, text: finalContent.slice(0, 300) },
        ]);
      }

      // ΓöÇΓöÇ Structured JSON + diff/code multi-block parsing ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
      if (!isExplanationCmd) {
        // Read live from Monaco model ΓÇö most up-to-date, avoids stale React state
        const fileContent =
          editor?.getModel()?.getValue() ??
          richCtx?.fileContent ??
          currentFileContent;
        const editResponse = parseAiResponse(finalContent, fileContent);
        if (isActionableAiEditResponse(editResponse) && editResponse.intent !== "no_change") {
          const totalLines = editor?.getModel()?.getLineCount() ?? 1;
          const validation = validateAiEdits(editResponse.edits, totalLines, fileContent);

          if (!validation.valid) {
            const errMsg = `AI edit could not be located in file:\n${validation.errors.join("\n")}`;
            const assistantMsg: ChatMessage = { role: "assistant", content: errMsg };
            setMessages((prev) => [...prev, assistantMsg]);
            appendChatMessages(chatId, [userMsg, assistantMsg]).catch(() => { });
            return;
          }

          let safetyWarning: string | null = null;
          if (!isEditSafe(validation, editResponse.intent)) {
            safetyWarning = `ΓÜá∩╕Å This edit affects ${Math.round(validation.replacementRatio * 100)}% of your file. Review carefully before applying.`;
          }

          if (autoApply && !safetyWarning) {
            applyAiEdits(editor, editResponse.edits);
            toast.success(`ΓÜí Auto-applied ${editResponse.edits.length} edit${editResponse.edits.length > 1 ? "s" : ""} to editor`, { duration: 3500 });
            const assistantMsg: ChatMessage = { role: "assistant", content: finalContent };
            setMessages((prev) => [...prev, assistantMsg]);
            appendChatMessages(chatId, [userMsg, assistantMsg]).catch(() => { });
            return;
          }

          // Show inline preview (ghost blue) + suggestion card
          pendingEditHashRef.current = hashAiEditContent(finalContent);
          setEditSafetyWarning(safetyWarning);
          setPendingEditResponse(editResponse);
          const assistantMsg: ChatMessage = { role: "assistant", content: finalContent };
          setMessages((prev) => [...prev, assistantMsg]);
          appendChatMessages(chatId, [userMsg, assistantMsg]).catch(() => { });
          return;
        }
      }

      // ΓöÇΓöÇ Legacy auto-apply (apply-blocks) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
      if (autoApply) {
        const ops = parseApplyBlocks(finalContent);
        if (ops.length > 0) {
          ops.forEach((op) => handleApplyOp(op));
          toast.success(`ΓÜí Auto-applied ${ops.length} change${ops.length > 1 ? "s" : ""} to editor`, { duration: 3000 });
        }
      }

      const assistantMsg: ChatMessage = { role: "assistant", content: finalContent };
      setMessages((prev) => [...prev, assistantMsg]);
      appendChatMessages(chatId, [userMsg, assistantMsg]).catch(() => { });
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) => [...prev, { role: "assistant", content: "An error occurred. Please try again." }]);
      }
    } finally {
      setIsStreaming(false);
      setStreamContent("");
      streamRef.current = "";
      abortRef.current = null;
    }
  }, [input, isStreaming, chatId, workspaceId, pendingEditResponse, getRichContext, activeFilePage, currentPage, activeCommand, compileErrors, pinnedContext, autoApply, parseApplyBlocks, handleApplyOp, editorRef, currentFileContent, clearPendingEdit, liveSelection]);

  // ΓöÇΓöÇ Auto-preview: whenever a pending edit is set, show it in the editor immediately ΓöÇΓöÇ
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!isActionableAiEditResponse(pendingEditResponse)) {
      if (previewHandleRef.current) {
        previewHandleRef.current.clearDecorations();
        previewHandleRef.current = null;
      }
      previewSnapshotRef.current = null;
      previewCursorRef.current = null;
      return;
    }

    restorePendingPreview();

    // Save snapshot BEFORE applying preview so dismiss can restore atomically
    const model = editor.getModel();
    previewSnapshotRef.current = model ? model.getValue() : null;
    previewCursorRef.current = editor.getPosition() ?? null;

    isAiPreviewingRef.current = true;
    previewHandleRef.current = previewAiEdits(editor, pendingEditResponse.edits);
    setTimeout(() => { isAiPreviewingRef.current = false; }, 0);
  }, [pendingEditResponse, editorRef, restorePendingPreview]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply: edits are already in the editor (from preview) ΓÇö just confirm them
  const handleApplyStructuredEdits = useCallback((_edits: AiEditOperation[]) => {
    const editor = editorRef.current;
    if (!editor) return;

    const handle = previewHandleRef.current;
    if (handle) {
      // Edits already in model from preview ΓÇö just confirm with undo stop + clear decorations
      handle.clearDecorations();
      editor.pushUndoStop(); // creates clean undo boundary
      if (handle.affected) {
        highlightEditedLines(editor, handle.affected.startLine, handle.affected.endLine);
      }
      previewHandleRef.current = null;
    } else {
      // Fallback: no preview was active, apply fresh
      const affected = applyAiEdits(editor, _edits);
      if (affected) highlightEditedLines(editor, affected.startLine, affected.endLine);
    }

    setPendingEditResponse(null);
    setEditSafetyWarning(null);
    recordEditStatus("applied");
    // Replace last assistant message JSON content with clean summary so card disappears
    const explanation = pendingEditResponse?.explanation ?? "Edit applied to document";
    replaceLastAssistantSummary(`Γ£ô ${explanation}`);
    toast.success(`Γ£ô Edit applied`, { duration: 2000 });
    // Auto-compile after AI edit if enabled ΓÇö delay to allow save to flush
    if (autoCompile) {
      setTimeout(() => compileRef.current?.(), 1800);
    }
  }, [editorRef, pendingEditResponse, autoCompile, compileRef, recordEditStatus, replaceLastAssistantSummary]);

  // Dismiss: atomically restore content snapshot (no fragile undo-loop)
  const handleDismissEdits = useCallback(() => {
    clearPendingEdit("dismissed");
    // Replace last assistant message JSON with "dismissed" marker so card disappears
    replaceLastAssistantSummary("Edit dismissed");
  }, [clearPendingEdit, replaceLastAssistantSummary]);

  // Regenerate ΓÇö dismiss current edit response and re-send last prompt
  const handleRegenerate = useCallback(() => {
    if (pendingEditResponse) {
      clearPendingEdit("dismissed");
      replaceLastAssistantSummary("Edit dismissed");
    }
    const prompt = lastUserPromptRef.current;
    const cmd = lastUserCmdRef.current;
    if (prompt) {
      handleSend(prompt, cmd ?? undefined);
    }
  }, [clearPendingEdit, handleSend, pendingEditResponse, replaceLastAssistantSummary]);

  // Insert LaTeX into editor ΓÇö converts to a preview-based edit so user sees Accept/Dismiss
  const queueEditorEdit = useCallback((editResponse: AiEditResponse) => {
    const editor = editorRef.current;
    if (autoApply && editor) {
      const affected = applyAiEdits(editor, editResponse.edits);
      if (affected) highlightEditedLines(editor, affected.startLine, affected.endLine);
      toast.success(`Auto-inserted ${editResponse.edits.length} change${editResponse.edits.length > 1 ? "s" : ""}`, { duration: 2500 });
      if (autoCompile) {
        setTimeout(() => compileRef.current?.(), 1800);
      }
      return;
    }

    pendingEditHashRef.current = hashAiEditContent(JSON.stringify(editResponse));
    setPendingEditResponse(editResponse);
    setEditSafetyWarning(null);
  }, [autoApply, autoCompile, compileRef, editorRef]);

  const handleInsert = useCallback((latex: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const content = model.getValue();
    const trimmed = latex.trim();

    // 1. Single known command (\title, \author etc.) ΓåÆ replace existing occurrence
    const cmdMatch = trimmed.match(/^\\([a-zA-Z]+)\s*\{/);
    if (cmdMatch) {
      const commandName = cmdMatch[1];
      const existingRange = findLatexCommandRange(content, commandName);
      if (existingRange) {
        // Show as a structured preview with Accept / Dismiss
        const editResponse: AiEditResponse = {
          intent: "replace_range",
          explanation: `Replace \\${commandName}{ΓÇª}`,
          edits: [{
            type: "replace",
            startLineNumber: existingRange.startLineNumber,
            startColumn: existingRange.startColumn,
            endLineNumber: existingRange.endLineNumber,
            endColumn: existingRange.endColumn,
            text: trimmed,
          }],
        };
        queueEditorEdit(editResponse);
        return;
      }
    }

    // 2. Has live selection ΓåÆ replace it
    const monacoSel = editor.getSelection();
    if (monacoSel &&
      !(monacoSel.startLineNumber === monacoSel.endLineNumber &&
        monacoSel.startColumn === monacoSel.endColumn)) {
      const editResponse: AiEditResponse = {
        intent: "replace_selection",
        explanation: "Replace selected text",
        edits: [{
          type: "replace",
          startLineNumber: monacoSel.startLineNumber,
          startColumn: monacoSel.startColumn,
          endLineNumber: monacoSel.endLineNumber,
          endColumn: monacoSel.endColumn,
          text: trimmed,
        }],
      };
      queueEditorEdit(editResponse);
      return;
    }

    // 3. Insert at last known cursor position (saved ref survives button-click focus loss)
    const pos = lastCursorRef.current ?? editor.getPosition() ?? { lineNumber: 1, column: 1 };
    const editResponse: AiEditResponse = {
      intent: "insert_at_cursor",
      explanation: `Insert at line ${pos.lineNumber}`,
      edits: [{
        type: "insert",
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
        text: trimmed,
      }],
    };
    queueEditorEdit(editResponse);
  }, [editorRef, queueEditorEdit]);

  // Apply diff block ΓÇö uses parseDiffToEdits to locate changes in the file
  const handleApplyDiff = useCallback((diffText: string) => {
    const fileContent = editorRef.current?.getModel()?.getValue() ?? currentFileContent;
    const ops = parseDiffToEdits(diffText, fileContent);
    if (ops.length === 0) {
      // Fallback: extract added lines and insert at cursor
      const added = diffText.split("\n")
        .filter(l => l.startsWith("+") && !l.startsWith("+++"))
        .map(l => l.slice(1)).join("\n");
      if (added) handleInsert(added);
      return;
    }
    const editResponse: AiEditResponse = {
      intent: "replace_range",
      explanation: `Apply diff (${ops.length} hunk${ops.length !== 1 ? "s" : ""})`,
      edits: ops,
    };
    queueEditorEdit(editResponse);
  }, [editorRef, currentFileContent, handleInsert, queueEditorEdit]);

  // Pin current selection as context
  const handlePinContext = useCallback(() => {
    if (!liveSelection) return;
    const range = liveSelection.startLine === liveSelection.endLine
      ? `L${liveSelection.startLine}`
      : `L${liveSelection.startLine}ΓÇô${liveSelection.endLine}`;
    setPinnedContext({
      label: `${(activeFilePage ?? currentPage)?.title ?? "main.tex"} ${range}`,
      text: liveSelection.text,
      startLine: liveSelection.startLine,
      endLine: liveSelection.endLine,
    });
  }, [liveSelection, activeFilePage, currentPage]);


  // Preview LaTeX
  const handlePreview = useCallback(async (latex: string) => {
    const richCtx = getRichContext();
    setPreviewSuggestion(latex);
    setPreviewPending(true);
    try {
      const result = await compilePreview({
        baseContent: richCtx?.fileContent ?? "",
        suggestion: latex,
        sessionId: `${pageId ?? "p"}_${workspaceId ?? "w"}`,
      });
      setPreviewResult(result);
    } catch (err) {
      setPreviewResult({ pdf: "", success: false, log: String(err) });
    } finally {
      setPreviewPending(false);
    }
  }, [getRichContext, pageId, workspaceId]);

  // Handle input changes ΓÇö detect slash commands
  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (val.startsWith("/")) {
      const filter = val.slice(1).toLowerCase();
      setSlashFilter(filter);
      setSlashMenuOpen(true);
    } else {
      setSlashMenuOpen(false);
      setSlashFilter("");
    }
  }, []);

  // Auto-fill from legacy pendingAiText (plain text pre-fill)
  useEffect(() => {
    if (pendingAiText) {
      setInput(pendingAiText);
      setPendingAiText("");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [pendingAiText, setPendingAiText]);

  // Bind selection from the editor into the AI toolbar. The user sends their own prompt.
  useEffect(() => {
    if (!pendingAiContext) return;
    clearPendingAiContext();
    const { selectedText, startLine, endLine, question } = pendingAiContext;
    setPinnedContext({
      label: `${(activeFilePage ?? currentPage)?.title ?? "main.tex"} ${startLine === endLine ? `L${startLine}` : `L${startLine}-${endLine}`}`,
      text: selectedText,
      startLine,
      endLine,
    });
    if (question?.trim()) setInput(question.trim());
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [pendingAiContext, clearPendingAiContext, activeFilePage, currentPage]);

  // Auto-focus on mount or chatId change
  useEffect(() => {
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [chatId]);

  // Re-focus after AI streaming concludes
  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

  // Focus-on-type: Automatically focus the chat input when the user starts typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoading || isStreaming) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key.length === 1 && e.key !== " ") {
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLoading, isStreaming]);

  // Clear history
  const handleClear = useCallback(async () => {
    if (!pageId) return;
    setShowClearConfirm(false);
    if (pendingEditResponse) {
      clearPendingEdit("dismissed");
    }
    setMessages([]);
    try { await clearPageChat(pageId); }
    catch (err) { console.error("[ChatAiTab] Clear error:", err); }
  }, [pageId, pendingEditResponse, clearPendingEdit]);

  const handleNewConversation = useCallback(async () => {
    if (!workspaceId) return;
    setShowClearConfirm(false);
    if (pendingEditResponse) {
      clearPendingEdit("dismissed");
    }
    setMessages([]);
    setInput("");
    setActiveCommand(null);
    setEditSafetyWarning(null);
    setStreamContent("");
    setIsStreaming(false);
    streamRef.current = "";
    abortRef.current?.abort();

    try {
      const filename = (activeFilePage ?? currentPage)?.title ?? "main.tex";
      const session = await createChatSession({
        workspaceId,
        title: `Editor chat - ${filename}`,
      });
      setChatId(session.id);
    } catch (err) {
      console.error("[ChatAiTab] New conversation error:", err);
      toast.error("Could not create a new conversation");
    }
  }, [workspaceId, activeFilePage, currentPage, pendingEditResponse, clearPendingEdit]);

  const handleSelectHistoryChat = useCallback(async (chat: ChatSession) => {
    setIsLoading(true);
    setPendingEditResponse(null);
    setEditSafetyWarning(null);
    setResolvedMsgIdxes(new Set());
    abortRef.current?.abort();

    try {
      const session = await getChatSession(chat.id);
      setChatId(session.id);
      setMessages(
        (session.messages ?? []).map(({ role, content, sources, selectionContext }: any) => ({
          role,
          content,
          sources,
          selectionContext: normalizeSelectionContext(selectionContext),
        })),
      );
      setStreamContent("");
      streamRef.current = "";
    } catch (err) {
      console.error("[ChatAiTab] Load history chat error:", err);
      toast.error("Could not open that chat history");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const quickPrompts = [
    "Improve this paragraph's academic writing style",
    "Fix any LaTeX syntax errors in my selection",
    "Generate a professional table from my data",
    "Add a citation for this claim",
  ];

  const selectionToolbarContext = pinnedContext ?? liveSelection;
  const selectionToolbarRange = selectionToolbarContext
    ? selectionToolbarContext.startLine === selectionToolbarContext.endLine
      ? `L${selectionToolbarContext.startLine}`
      : `L${selectionToolbarContext.startLine}-${selectionToolbarContext.endLine}`
    : "";
  const selectionToolbarText = selectionToolbarContext?.text ?? "";
  const selectionToolbarCharCount =
    selectionToolbarContext && "charCount" in selectionToolbarContext
      ? selectionToolbarContext.charCount
      : selectionToolbarText.length;
  const selectionToolbarWordCount =
    selectionToolbarContext && "wordCount" in selectionToolbarContext
      ? selectionToolbarContext.wordCount
      : selectionToolbarText.split(/\s+/).filter(Boolean).length;

  return (
    <>
      <style>{`
        @keyframes typing-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
        .ai-edit-highlight-line {
          background: rgba(34, 197, 94, 0.12) !important;
          border-left: 2px solid rgba(34, 197, 94, 0.5);
          transition: background 0.5s ease;
        }
        .ai-edit-preview-line {
          background: rgba(99, 179, 237, 0.13) !important;
          border-left: 2px solid rgba(99, 179, 237, 0.55);
        }
      `}</style>

      <div className="relative flex h-full flex-col bg-background">

        <AiTabHeader
          workspaceId={workspaceId}
          isStreaming={isStreaming}
          autoApply={autoApply}
          onToggleAutoApply={() => setAutoApply((v) => !v)}
          onNewConversation={handleNewConversation}
          onOpenHistory={() => setHistoryOpen(true)}
          hasMessages={messages.length > 0}
          showClearConfirm={showClearConfirm}
          onShowClearConfirm={setShowClearConfirm}
          onClear={handleClear}
          onClose={onClose}
        />

        {/* Toast notifications now via sonner ΓÇö see toast() calls above */}

        {/* ΓöÇΓöÇ File context bar ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
        {/* ΓöÇΓöÇ Compile error banner ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
        {compileStatus === "error" && compileErrors.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/8 border-b border-destructive/15 shrink-0">
            <AlertTriangle className="size-3 text-destructive shrink-0" />
            <span className="text-xs text-destructive/80 truncate flex-1">{compileErrors[0].message}</span>
            <button
              onClick={() => {
                const cmd = SLASH_COMMANDS.find(c => c.cmd === "/fix")!;
                setActiveCommand(cmd);
                handleSend(`Fix the LaTeX compile error: ${compileErrors[0].message}`, cmd);
              }}
              className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
            >
              Fix with AI
            </button>
          </div>
        )}

        {/* Slim loading bar at top ΓÇö replaces full-area spinner */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 z-10 h-0.5 overflow-hidden">
            <div className="h-full bg-primary/50 animate-pulse w-3/5 mx-auto" />
          </div>
        )}

        {/* ΓöÇΓöÇ Messages ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !isStreaming && !isLoading ? (
            <AiWelcomeScreen
              quickPrompts={quickPrompts}
              onSelectPrompt={(p) => {
                setInput(p);
                textareaRef.current?.focus();
              }}
            />
          ) : (
            /* ΓöÇΓöÇ Chat messages ΓöÇΓöÇ */
            <div className="px-3 py-4 space-y-4">
              {messages.map((msg, i) => {
                if (msg.role === "assistant" && parseAiEditStatus(msg.content)) {
                  return null;
                }
                // If this is the last assistant msg with a pending edit ΓåÆ render it as the suggestion card (IS the message bubble)
                const isLastAssistantMsg =
                  msg.role === "assistant" && i === messages.length - 1;
                const isPendingEdit =
                  isLastAssistantMsg &&
                  isActionableAiEditResponse(pendingEditResponse) &&
                  !isStreaming;

                if (isPendingEdit) {
                  return (
                    <div key={i} className="flex gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 justify-start">
                      <div className="flex-1 min-w-0">
                        <SuggestionCard
                          editResponse={pendingEditResponse!}
                          fileContent={currentFileContent}
                          safetyWarning={editSafetyWarning}
                          onApply={handleApplyStructuredEdits}
                          onDismiss={handleDismissEdits}
                          onRegenerate={handleRegenerate}
                        />
                      </div>
                    </div>
                  );
                }

                // Detect AI edit JSON messages (both in-session and after reload)
                // Handles both raw JSON and markdown-fenced ```json blocks
                if (msg.role === "assistant") {
                  // Extract raw JSON string from content (handles ``` fences or bare {})
                  const extractJsonStr = (content: string): string | null => {
                    const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
                    if (fenceMatch) return fenceMatch[1].trim();
                    const trimmed = content.trimStart();
                    if (trimmed.startsWith("{")) return trimmed;
                    return null;
                  };

                  const jsonStr = extractJsonStr(msg.content);
                  if (jsonStr) {
                    let parsed: any = null;
                    try { parsed = JSON.parse(jsonStr); } catch {
                      // Sanitize literal newlines inside string values
                      try {
                        let s = "", inStr = false, esc = false;
                        for (const ch of jsonStr) {
                          if (esc) { s += ch; esc = false; continue; }
                          if (ch === "\\" && inStr) { s += ch; esc = true; continue; }
                          if (ch === '"') { inStr = !inStr; s += ch; continue; }
                          if (inStr && ch === "\n") { s += "\\n"; continue; }
                          if (inStr && ch === "\r") { s += "\\r"; continue; }
                          s += ch;
                        }
                        parsed = JSON.parse(s);
                      } catch { /* not parseable */ }
                    }
                    if (isActionableAiEditResponse(parsed)) {
                      const historicalEdit = parsed as AiEditResponse;
                      const editHash = hashAiEditContent(msg.content);
                      const editStatus = editStatusByHash[editHash];

                      if (editStatus) {
                        const isApplied = editStatus === "applied";
                        return (
                          <div key={i} className="flex gap-2.5 animate-in fade-in-0 duration-300 justify-start">
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg rounded-tl-sm border text-sm ${isApplied
                              ? "bg-success/10 border-success/20 text-success"
                              : "bg-muted border-border text-muted-foreground"
                              }`}>
                              {isApplied ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
                              <span>{isApplied ? historicalEdit.explanation : "Edit dismissed"}</span>
                            </div>
                          </div>
                        );
                      }

                      // If already resolved (Keep/Dismiss pressed) ΓåÆ show done bubble
                      if (resolvedMsgIdxes.has(i)) {
                        return (
                          <div key={i} className="flex gap-2.5 animate-in fade-in-0 duration-300 justify-start">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg rounded-tl-sm bg-success/10 border border-success/20 text-success text-sm">
                              <Check className="size-3.5 shrink-0" />
                              <span>{historicalEdit.explanation}</span>
                            </div>
                          </div>
                        );
                      }

                      const markResolved = () =>
                        setResolvedMsgIdxes(prev => new Set([...prev, i]));

                      return (
                        <div key={i} className="flex gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 justify-start">
                          <div className="flex-1 min-w-0">
                            <SuggestionCard
                              editResponse={historicalEdit}
                              fileContent={currentFileContent}
                              onApply={(edits) => {
                                const editor = editorRef.current;
                                if (editor) {
                                  const affected = applyAiEdits(editor, edits);
                                  if (affected) highlightEditedLines(editor, affected.startLine, affected.endLine);
                                  toast.success("Re-applied edit", { duration: 2000 });
                                }
                                setEditStatusByHash((prev) => ({ ...prev, [editHash]: "applied" }));
                                if (chatId) {
                                  appendChatMessages(chatId, [makeAiEditStatusMessage(editHash, "applied")]).catch(() => { });
                                }
                                markResolved();
                              }}
                              onDismiss={() => {
                                setEditStatusByHash((prev) => ({ ...prev, [editHash]: "dismissed" }));
                                if (chatId) {
                                  appendChatMessages(chatId, [makeAiEditStatusMessage(editHash, "dismissed")]).catch(() => { });
                                }
                                markResolved();
                              }}
                            />
                          </div>
                        </div>
                      );
                    }
                  }
                }

                if (msg.role === "user") {
                  const ctx = normalizeSelectionContext(msg.selectionContext);
                  const rangeLabel = ctx
                    ? ctx.startLine === ctx.endLine
                      ? `L${ctx.startLine}`
                      : `L${ctx.startLine}-${ctx.endLine}`
                    : "";

                  return (
                    <div key={i} className="flex justify-end animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                      <div className="flex max-w-[85%] flex-col items-end gap-2">
                        <div className="bg-muted text-foreground rounded-lg rounded-br-md px-3 py-2 border border-border">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {ctx && (
                          <div className="group relative">
                            <button
                              type="button"
                              onClick={() => jumpToSelectionContext(ctx)}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono text-foreground hover:border-primary transition-colors"
                              title="Jump to selection"
                            >
                              <FileCode2 className="size-3 shrink-0 text-primary/70" />
                              <span className="truncate">{ctx.filename}</span>
                              <span className="shrink-0 text-primary/80">{rangeLabel}</span>
                            </button>
                            {ctx.text && (
                              <div className="absolute bottom-full right-0 mb-2 hidden w-80 max-w-[75vw] group-hover:block z-50">
                                <div className="rounded-lg border border-border bg-popover p-2.5 text-xs font-mono text-muted-foreground">
                                  <div className="mb-1.5 flex items-center gap-1.5">
                                    <FileCode2 className="size-3 text-primary/70 shrink-0" />
                                    <span className="truncate">{ctx.filename}</span>
                                    <span className="ml-auto text-primary/70">{rangeLabel}</span>
                                  </div>
                                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap leading-relaxed">{ctx.text}</pre>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} className={`flex gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 justify-start`}>
                    <div className={`group relative max-w-[92%]`}>
                      {isEditorActionMessage(msg.content) ? (
                        <AssistantMessage
                          content={msg.content}
                          onInsert={handleInsert}
                          onPreview={handlePreview}
                          onApply={handleApplyOp}
                          onApplyDiff={handleApplyDiff}
                          fileContent={currentFileContent}
                        />
                      ) : (
                        <MarkdownAssistantMessage content={msg.content} />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Streaming response */}
              {isStreaming && (
                <div className="flex gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                  <div className="max-w-[92%]">
                    {streamContent ? (
                      isEditorActionMessage(streamContent) ? (
                        <AssistantMessage
                          content={streamContent}
                          isStreaming
                          onInsert={handleInsert}
                          onPreview={handlePreview}
                          onApply={handleApplyOp}
                          onApplyDiff={handleApplyDiff}
                          fileContent={currentFileContent}
                        />
                      ) : (
                        <MarkdownAssistantMessage content={streamContent} isStreaming />
                      )
                    ) : (
                      /* Typing indicator ΓÇö bouncing dots */
                      <div className="flex items-center gap-1 px-1 py-1.5">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="size-1.5 rounded-full bg-primary/50"
                            style={{ animation: "typing-dot 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ΓöÇΓöÇ Compiling preview bar ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */}
        {previewPending && (
          <div className="px-3 py-1.5 border-t border-border bg-secondary/20 flex items-center gap-2 shrink-0">
            <Loader2 className="size-3 animate-spin text-primary/60 shrink-0" />
            <span className="text-xs text-muted-foreground/60">compiling preview…</span>
          </div>
        )}

        {/* ── Input area ─────────────────────────────────────────────────── */}
        <div className="px-3 pb-3 pt-2 border-t border-border shrink-0 relative">

          {/* Selection toolbar */}
          {selectionToolbarContext && (
            <SelectionContextBadge
              context={selectionToolbarContext}
              filename={(activeFilePage ?? currentPage)?.title ?? "main.tex"}
              rangeLabel={selectionToolbarRange}
              wordCount={selectionToolbarWordCount}
              charCount={selectionToolbarCharCount}
              text={selectionToolbarText}
              isPinned={!!pinnedContext}
              onTogglePin={pinnedContext ? () => setPinnedContext(null) : handlePinContext}
            />
          )}

          {/* Slash command menu */}
          <SlashCommandMenu
            open={slashMenuOpen}
            filter={slashFilter}
            onSelect={(c) => {
              setActiveCommand(c);
              setInput("");
              setSlashMenuOpen(false);
              setTimeout(() => textareaRef.current?.focus(), 10);
            }}
          />

          {/* Active command chip */}
          <ActiveCommandChip
            command={activeCommand}
            onRemove={() => setActiveCommand(null)}
          />

          {/* Input card — ChatView rounded-lg style */}
          <div className="relative rounded-lg border border-border bg-background transition-shadow duration-300 focus-within: focus-within:border-primary/30">
            <textarea
              ref={textareaRef}
              value={input}
              aria-label="AI prompt"
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && slashMenuOpen) { setSlashMenuOpen(false); return; }
                if (e.key === "Enter" && !e.shiftKey && !slashMenuOpen) { e.preventDefault(); handleSend(); }
              }}
              placeholder={activeCommand ? `${activeCommand.label}: describe what you need…` : "Ask AI… or type / for commands"}
              rows={1}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm outline-none placeholder:text-muted-foreground/50 max-h-[140px] leading-relaxed"
              disabled={isLoading}
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <span className="text-xs text-muted-foreground/30 font-mono">
                {messages.length > 0 ? `${messages.length} msg` : "new chat"}
              </span>
              <button
                type="button"
                onClick={isStreaming ? () => abortRef.current?.abort() : () => handleSend()}
                disabled={(!input.trim() && !activeCommand && !isStreaming) || isLoading}
                aria-label={isStreaming ? "Stop response" : "Send message"}
                className="size-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                {isStreaming ? <Square className="size-3.5 shrink-0" /> : <ArrowUp className="size-4 shrink-0" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview modal */}
      {previewResult && (
        <PDFPreviewModal
          result={previewResult}
          onClose={() => { setPreviewResult(null); setPreviewSuggestion(""); }}
          onInsert={() => { handleInsert(previewSuggestion); setPreviewResult(null); setPreviewSuggestion(""); }}
        />
      )}

      <ChatHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        workspaceId={workspaceId}
        activeChatId={chatId}
        onSelectChat={handleSelectHistoryChat}
        title="Editor Chat History"
        description="Open previous AI conversations without keeping a second history panel in the editor."
      />
    </>
  );
}

export const ChatAiTab = AiTab;

