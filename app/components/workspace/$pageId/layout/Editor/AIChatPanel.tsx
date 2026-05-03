/**
 * AIChatPanel — Context-aware AI assistant for the LaTeX editor.
 *
 * Features:
 *  - Phase 2: Persistent chat sidebar scoped per page (chat_id = pageId)
 *  - Phase 3: Insert AI suggestion directly into Monaco editor
 *  - Phase 4: Isolated PDF preview for LaTeX code blocks
 *
 * Mount inside EditorLayout alongside the Monaco editor.
 * Toggle visibility via the AI button in ToolBar.
 */

import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  X,
  ArrowUp,
  Square,
  Copy,
  Check,
  ChevronDown,
  FileCode2,
  Eye,
  Download,
  Trash2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useParams } from "react-router";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  getPageChat,
  streamEditorChat,
  appendChatMessages,
  clearPageChat,
  compilePreview,
  type PreviewCompileResult,
} from "~/query/chat-ai";
import type { ChatMessage } from "~/types/chat";
import { renderMarkdown } from "../../ai/layout/renderMarkdown";

// ── LaTeX block detection ─────────────────────────────────────────────────────

/** Extract all ```latex ... ``` blocks from AI response */
function extractLatexBlocks(content: string): string[] {
  const regex = /```(?:latex|tex)\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Rendered markdown with LaTeX block action buttons */
const AssistantMessage = memo(function AssistantMessage({
  content,
  isStreaming = false,
  onInsert,
  onPreview,
}: {
  content: string;
  isStreaming?: boolean;
  onInsert: (latex: string) => void;
  onPreview: (latex: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Custom renderer that adds action buttons on latex code blocks
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let blockKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
      } else {
        inCode = false;
        const isLatex = ["latex", "tex", ""].includes(codeLang.toLowerCase());
        const code = codeLines.join("\n");
        const key = `code-${blockKey++}`;
        elements.push(
          <div key={key} className="my-3 rounded-xl overflow-hidden border border-border/50">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/80 border-b border-border/40">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                {codeLang || "latex"}
              </span>
              {isLatex && !isStreaming && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onPreview(code)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    <Eye className="size-2.5" />
                    Preview
                  </button>
                  <button
                    onClick={() => onInsert(code)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Download className="size-2.5" />
                    Insert
                  </button>
                </div>
              )}
            </div>
            {/* Code */}
            <pre className="px-4 py-3 overflow-x-auto bg-secondary/30 text-xs leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
        codeLines = [];
        codeLang = "";
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    // Render normal markdown line
    if (line.startsWith("# "))
      elements.push(<h2 key={i} className="text-sm font-bold mt-3 mb-1">{line.slice(2)}</h2>);
    else if (line.startsWith("## "))
      elements.push(<h3 key={i} className="text-sm font-semibold mt-2 mb-1">{line.slice(3)}</h3>);
    else if (line.match(/^[-*]\s/))
      elements.push(<div key={i} className="flex gap-2 ml-1 my-0.5"><span className="text-primary/60 shrink-0">•</span><span className="text-xs leading-relaxed">{line.slice(2)}</span></div>);
    else if (line.trim() === "")
      elements.push(<div key={i} className="h-1.5" />);
    else
      elements.push(<p key={i} className="text-xs leading-relaxed">{line}</p>);
  }

  return (
    <div className="group relative">
      <div className="text-sm leading-relaxed space-y-0.5">
        {elements}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
      {!isStreaming && content && (
        <button
          onClick={handleCopy}
          className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-secondary/80 transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
});

/** PDF preview modal */
function PDFPreviewModal({
  result,
  onClose,
  onInsert,
  suggestion,
}: {
  result: PreviewCompileResult;
  onClose: () => void;
  onInsert: () => void;
  suggestion: string;
}) {
  const pdfUrl = result.success
    ? `data:application/pdf;base64,${result.pdf}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-[800px] max-w-[90vw] h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FileCode2 className="size-4 text-amber-500" />
            <span className="text-sm font-semibold">AI Suggestion Preview</span>
            <span className="text-[10px] text-muted-foreground ml-1">
              Isolated compile — does not affect your document
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/80 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {result.success && pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="PDF Preview"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
              <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="size-6 text-destructive" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm mb-1">Compilation failed</p>
                <p className="text-xs text-muted-foreground mb-4">The AI suggestion has LaTeX errors</p>
                <pre className="text-[10px] text-destructive/80 bg-destructive/5 rounded-lg px-3 py-2 max-h-40 overflow-y-auto text-left whitespace-pre-wrap">
                  {result.log.slice(0, 800)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-secondary/80 transition-colors"
          >
            Discard
          </button>
          {result.success && (
            <button
              onClick={onInsert}
              className="px-4 py-2 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Download className="size-3.5" />
              Insert into editor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface AIChatPanelProps {
  /** Monaco editor instance to read content and insert text */
  editorRef: React.MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  /** The filename of the active file (e.g. "main.tex") */
  filename?: string;
  /** Close the panel */
  onClose: () => void;
}

export default function AIChatPanel({ editorRef, filename, onClose }: AIChatPanelProps) {
  const { pageId, workspaceId } = useParams<{ pageId: string; workspaceId: string }>();

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Preview state
  const [previewPending, setPreviewPending] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewCompileResult | null>(null);
  const [previewSuggestion, setPreviewSuggestion] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef("");
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // ── Load per-page chat on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!pageId || !workspaceId) return;
    setIsLoading(true);
    getPageChat(pageId, workspaceId)
      .then((session) => {
        setChatId(session._id);
        setMessages(
          (session.messages ?? []).map(({ role, content }) => ({ role, content }))
        );
      })
      .catch((err) => console.error("[AIChatPanel] Failed to load chat:", err))
      .finally(() => setIsLoading(false));
    return () => {
      abortRef.current?.abort();
    };
  }, [pageId, workspaceId]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // ── Auto-resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // ── Get editor context ──────────────────────────────────────────────────────
  const getEditorContext = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return { fileContent: "", selection: "", cursorContext: "" };

    const model = editor.getModel();
    const fullContent = model?.getValue() ?? "";
    const selectionRange = editor.getSelection();
    const selection = selectionRange ? model?.getValueInRange(selectionRange) ?? "" : "";

    // Get cursor context (±10 lines around cursor)
    const position = editor.getPosition();
    if (position && model) {
      const lineCount = model.getLineCount();
      const start = Math.max(1, position.lineNumber - 10);
      const end = Math.min(lineCount, position.lineNumber + 10);
      const cursorContext = Array.from({ length: end - start + 1 }, (_, i) =>
        model.getLineContent(start + i)
      ).join("\n");
      return { fileContent: fullContent, selection, cursorContext };
    }

    return { fileContent: fullContent, selection, cursorContext: "" };
  }, [editorRef]);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !chatId || !workspaceId) return;

    const { fileContent, selection, cursorContext } = getEditorContext();

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messagesRef.current, userMsg];
    setMessages(newMessages);
    setInput("");
    streamRef.current = "";
    setStreamContent("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const chunk of streamEditorChat(newMessages, {
        chatId,
        workspaceId,
        fileContent,
        filename: filename ?? "main.tex",
        selection,
        cursorContext,
        signal: controller.signal,
      })) {
        streamRef.current += chunk;
        setStreamContent(streamRef.current);
      }

      const finalContent = streamRef.current;
      if (!finalContent) return;

      const assistantMsg: ChatMessage = { role: "assistant", content: finalContent };
      setMessages((prev) => [...prev, assistantMsg]);

      // Persist both messages
      appendChatMessages(chatId, [userMsg, assistantMsg]).catch((err) =>
        console.error("[AIChatPanel] Failed to save messages:", err)
      );
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("[AIChatPanel] Stream error:", err);
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
  }, [input, isStreaming, chatId, workspaceId, getEditorContext, filename]);

  // ── Insert LaTeX into editor ────────────────────────────────────────────────
  const handleInsert = useCallback(
    (latex: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const selection = editor.getSelection();
      const range = selection ?? {
        startLineNumber: editor.getPosition()?.lineNumber ?? 1,
        startColumn: editor.getPosition()?.column ?? 1,
        endLineNumber: editor.getPosition()?.lineNumber ?? 1,
        endColumn: editor.getPosition()?.column ?? 1,
      };
      editor.executeEdits("ai-insert", [
        { range: range as any, text: latex, forceMoveMarkers: true },
      ]);
      editor.focus();
    },
    [editorRef]
  );

  // ── Preview LaTeX ───────────────────────────────────────────────────────────
  const handlePreview = useCallback(
    async (latex: string) => {
      const { fileContent } = getEditorContext();
      setPreviewSuggestion(latex);
      setPreviewPending(true);
      try {
        const result = await compilePreview({
          baseContent: fileContent,
          suggestion: latex,
          sessionId: `${pageId ?? "p"}_${workspaceId ?? "w"}`,
        });
        setPreviewResult(result);
      } catch (err) {
        console.error("[AIChatPanel] Preview compile error:", err);
        setPreviewResult({ pdf: "", success: false, log: String(err) });
      } finally {
        setPreviewPending(false);
      }
    },
    [getEditorContext, pageId, workspaceId]
  );

  // ── Clear history ───────────────────────────────────────────────────────────
  const handleClear = useCallback(async () => {
    if (!pageId) return;
    setMessages([]);
    try {
      await clearPageChat(pageId);
    } catch (err) {
      console.error("[AIChatPanel] Clear error:", err);
    }
  }, [pageId]);

  // ── Quick prompts ───────────────────────────────────────────────────────────
  const quickPrompts = [
    "Improve this paragraph's academic writing style",
    "Fix any LaTeX syntax errors in my selection",
    "Generate a professional table from my data",
    "Add a citation for this claim",
  ];

  return (
    <>
      {/* Panel */}
      <div className="flex flex-col h-full border-l border-border bg-background/95 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg flex items-center justify-center bg-amber-500/10">
              <Sparkles className="size-3.5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold">Flux AI</p>
              <p className="text-[10px] text-muted-foreground">LaTeX Editor Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              title="Clear chat history"
              className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-3">
              <div className="size-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="size-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">Ask AI about your document</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The AI can see your full document. Select text to provide focused context.
                </p>
              </div>
              {/* Quick prompts */}
              <div className="w-full mt-2 space-y-1.5">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); textareaRef.current?.focus(); }}
                    className="w-full text-left text-[11px] px-3 py-2 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 size-6 rounded-lg flex items-center justify-center bg-amber-500/10 mt-0.5">
                      <img src="/Chat.svg" alt="ai" className="size-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[88%] ${
                      msg.role === "user"
                        ? "bg-zinc-100 dark:bg-zinc-700 rounded-2xl rounded-br-md px-3 py-2 text-xs"
                        : ""
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <AssistantMessage
                        content={msg.content}
                        onInsert={handleInsert}
                        onPreview={handlePreview}
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {isStreaming && (streamContent || true) && (
                <div className="flex gap-2 animate-in fade-in-0 duration-200">
                  <div className="shrink-0 size-6 rounded-lg flex items-center justify-center bg-amber-500/10 mt-0.5">
                    <img src="/Chat.svg" alt="ai" className="size-4" />
                  </div>
                  <div className="max-w-[88%]">
                    {streamContent ? (
                      <AssistantMessage
                        content={streamContent}
                        isStreaming
                        onInsert={handleInsert}
                        onPreview={handlePreview}
                      />
                    ) : (
                      <div className="flex gap-1 py-1">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="size-1.5 rounded-full bg-primary/50"
                            style={{
                              animation: "typing-dot 1.4s infinite ease-in-out",
                              animationDelay: `${i * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Preview pending indicator */}
        {previewPending && (
          <div className="px-3 py-2 border-t border-border bg-amber-500/5 flex items-center gap-2 shrink-0">
            <Loader2 className="size-3.5 animate-spin text-amber-500" />
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              Compiling preview…
            </span>
          </div>
        )}

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
          <div className="relative rounded-xl border border-border bg-background focus-within:border-primary/40 focus-within:shadow-sm transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about your LaTeX document… (Select text for context)"
              rows={1}
              className="w-full resize-none bg-transparent px-3 py-2.5 text-xs outline-none placeholder:text-muted-foreground/50 max-h-[160px]"
              disabled={isLoading}
            />
            <div className="flex justify-end px-2 pb-2">
              <button
                onClick={isStreaming ? () => abortRef.current?.abort() : handleSend}
                disabled={(!input.trim() && !isStreaming) || isLoading}
                className="size-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                {isStreaming ? <Square className="size-3" /> : <ArrowUp className="size-3.5" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center mt-1.5">
            Enter to send · Shift+Enter for newline · Chat saved per document
          </p>
        </div>
      </div>

      {/* PDF Preview modal */}
      {previewResult && (
        <PDFPreviewModal
          result={previewResult}
          suggestion={previewSuggestion}
          onClose={() => { setPreviewResult(null); setPreviewSuggestion(""); }}
          onInsert={() => {
            handleInsert(previewSuggestion);
            setPreviewResult(null);
            setPreviewSuggestion("");
          }}
        />
      )}

      {/* Typing keyframe */}
      <style>{`
        @keyframes typing-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </>
  );
}
