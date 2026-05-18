/**
 * useAiChat.ts
 *
 * Manages AI chat session state and streaming for the LaTeX editor.
 *
 * Single sendMessage() entry point — used by both:
 *   - Manual textarea sends
 *   - Sends with selectionOverride from a toolbar-bound editor selection
 *
 * Returns everything the UI needs: messages, streaming state, send/abort/clear.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router";
import type { ChatMessage } from "~/types/chat";
import {
  getPageChat,
  streamEditorChat,
  appendChatMessages,
  clearPageChat,
} from "~/query/chat-ai";
import { parseLatexStructure } from "~/lib/latex-utils";
import { buildRichContext } from "~/lib/latex-utils";
import { tryLocalCommandEdit } from "~/lib/ai-edit-engine";
import { parseAiResponse } from "~/lib/ai-response-parser";
import type { ParsedAiResponse } from "~/lib/ai-response-parser";
import type { SlashCommand } from "./useAiChat.types";
import { useCompileStore } from "~/stores/compile";

export type { SlashCommand };

// ─────────────────────────────────────────────────────────────────────────────
// Slash commands definition
// ─────────────────────────────────────────────────────────────────────────────

export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/fix",       label: "Fix errors",        description: "Fix LaTeX compile errors",       hint: "fix",       needsSelection: false },
  { cmd: "/explain",   label: "Explain",            description: "Explain selected code",          hint: "explain",   needsSelection: true  },
  { cmd: "/refactor",  label: "Refactor",           description: "Rewrite selection for clarity",  hint: "refactor",  needsSelection: true  },
  { cmd: "/complete",  label: "Complete here",      description: "Continue writing at cursor",     hint: "complete",  needsSelection: false },
  { cmd: "/table",     label: "Generate table",     description: "Create a LaTeX table",           hint: "table",     needsSelection: false },
  { cmd: "/equation",  label: "Equation",           description: "Generate a LaTeX equation",      hint: "equation",  needsSelection: false },
  { cmd: "/cite",      label: "Citation",           description: "Suggest citation format",        hint: "cite",      needsSelection: true  },
  { cmd: "/section",   label: "New section",        description: "Generate section structure",     hint: "section",   needsSelection: false },
  { cmd: "/abstract",  label: "Improve abstract",   description: "Rewrite abstract academically",  hint: "abstract",  needsSelection: true  },
  { cmd: "/translate", label: "Translate",          description: "Translate selection to English", hint: "translate", needsSelection: true  },
];

const EXPLANATION_ONLY = new Set(["/explain", "/cite", "/translate"]);

// ─────────────────────────────────────────────────────────────────────────────
// Hook options
// ─────────────────────────────────────────────────────────────────────────────

export interface SendMessageOptions {
  text: string;
  command?: SlashCommand | null;
  /** Override the live selection context (e.g. from pendingAiContext) */
  selectionOverride?: {
    text: string;
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
  } | null;
}

interface UseAiChatOptions {
  workspaceId: string | null | undefined;
  editorRef: React.MutableRefObject<any | null>;
  activeFilename: string;
  /** Called when a streaming response completes and was parseable as edits */
  onParsedResponse?: (parsed: ParsedAiResponse, userMsg: ChatMessage) => void;
  /** Called when a streaming response completes with no structured edits */
  onPlainResponse?: (content: string, userMsg: ChatMessage) => void;
  compileErrors?: Array<{ line: number | null; message: string; context: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAiChat({
  workspaceId,
  editorRef,
  activeFilename,
  onParsedResponse,
  onPlainResponse,
  compileErrors = [],
}: UseAiChatOptions) {
  const { pageId } = useParams<{ pageId: string }>();

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const streamRef = useRef("");
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>("");
  const lastCmdRef = useRef<SlashCommand | null>(null);

  // ── Load per-page chat session ─────────────────────────────────────────────
  useEffect(() => {
    if (!pageId || !workspaceId) return;
    setIsLoading(true);
    getPageChat(pageId, workspaceId)
      .then((session) => {
        setChatId(session._id);
        setMessages((session.messages ?? []).map(({ role, content }) => ({ role, content })));
      })
      .catch((err) => console.error("[useAiChat] load chat:", err))
      .finally(() => setIsLoading(false));
    return () => { abortRef.current?.abort(); };
  }, [pageId, workspaceId]);

  // ── Core stream executor (shared by sendMessage + auto-send) ───────────────
  const _stream = useCallback(
    async (
      userMsg: ChatMessage,
      messageHistory: ChatMessage[],
      opts: {
        fileContent: string;
        selection: string;
        selectionStartLine?: number;
        selectionEndLine?: number;
        selectionStartColumn?: number;
        selectionEndColumn?: number;
        contextBefore?: string;
        contextAfter?: string;
        currentSection?: string | null;
        currentEnvironment?: string | null;
        documentStructureSummary?: string;
        cursorLine?: number;
        cursorColumn?: number;
        commandHint?: string;
        cursorContext?: string;
        isExplanationOnly: boolean;
      },
    ) => {
      if (!chatId || !workspaceId) return;

      setMessages([...messageHistory]);
      streamRef.current = "";
      setStreamContent("");
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const chunk of streamEditorChat(messageHistory, {
          chatId,
          workspaceId,
          fileContent: opts.fileContent,
          filename: activeFilename,
          selection: opts.selection,
          cursorContext: opts.cursorContext ?? "",
          selectionStartLine: opts.selectionStartLine,
          selectionEndLine: opts.selectionEndLine,
          selectionStartColumn: opts.selectionStartColumn,
          selectionEndColumn: opts.selectionEndColumn,
          contextBefore: opts.contextBefore,
          contextAfter: opts.contextAfter,
          currentSection: opts.currentSection,
          currentEnvironment: opts.currentEnvironment,
          documentStructureSummary: opts.documentStructureSummary,
          compileErrors: opts.isExplanationOnly ? [] : compileErrors,
          commandHint: opts.commandHint,
          cursorLine: opts.cursorLine,
          cursorColumn: opts.cursorColumn,
          signal: controller.signal,
        })) {
          streamRef.current += chunk;
          setStreamContent(streamRef.current);
        }

        const finalContent = streamRef.current;
        if (!finalContent) return;

        const assistantMsg: ChatMessage = { role: "assistant", content: finalContent };

        if (!opts.isExplanationOnly) {
          const parsed = parseAiResponse(finalContent, opts.fileContent);
          if (parsed.hasEdits) {
            onParsedResponse?.(parsed, userMsg);
            setMessages((prev) => [...prev, assistantMsg]);
            appendChatMessages(chatId, [userMsg, assistantMsg]).catch(() => {});
            return;
          }
        }

        // Plain response (explanation-only or no parseable edits)
        setMessages((prev) => [...prev, assistantMsg]);
        appendChatMessages(chatId, [userMsg, assistantMsg]).catch(() => {});
        onPlainResponse?.(finalContent, userMsg);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "An error occurred. Please try again." },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setStreamContent("");
        streamRef.current = "";
        abortRef.current = null;
      }
    },
    [chatId, workspaceId, activeFilename, compileErrors, onParsedResponse, onPlainResponse],
  );

  // ── sendMessage — main entry point ─────────────────────────────────────────
  const sendMessage = useCallback(
    async ({ text, command, selectionOverride }: SendMessageOptions) => {
      if (!text.trim() || isStreaming || !chatId || !workspaceId) return;

      lastPromptRef.current = text;
      lastCmdRef.current = command ?? null;

      // Gather editor context
      const editor = editorRef.current;
      const model = editor?.getModel();
      const fileContent = model?.getValue() ?? "";
      const cursorPos = editor?.getPosition();
      const monacoSel = editor?.getSelection();

      const filename = activeFilename;
      const richCtx = editor ? buildRichContext(editor, filename) : null;

      // Resolve effective selection (prefer override, then live Monaco sel)
      const sel = selectionOverride ?? (richCtx?.hasSelection ? {
        text: richCtx.selectedText,
        startLine: richCtx.startLine,
        endLine: richCtx.endLine,
        startColumn: richCtx.startCol,
        endColumn: richCtx.endCol,
      } : null);

      const isExplanationOnly = !!(command && EXPLANATION_ONLY.has(command.cmd));

      // Build document structure summary
      const structure = parseLatexStructure(fileContent);
      const structureSummary = `Sections: ${structure.sections.map((s) => s.title).join(", ") || "none"} | Packages: ${structure.packages.slice(0, 8).join(", ")} | Labels: ${structure.labels.slice(0, 10).join(", ")}`;

      const finalText = text;

      // ── Try local command resolution (no AI call) ──────────────────────────
      if (!isExplanationOnly) {
        const localEdit = tryLocalCommandEdit(fileContent, finalText);
        if (localEdit) {
          const userMsg: ChatMessage = { role: "user", content: finalText };
          setMessages((prev) => [...prev, userMsg]);
          appendChatMessages(chatId, [userMsg]).catch(() => {});
          onParsedResponse?.(
            {
              intent: "replace_range",
              explanation: localEdit.explanation,
              edits: [localEdit.op],
              hasEdits: true,
              codeBlocks: [],
              safetyWarning: null,
            },
            userMsg,
          );
          return;
        }
      }

      const userMsg: ChatMessage = { role: "user", content: finalText };
      const newHistory = [...messagesRef.current, userMsg];

      await _stream(userMsg, newHistory, {
        fileContent,
        selection: sel?.text ?? "",
        selectionStartLine: sel?.startLine,
        selectionEndLine: sel?.endLine,
        selectionStartColumn: sel?.startColumn,
        selectionEndColumn: sel?.endColumn,
        contextBefore: richCtx?.contextBefore,
        contextAfter: richCtx?.contextAfter,
        currentSection: richCtx?.currentSection,
        currentEnvironment: richCtx?.currentEnvironment,
        documentStructureSummary: structureSummary,
        cursorLine: cursorPos?.lineNumber,
        cursorColumn: cursorPos?.column,
        commandHint: command?.hint,
        cursorContext: richCtx?.cursorContext,
        isExplanationOnly,
      });
    },
    [isStreaming, chatId, workspaceId, editorRef, activeFilename, _stream, onParsedResponse],
  );

  // ── Regenerate last message ────────────────────────────────────────────────
  const regenerate = useCallback(() => {
    const prompt = lastPromptRef.current;
    const cmd = lastCmdRef.current;
    if (prompt) sendMessage({ text: prompt, command: cmd });
  }, [sendMessage]);

  // ── Abort streaming ────────────────────────────────────────────────────────
  const abortStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── Clear history ──────────────────────────────────────────────────────────
  const clearHistory = useCallback(async () => {
    if (!pageId) return;
    setMessages([]);
    try { await clearPageChat(pageId); }
    catch (err) { console.error("[useAiChat] clear:", err); }
  }, [pageId]);

  return {
    chatId,
    messages,
    setMessages,
    isStreaming,
    streamContent,
    isLoading,
    sendMessage,
    regenerate,
    abortStream,
    clearHistory,
  };
}
