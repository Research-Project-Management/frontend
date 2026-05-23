/**
 * ChatAiTab — Full-featured AI assistant in the sidebar.
 * Replaces the old editor-side AIChatPanel.
 * Reads editorRef from PageContext so no prop drilling needed.
 */

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  X, ArrowUp, Square, Copy, Check, FileCode2, Eye, Download,
  Trash2, Loader2, AlertTriangle, Pin, Zap, History,
  Wand2, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router";
import {
  getPageChat, streamEditorChat, appendChatMessages, createChatSession,
  clearPageChat, compilePreview, getChatSession, type PreviewCompileResult,
} from "~/query/chat-ai";
import type { ChatMessage, ChatSession } from "~/types/chat";
import { useWorkspaceActionsStore } from "~/stores/workspace-actions";
import { usePageContext } from "../../PageContext";
import { useCompileStore } from "~/stores/compile";
import { useEditorSettingsStore } from "~/stores/editor-settings";
import {
  buildRichContext,
  parseLatexStructure,
} from "~/lib/latex-utils";
import {
  parseAiEditResponse,
  parseDiffToEdits,
  validateAiEdits,
  isEditSafe,
  applyAiEdits,
  highlightEditedLines,
  previewAiEdits,
  type AiEditPreviewHandle,
  type AiEditResponse,
  type AiEditOperation,
} from "~/lib/ai-edit-types";
import {
  findLatexCommandRange,
  tryLocalCommandEdit,
} from "~/lib/ai-edit-helpers";
import AiEditSuggestionCard from "./AiEditSuggestionCard";
import ChatHistoryModal from "~/components/workspace/ai/layout/ChatHistoryModal";
import { renderMarkdown } from "~/components/workspace/ai/layout/renderMarkdown";

function normalizeSelectionContext(ctx?: ChatMessage["selectionContext"] | null): ChatMessage["selectionContext"] | undefined {
  if (!ctx?.filename || !ctx.startLine || !ctx.endLine || !ctx.text?.trim()) return undefined;
  return ctx;
}

// ── Slash Commands ────────────────────────────────────────────────────────────

interface SlashCommand {
  cmd: string;
  label: string;
  description: string;
  hint: string;
  needsSelection?: boolean;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/fix", label: "Fix errors", description: "Fix LaTeX compile errors", hint: "fix", needsSelection: false },
  { cmd: "/explain", label: "Explain", description: "Explain selected code", hint: "explain", needsSelection: true },
  { cmd: "/refactor", label: "Refactor", description: "Rewrite selection for clarity", hint: "refactor", needsSelection: true },
  { cmd: "/complete", label: "Complete here", description: "Continue writing at cursor", hint: "complete", needsSelection: false },
  { cmd: "/table", label: "Generate table", description: "Create a LaTeX table", hint: "table", needsSelection: false },
  { cmd: "/equation", label: "Equation", description: "Generate a LaTeX equation", hint: "equation", needsSelection: false },
  { cmd: "/cite", label: "Citation", description: "Suggest citation format", hint: "cite", needsSelection: true },
  { cmd: "/section", label: "New section", description: "Generate section structure", hint: "section", needsSelection: false },
  { cmd: "/abstract", label: "Improve abstract", "description": "Rewrite abstract academically", hint: "abstract", needsSelection: true },
  { cmd: "/translate", label: "Translate", description: "Translate selection to English", hint: "translate", needsSelection: true },
];

// ── DiffApplyBlock ─────────────────────────────────────────────────────────────

interface EditOp {
  action: "replace_lines" | "insert_after" | "insert_before" | "delete_lines";
  startLine?: number;
  endLine?: number;
  afterLine?: number;
  beforeLine?: number;
  newContent?: string;
  explanation?: string;
}

function DiffApplyBlock({
  op,
  fileContent,
  onApply,
}: {
  op: EditOp;
  fileContent: string;
  onApply: (op: EditOp) => void;
}) {
  const [applied, setApplied] = useState(false);
  const lines = fileContent.split("\n");

  const oldLines: string[] = [];
  const newLines = (op.newContent ?? "").split("\n");

  if (op.action === "replace_lines" && op.startLine && op.endLine) {
    for (let i = op.startLine - 1; i < Math.min(op.endLine, lines.length); i++) {
      oldLines.push(lines[i]);
    }
  } else if (op.action === "delete_lines" && op.startLine && op.endLine) {
    for (let i = op.startLine - 1; i < Math.min(op.endLine, lines.length); i++) {
      oldLines.push(lines[i]);
    }
  }

  const rangeLabel =
    op.action === "insert_after"
      ? `insert after line ${op.afterLine}`
      : op.action === "insert_before"
        ? `insert before line ${op.beforeLine}`
        : `lines ${op.startLine}–${op.endLine}`;

  return (
    <div className="my-2 rounded-lg border border-border/50 overflow-hidden text-[11px] font-mono">
      <div className="flex items-center justify-between px-2.5 py-1 bg-secondary/60 border-b border-border/40">
        <span className="text-muted-foreground/60">{rangeLabel}</span>
        {!applied && (
          <button
            onClick={() => { onApply(op); setApplied(true); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/90 text-primary-foreground text-[10px] hover:bg-primary transition-colors"
          >
            <Zap className="size-2.5" /> Apply
          </button>
        )}
        {applied && <span className="text-emerald-500 text-[10px]">✓ Applied</span>}
      </div>
      <div className="bg-[#1a1a1a] overflow-x-auto max-h-48">
        {oldLines.map((l, i) => (
          <div key={`d${i}`} className="flex bg-[#2b0d0d] px-0">
            <span className="w-4 text-center text-red-400 shrink-0 border-r border-white/10 mr-2">-</span>
            <span className="text-red-300 line-through opacity-70 py-px pr-4 whitespace-pre">{l}</span>
          </div>
        ))}
        {newLines.map((l, i) => (
          <div key={`a${i}`} className="flex bg-[#0d2b0d] px-0">
            <span className="w-4 text-center text-emerald-400 shrink-0 border-r border-white/10 mr-2">+</span>
            <span className="text-emerald-200 py-px pr-4 whitespace-pre">{l}</span>
          </div>
        ))}
      </div>
      {op.explanation && (
        <div className="px-2.5 py-1 text-[10px] text-muted-foreground/50 border-t border-border/30 bg-secondary/20">
          {op.explanation}
        </div>
      )}
    </div>
  );
}

// ── LaTeX block detection ─────────────────────────────────────────────────────

const AssistantMessage = memo(function AssistantMessage({
  content,
  isStreaming = false,
  onInsert,
  onPreview,
  onApply,
  onApplyDiff,
  fileContent = "",
}: {
  content: string;
  isStreaming?: boolean;
  onInsert: (latex: string) => void;
  onPreview: (latex: string) => void;
  onApply?: (op: EditOp) => void;
  onApplyDiff?: (diffText: string) => void;
  fileContent?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasEditorActionBlock = /```(?:\s*(?:apply|diff|latex|tex)\b|\s*$)/i.test(content);
  if (!hasEditorActionBlock) {
    return (
      <div className="group relative">
        <div className="text-[13px] leading-relaxed space-y-0.5">
          {renderMarkdown(content)}
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
  }

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let blockKey = 0;
  let textLines: string[] = [];

  const flushMarkdown = () => {
    if (textLines.length === 0) return;

    const markdown = textLines.join("\n").trim();
    if (markdown) {
      elements.push(
        <React.Fragment key={`md-${blockKey++}`}>
          {renderMarkdown(markdown)}
        </React.Fragment>,
      );
    }

    textLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (!inCode) {
        flushMarkdown();
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
      } else {
        inCode = false;
        const isDiff = codeLang.toLowerCase() === "diff";
        const isApply = codeLang.toLowerCase() === "apply";
        const isLatex = !isDiff && !isApply && ["latex", "tex", ""].includes(codeLang.toLowerCase());
        const code = codeLines.join("\n");
        const key = `code-${blockKey++}`;

        if (isApply && onApply) {
          try {
            const op: EditOp = JSON.parse(code);
            elements.push(
              <DiffApplyBlock key={key} op={op} fileContent={fileContent} onApply={onApply} />
            );
          } catch {
            elements.push(<pre key={key} className="text-xs bg-secondary/30 rounded p-2 my-1 whitespace-pre-wrap font-mono">{code}</pre>);
          }
          codeLines = []; codeLang = "";
          continue;
        }

        if (isDiff) {
          // ── VSCode-style diff view ──────────────────────────────────────
          elements.push(
            <div key={key} className="my-3 rounded-xl overflow-hidden border border-border/50 font-mono">
              <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/80 border-b border-border/40">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">diff</span>
                {!isStreaming && (
                  <button
                    onClick={() => {
                      // Use full diff text so parseDiffToEdits can locate changes
                      const diffText = codeLines.join("\n");
                      if (onApplyDiff) {
                        onApplyDiff(diffText);
                      } else {
                        // Fallback: extract added lines only
                        const added = codeLines.filter(l => l.startsWith("+") && !l.startsWith("+++")).map(l => l.slice(1)).join("\n");
                        if (added) onInsert(added);
                      }
                    }}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Download className="size-2.5" />
                    Apply diff
                  </button>
                )}
              </div>
              <div className="text-xs leading-relaxed overflow-x-auto bg-[#1e1e1e] dark:bg-[#1a1a1a]">
                {codeLines.map((dl, di) => {
                  const isAdd = dl.startsWith("+") && !dl.startsWith("+++");
                  const isDel = dl.startsWith("-") && !dl.startsWith("---");
                  const isMeta = dl.startsWith("@@") || dl.startsWith("---") || dl.startsWith("+++");
                  return (
                    <div
                      key={di}
                      className={[
                        "flex px-0 min-w-0",
                        isAdd ? "bg-[#0d2b0d] dark:bg-[#1a3a1a]" : "",
                        isDel ? "bg-[#2b0d0d] dark:bg-[#3a1a1a]" : "",
                        isMeta ? "bg-[#0d1a2b] text-blue-400" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {/* gutter */}
                      <span className={[
                        "select-none shrink-0 w-5 text-center text-[10px] border-r border-white/10 mr-2",
                        isAdd ? "text-emerald-400" : isDel ? "text-red-400" : "text-zinc-600",
                      ].join(" ")}>
                        {isAdd ? "+" : isDel ? "−" : " "}
                      </span>
                      <span className={[
                        "py-px pr-4 whitespace-pre font-mono text-[11px]",
                        isAdd ? "text-emerald-200" : isDel ? "text-red-300 line-through opacity-70" : "text-zinc-300",
                        isMeta ? "text-blue-400 no-underline opacity-100" : "",
                      ].filter(Boolean).join(" ")}>
                        {isAdd || isDel ? dl.slice(1) : dl}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        } else {
          // ── Regular code block with line numbers ────────────────────────
          elements.push(
            <div key={key} className="my-3 rounded-xl overflow-hidden border border-border/50">
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
              <div className="flex overflow-x-auto bg-secondary/30 text-xs leading-relaxed">
                {/* Line numbers */}
                <div className="select-none shrink-0 text-right pr-3 py-3 pl-2 text-muted-foreground/40 border-r border-border/30 font-mono text-[10px] leading-relaxed">
                  {codeLines.map((_, li) => (
                    <div key={li}>{li + 1}</div>
                  ))}
                </div>
                <pre className="px-3 py-3 overflow-x-auto flex-1 font-mono text-[11px] leading-relaxed">
                  <code>{code}</code>
                </pre>
              </div>
            </div>
          );
        }
        codeLines = [];
        codeLang = "";
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    textLines.push(line);
  }
  flushMarkdown();

  return (
    <div className="group relative">
      <div className="text-[13px] leading-relaxed space-y-0.5">
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

// ── PDF Preview modal ─────────────────────────────────────────────────────────

function isEditorActionMessage(content: string): boolean {
  return /```(?:\s*(?:apply|diff|latex|tex)\b|\s*$)/i.test(content);
}

type AiEditStatus = "applied" | "dismissed";

const AI_EDIT_STATUS_RE = /^<!-- flux-ai-edit-status:([a-z0-9]+):(applied|dismissed) -->$/;

function hashAiEditContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function makeAiEditStatusMessage(hash: string, status: AiEditStatus): ChatMessage {
  return {
    role: "assistant",
    content: `<!-- flux-ai-edit-status:${hash}:${status} -->`,
  };
}

function parseAiEditStatus(content: string): { hash: string; status: AiEditStatus } | null {
  const match = content.trim().match(AI_EDIT_STATUS_RE);
  if (!match) return null;
  return { hash: match[1], status: match[2] as AiEditStatus };
}

function MarkdownAssistantMessage({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative" data-ai-response-renderer="react-markdown">
      <div className="text-[13px] leading-relaxed space-y-0.5">
        {renderMarkdown(content)}
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
}

function PDFPreviewModal({
  result,
  onClose,
  onInsert,
}: {
  result: PreviewCompileResult;
  onClose: () => void;
  onInsert: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!result.success || !result.pdf) { setBlobUrl(null); return; }
    const bytes = Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result.pdf, result.success]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-[820px] max-w-[92vw] h-[82vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FileCode2 className="size-4 text-amber-500" />
            <span className="text-sm font-semibold">AI Suggestion Preview</span>
            <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full ml-1">
              Isolated — does not affect your document
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/80 transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex">
          {result.success && blobUrl ? (
            <object data={blobUrl} type="application/pdf" className="w-full h-full">
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <p className="text-sm">PDF viewer unavailable.</p>
                <a href={blobUrl} download="preview.pdf" className="text-xs text-primary underline">Download PDF</a>
              </div>
            </object>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
              <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="size-6 text-destructive" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm mb-1">Compilation failed</p>
                <p className="text-xs text-muted-foreground mb-4">The AI suggestion contains LaTeX errors</p>
                <pre className="text-[10px] text-destructive/80 bg-destructive/5 rounded-lg px-3 py-2 max-h-48 overflow-y-auto text-left whitespace-pre-wrap border border-destructive/20">
                  {result.log.slice(0, 1200)}
                </pre>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-secondary/80 transition-colors">
            Discard
          </button>
          {result.success && (
            <button onClick={onInsert} className="px-4 py-2 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2">
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

export default function ChatAiTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const { editorRef, currentPage, workspaceId, activeFilePage, isAiPreviewingRef, compileRef } = usePageContext();
  const { pendingAiText, setPendingAiText, pendingAiContext, clearPendingAiContext } = useWorkspaceActionsStore();
  const { compileErrors, compileStatus } = useCompileStore();
  const { autoCompile } = useEditorSettingsStore();

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

  // Live selection context — updated real-time from Monaco listener
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

  // Structured JSON edit preview — shown before applying
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

  // Save last known Monaco cursor position — restored for insert after button click steals focus
  const lastCursorRef = useRef<{ lineNumber: number; column: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef("");
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Load per-page chat — re-runs whenever workspaceId becomes available
  useEffect(() => {
    if (!pageId || !workspaceId) return;
    setIsLoading(true);
    // NOTE: keep existing messages visible while re-fetching so the UI never
    // shows a full-page spinner on top of a chat the user has already seen.
    getPageChat(pageId, workspaceId)
      .then((session) => {
        setChatId(session._id);
        setMessages(
          (session.messages ?? []).map(({ role, content, selectionContext }) => ({
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

  // Build rich editor context — uses activeFilePage for filename
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

  // Parse all ```apply blocks from a response string and return EditOp[]
  const parseApplyBlocks = useCallback((content: string): EditOp[] => {
    const ops: EditOp[] = [];
    const lines = content.split("\n");
    let inApply = false;
    let applyLines: string[] = [];
    for (const line of lines) {
      if (line.trim() === "```apply") { inApply = true; applyLines = []; continue; }
      if (inApply && line.trim() === "```") {
        try { ops.push(JSON.parse(applyLines.join("\n"))); } catch { /* ignore malformed */ }
        inApply = false; applyLines = [];
        continue;
      }
      if (inApply) applyLines.push(line);
    }
    return ops;
  }, []);

  // Slash commands that are explanation-only (no JSON edit response expected)
  const EXPLANATION_ONLY_COMMANDS = ["/explain", "/cite", "/translate"];

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
      const idx = prev.findLastIndex(m => m.role === "assistant" && !parseAiEditStatus(m.content));
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

  // Send message — passes full rich context to AI
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

    // Use liveSelection (captured before textarea focus) — getRichContext reads Monaco
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

    // ── Local command detection — bypass AI for simple requests ────────────
    // e.g. "sửa title thành Hello Demo 123", "change author to John"
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

      // /explain → add annotation decoration
      if (cmd?.cmd === "/explain" && effectiveSelection && effectiveStartLine && effectiveEndLine) {
        setAnnotations((prev) => [
          ...prev,
          { id: Date.now().toString(), startLine: effectiveStartLine, endLine: effectiveEndLine, text: finalContent.slice(0, 300) },
        ]);
      }

      // ── Structured JSON + diff/code multi-block parsing ─────────────────────
      if (!isExplanationCmd) {
        // Read live from Monaco model — most up-to-date, avoids stale React state
        const fileContent =
          editor?.getModel()?.getValue() ??
          richCtx?.fileContent ??
          currentFileContent;
        const editResponse = parseAiEditResponse(finalContent, fileContent);
        if (editResponse && editResponse.intent !== "no_change" && editResponse.edits.length > 0) {
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
            safetyWarning = `⚠️ This edit affects ${Math.round(validation.replacementRatio * 100)}% of your file. Review carefully before applying.`;
          }

          if (autoApply && !safetyWarning) {
            applyAiEdits(editor, editResponse.edits);
            toast.success(`⚡ Auto-applied ${editResponse.edits.length} edit${editResponse.edits.length > 1 ? "s" : ""} to editor`, { duration: 3500 });
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

      // ── Legacy auto-apply (apply-blocks) ─────────────────────────────────
      if (autoApply) {
        const ops = parseApplyBlocks(finalContent);
        if (ops.length > 0) {
          ops.forEach((op) => handleApplyOp(op));
          toast.success(`⚡ Auto-applied ${ops.length} change${ops.length > 1 ? "s" : ""} to editor`, { duration: 3000 });
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
  }, [input, isStreaming, chatId, workspaceId, pendingEditResponse, getRichContext, activeFilePage, currentPage, activeCommand, compileErrors, pinnedContext, autoApply, parseApplyBlocks, handleApplyOp, editorRef, currentFileContent, clearPendingEdit]);

  // ── Auto-preview: whenever a pending edit is set, show it in the editor immediately ──
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!pendingEditResponse || pendingEditResponse.edits.length === 0) {
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

  // Apply: edits are already in the editor (from preview) — just confirm them
  const handleApplyStructuredEdits = useCallback((_edits: AiEditOperation[]) => {
    const editor = editorRef.current;
    if (!editor) return;

    const handle = previewHandleRef.current;
    if (handle) {
      // Edits already in model from preview — just confirm with undo stop + clear decorations
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
    replaceLastAssistantSummary(`✓ ${explanation}`);
    toast.success(`✓ Edit applied`, { duration: 2000 });
    // Auto-compile after AI edit if enabled — delay to allow save to flush
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

  // Regenerate — dismiss current edit response and re-send last prompt
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

  // Insert LaTeX into editor — converts to a preview-based edit so user sees Accept/Dismiss
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

    // 1. Single known command (\title, \author etc.) → replace existing occurrence
    const cmdMatch = trimmed.match(/^\\([a-zA-Z]+)\s*\{/);
    if (cmdMatch) {
      const commandName = cmdMatch[1];
      const existingRange = findLatexCommandRange(content, commandName);
      if (existingRange) {
        // Show as a structured preview with Accept / Dismiss
        const editResponse: AiEditResponse = {
          intent: "replace_range",
          explanation: `Replace \\${commandName}{…}`,
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

    // 2. Has live selection → replace it
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

  // Apply diff block — uses parseDiffToEdits to locate changes in the file
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
      : `L${liveSelection.startLine}–${liveSelection.endLine}`;
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

  // Handle input changes — detect slash commands
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
      setChatId(session._id);
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
      const session = await getChatSession(chat._id);
      setChatId(session._id);
      setMessages(
        (session.messages ?? []).map(({ role, content, sources, selectionContext }) => ({
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

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex items-center gap-2">
            <img src="/Chat.svg" alt="Flux AI" className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flux AI</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleNewConversation}
              disabled={!workspaceId || isStreaming}
              title="New conversation"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
            >
              <Plus className="size-3.5" />
            </button>
            {/* Auto Apply toggle */}
            <button
              onClick={() => setAutoApply((v) => !v)}
              title={autoApply ? "Auto Apply ON — click to disable" : "Auto Apply OFF — click to enable"}
              className={[
                "flex h-8 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition-all",
                autoApply
                  ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25"
                  : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60",
              ].join(" ")}
            >
              <Wand2 className="size-3" />
              <span className="hidden sm:inline">Auto</span>
            </button>

            <button
              onClick={() => setHistoryOpen(true)}
              disabled={!workspaceId}
              title="Show chat history"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
            >
              <History className="size-3.5" />
            </button>

            {showClearConfirm ? (
              <div className="flex h-8 items-center gap-0.5 rounded-md border border-destructive/20 bg-destructive/10 px-1">
                <button
                  onClick={handleClear}
                  title="Confirm clear chat"
                  className="flex size-6 items-center justify-center rounded text-destructive hover:bg-destructive/15 transition-colors"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  title="Cancel"
                  className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => messages.length > 0 && setShowClearConfirm(true)}
                disabled={messages.length === 0}
                title="Clear chat"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-20"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Toast notifications now via sonner — see toast() calls above */}

        {/* ── File context bar ──────────────────────────────────────────── */}
        {/* ── Compile error banner ──────────────────────────────────────── */}
        {compileStatus === "error" && compileErrors.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/8 border-b border-destructive/15 shrink-0">
            <AlertTriangle className="size-3 text-destructive shrink-0" />
            <span className="text-[10px] text-destructive/80 truncate flex-1">{compileErrors[0].message}</span>
            <button
              onClick={() => {
                const cmd = SLASH_COMMANDS.find(c => c.cmd === "/fix")!;
                setActiveCommand(cmd);
                handleSend(`Fix the LaTeX compile error: ${compileErrors[0].message}`, cmd);
              }}
              className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-destructive text-white hover:bg-destructive/90 transition-colors font-medium"
            >
              Fix with AI
            </button>
          </div>
        )}

        {/* Slim loading bar at top — replaces full-area spinner */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 z-10 h-0.5 overflow-hidden">
            <div className="h-full bg-primary/50 animate-pulse" style={{ width: "60%", margin: "0 auto" }} />
          </div>
        )}

        {/* ── Messages ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !isStreaming && !isLoading ? (
            /* ── Welcome screen ── */
            <div className="h-full flex flex-col items-center justify-center px-4 gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex group flex-col items-center">
                  <img src="/Chat.svg" alt="Flux AI" className="size-10 mb-2 group-hover:rotate-180 transition-transform duration-1000" />
                  <p className="text-sm font-semibold">Flux AI Editor</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">Your LaTeX co-pilot. Select code, then ask.</p>
                </div>
              </div>
              <div className="w-full space-y-1.5">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); textareaRef.current?.focus(); }}
                    className="w-full text-left text-[11px] px-3 py-2 rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group"
                  >
                    <span className="text-primary/40 group-hover:text-primary transition-colors shrink-0">›</span>
                    <span className="truncate">{p}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/30 text-center">Type <kbd className="px-1 py-px rounded bg-secondary/60 font-mono text-[9px]">/</kbd> for editor commands</p>
            </div>
          ) : (
            /* ── Chat messages ── */
            <div className="px-3 py-4 space-y-4">
              {messages.map((msg, i) => {
                if (msg.role === "assistant" && parseAiEditStatus(msg.content)) {
                  return null;
                }
                // If this is the last assistant msg with a pending edit → render it as the suggestion card (IS the message bubble)
                const isLastAssistantMsg =
                  msg.role === "assistant" && i === messages.length - 1;
                const isPendingEdit =
                  isLastAssistantMsg &&
                  pendingEditResponse !== null &&
                  !isStreaming;

                if (isPendingEdit) {
                  return (
                    <div key={i} className="flex gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 justify-start">
                      <div className="flex-1 min-w-0">
                        <AiEditSuggestionCard
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
                    if (parsed && typeof parsed.intent === "string" && typeof parsed.explanation === "string") {
                      const historicalEdit = parsed as AiEditResponse;
                      const editHash = hashAiEditContent(msg.content);
                      const editStatus = editStatusByHash[editHash];

                      if (editStatus) {
                        const isApplied = editStatus === "applied";
                        return (
                          <div key={i} className="flex gap-2.5 animate-in fade-in-0 duration-300 justify-start">
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl rounded-tl-sm border text-[13px] ${isApplied
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted/50 border-border/50 text-muted-foreground"
                              }`}>
                              {isApplied ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
                              <span>{isApplied ? historicalEdit.explanation : "Edit dismissed"}</span>
                            </div>
                          </div>
                        );
                      }

                      // If already resolved (Keep/Dismiss pressed) → show done bubble
                      if (resolvedMsgIdxes.has(i)) {
                        return (
                          <div key={i} className="flex gap-2.5 animate-in fade-in-0 duration-300 justify-start">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl rounded-tl-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[13px]">
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
                            <AiEditSuggestionCard
                              editResponse={historicalEdit}
                              fileContent={currentFileContent}
                              onApply={(edits) => {
                                const editor = editorRef.current;
                                if (editor) {
                                  const affected = applyAiEdits(editor, edits);
                                  if (affected) highlightEditedLines(editor, affected.startLine, affected.endLine);
                                  toast.success("✓ Re-applied edit", { duration: 2000 });
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
                        <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-br-md px-3 py-2 border border-zinc-200 dark:border-zinc-700">
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {ctx && (
                          <div className="group relative">
                            <button
                              type="button"
                              onClick={() => jumpToSelectionContext(ctx)}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground shadow-sm hover:border-primary/40 hover:text-foreground transition-colors"
                              title="Jump to selection"
                            >
                              <FileCode2 className="size-3 shrink-0 text-primary/70" />
                              <span className="truncate">{ctx.filename}</span>
                              <span className="shrink-0 text-primary/80">{rangeLabel}</span>
                            </button>
                            {ctx.text && (
                              <div className="absolute bottom-full right-0 mb-2 hidden w-80 max-w-[75vw] group-hover:block z-50">
                                <div className="rounded-xl border border-border bg-popover p-2.5 text-[10px] font-mono text-muted-foreground shadow-xl">
                                  <div className="mb-1.5 flex items-center gap-1.5">
                                    <FileCode2 className="size-3 text-primary/70" />
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
                  <div key={i} className={`flex gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`group relative ${msg.role === "user"
                      ? "max-w-[85%] bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-br-md px-3 py-2 border border-zinc-200 dark:border-zinc-700"
                      : "max-w-[92%]"
                      }`}>
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
                      /* Typing indicator — bouncing dots */
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

        {/* ── Compiling preview bar ─────────────────────────────────────── */}
        {previewPending && (
          <div className="px-3 py-1.5 border-t border-border/40 bg-secondary/20 flex items-center gap-2 shrink-0">
            <Loader2 className="size-3 animate-spin text-primary/60" />
            <span className="text-[10px] text-muted-foreground/60">compiling preview…</span>
          </div>
        )}

        {/* ── Input area ───────────────────────────────────────────────── */}
        <div className="px-3 pb-3 pt-2 border-t border-border/40 shrink-0 relative">

          {/* Selection toolbar */}
          {selectionToolbarContext && (
            <div className="mb-2 group relative">
              <div className="flex items-center gap-1.5 min-w-0 px-2.5 py-1.5 rounded-lg border border-border/50 bg-muted/35">
                <FileCode2 className="size-3 text-primary/60 shrink-0" />
                <span className="text-[10px] font-mono text-muted-foreground truncate">
                  {(activeFilePage ?? currentPage)?.title ?? "main.tex"}
                </span>
                <span className="text-[10px] font-mono text-primary/80 shrink-0">
                  {selectionToolbarRange}
                </span>
                <span className="text-[9px] text-muted-foreground/45 shrink-0">
                  {selectionToolbarWordCount}w
                </span>
                <button
                  onClick={pinnedContext ? () => setPinnedContext(null) : handlePinContext}
                  title={pinnedContext ? "Clear selection context" : "Pin selection context"}
                  className="ml-auto p-px rounded text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  {pinnedContext ? <X className="size-2.5" /> : <Pin className="size-2.5" />}
                </button>
              </div>
              <div className="absolute bottom-full left-0 right-0 mb-1 hidden group-hover:block z-50 pointer-events-none">
                <div className="bg-popover border border-border rounded-xl shadow-xl p-2.5 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {"section" in selectionToolbarContext && selectionToolbarContext.section && (
                      <span className="px-1.5 py-px rounded-full bg-violet-500/10 text-violet-400/80 border border-violet-500/20">
                        {selectionToolbarContext.section}
                      </span>
                    )}
                    {"environment" in selectionToolbarContext && selectionToolbarContext.environment && (
                      <span className="px-1.5 py-px rounded-full bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">
                        \{selectionToolbarContext.environment}
                      </span>
                    )}
                    <span className="ml-auto text-muted-foreground/40">{selectionToolbarCharCount}ch</span>
                  </div>
                  <pre className="text-muted-foreground/70 max-h-28 overflow-auto whitespace-pre-wrap leading-relaxed">
                    {selectionToolbarText}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Slash command menu */}
          {slashMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-2 border-b border-border/40">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Editor Commands</p>
              </div>
              {SLASH_COMMANDS
                .filter(c => c.cmd.slice(1).startsWith(slashFilter))
                .map((c) => (
                  <button
                    key={c.cmd}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setActiveCommand(c);
                      setInput("");
                      setSlashMenuOpen(false);
                      setTimeout(() => textareaRef.current?.focus(), 10);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent/60 text-left transition-colors"
                  >
                    <span className="text-[10px] font-mono text-primary w-20 shrink-0">{c.cmd}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{c.description}</span>
                  </button>
                ))
              }
            </div>
          )}

          {/* Active command chip */}
          {activeCommand && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Zap className="size-2.5" />{activeCommand.cmd}
              </span>
              <span className="text-[10px] text-muted-foreground/50">{activeCommand.description}</span>
              <button onClick={() => setActiveCommand(null)} className="ml-auto text-muted-foreground/40 hover:text-foreground">
                <X className="size-2.5" />
              </button>
            </div>
          )}

          {/* Input card — ChatView rounded-2xl style */}
          <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-shadow duration-300 focus-within:shadow-md focus-within:border-primary/30">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && slashMenuOpen) { setSlashMenuOpen(false); return; }
                if (e.key === "Enter" && !e.shiftKey && !slashMenuOpen) { e.preventDefault(); handleSend(); }
              }}
              placeholder={activeCommand ? `${activeCommand.label}: describe what you need…` : "Ask Flux AI… or type / for commands"}
              rows={1}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm outline-none placeholder:text-muted-foreground/50 max-h-[140px] leading-relaxed"
              disabled={isLoading}
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <span className="text-[10px] text-muted-foreground/30 font-mono">
                {messages.length > 0 ? `${messages.length} msg` : "new chat"}
              </span>
              <button
                onClick={isStreaming ? () => abortRef.current?.abort() : () => handleSend()}
                disabled={(!input.trim() && !activeCommand && !isStreaming) || isLoading}
                className="size-8 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                {isStreaming ? <Square className="size-3.5" /> : <ArrowUp className="size-4" />}
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

      <ChatHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        workspaceId={workspaceId}
        activeChatId={chatId}
        onSelectChat={handleSelectHistoryChat}
        title="Editor Chat History"
        description="Open previous Flux AI conversations without keeping a second history panel in the editor."
      />
    </>
  );
}
