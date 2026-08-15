import type {
  ChatMessage,
  ChatSession,
  ChatSessionDetail,
  SourceItem,
  AgentAction,
} from "../types/ai.types";
import { API_BASE_URL as API_URL } from "@/shared/constants";

/**
 * Stream chat responses from the AI backend via RPM-BE proxy.
 *
 * Flow: Frontend → RPM-BE (/api/ai/chat) → ai (/chat) → SSE stream
 */
export async function* streamChatResponse(
  messages: ChatMessage[],
  options?: {
    projectId?: string;
    documentIds?: string[];
    intentHint?: string;
    webSearchSites?: string[];
    workspaceId?: string;
    selection?: string;
    cursorContext?: string;
    /** Chat session ID — scopes RAG retrieval to this session only */
    chatId?: string;
    onMeta?: (meta: {
      agent: string;
      intent: string;
      sources?: SourceItem[];
    }) => void;
    onAction?: (action: AgentAction) => void;
    signal?: AbortSignal;
  },
): AsyncGenerator<string, void, unknown> {
  const aiMessages = messages.map(({ role, content }) => ({ role, content }));
  const response = await fetch(`${API_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    credentials: "include",
    body: JSON.stringify({
      messages: aiMessages,
      project_id: options?.projectId,
      document_ids: options?.documentIds,
      intent_hint: options?.intentHint,
      web_search_sites: options?.webSearchSites ?? null,
      workspace_id: options?.workspaceId ?? null,
      selection: options?.selection ?? null,
      cursor_context: options?.cursorContext ?? null,
      // RAG isolation — scopes retrieval to this chat session only
      chat_id: options?.chatId ?? null,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          if (data.startsWith("[META]")) {
            try {
              const meta = JSON.parse(data.slice(6));
              options?.onMeta?.(meta);
            } catch {}
            continue;
          }
          if (data.startsWith("[ACTION]")) {
            try {
              const action: AgentAction = JSON.parse(data.slice(8));
              options?.onAction?.(action);
            } catch {}
            continue;
          }
          // Unescape newlines that were escaped for SSE transport
          yield data.replace(/\\n/g, "\n");
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Non-streaming chat — returns full response at once.
 */
export async function chatSync(
  messages: ChatMessage[],
  options?: {
    projectId?: string;
    documentIds?: string[];
    intentHint?: string;
  },
): Promise<Result<ChatSyncResponse>> {
  try {
    const aiMessages = messages.map(({ role, content }) => ({ role, content }));
    const response = await fetch(`${API_URL}/api/ai/chat/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        messages: aiMessages,
        project_id: options?.projectId,
        document_ids: options?.documentIds,
        intent_hint: options?.intentHint,
      }),
    });

    if (!response.ok) return { success: false, error: `AI sync request failed: ${response.status}` };
    const data = await response.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "AI sync request failed" };
  }
}



// Types
export interface ChatSyncResponse {
  output: {
    agent_name: string;
    content: string;
    sources: Array<{ source: string; score: number }>;
    metadata: Record<string, unknown>;
  };
  intent: string;
}

// ── Chat History API ─────────────────────────────────────────────────────────

import type { Result } from "../types/library.types";

/** List all chat sessions for a workspace (sidebar data). */
export async function listChatSessions(
  workspaceId: string,
): Promise<Result<ChatSession[]>> {
  try {
    const res = await fetch(
      `${API_URL}/api/ai/chats?workspaceId=${encodeURIComponent(workspaceId)}`,
      { credentials: "include" },
    );
    if (!res.ok) return { success: false, error: `Failed to list chats: ${res.status}` };
    const data = await res.json();
    return { success: true, data: data.chats };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to list chats" };
  }
}

/** Create a new chat session, optionally with initial messages already included. */
export async function createChatSession(opts: {
  workspaceId: string;
  title?: string;
  projectId?: string;
  messages?: ChatMessage[];
  documentIds?: string[];
}): Promise<Result<ChatSessionDetail>> {
  try {
    const res = await fetch(`${API_URL}/api/ai/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        workspaceId: opts.workspaceId,
        title: opts.title,
        projectId: opts.projectId ?? null,
        messages: opts.messages ?? [],
        documentIds: opts.documentIds ?? [],
      }),
    });
    if (!res.ok) return { success: false, error: `Failed to create chat: ${res.status}` };
    const data = await res.json();
    return { success: true, data: data.chat };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create chat" };
  }
}

/** Fetch a specific chat session with all messages. */
export async function getChatSession(
  chatId: string,
): Promise<Result<ChatSessionDetail>> {
  try {
    const res = await fetch(
      `${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return { success: false, error: `Failed to get chat: ${res.status}` };
    const data = await res.json();
    return { success: true, data: data.chat };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get chat" };
  }
}

/** Append messages to an existing session (called after each AI exchange). */
export async function appendChatMessages(
  chatId: string,
  messages: ChatMessage[],
  documentIds?: string[],
): Promise<Result<void>> {
  try {
    const res = await fetch(
      `${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}/messages`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages, documentIds }),
      },
    );
    if (!res.ok) return { success: false, error: `Failed to append messages: ${res.status}` };
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to append messages" };
  }
}

/** Rename a chat session title. */
export async function renameChatSession(
  chatId: string,
  title: string,
): Promise<Result<void>> {
  try {
    const res = await fetch(
      `${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}/title`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      },
    );
    if (!res.ok) return { success: false, error: `Failed to rename chat: ${res.status}` };
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to rename chat" };
  }
}

/** Delete a chat session. */
export async function deleteChatSession(chatId: string): Promise<Result<void>> {
  try {
    const res = await fetch(
      `${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) return { success: false, error: `Failed to delete chat: ${res.status}` };
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete chat" };
  }
}

/** Clear all AI memories for a workspace. */
export async function clearAiMemory(workspaceId: string): Promise<Result<void>> {
  try {
    const res = await fetch(`${API_URL}/api/ai/memory/clear`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    if (!res.ok) return { success: false, error: `Failed to clear AI memory: ${res.status}` };
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to clear AI memory" };
  }
}

export async function uploadDocument(
  file: File,
  chatId?: string,
): Promise<Result<{ id: string; title: string; chunk_count: number }>> {
  try {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("title", file.name);
    // Pass chatId as query param so RPM-BE can inject it into the multipart
    // forwarded to ai, scoping the RAG chunks to this session.
    const url = new URL(`${API_URL}/api/ai/documents/upload`);
    if (chatId) url.searchParams.set("chatId", chatId);
    const res = await fetch(url.toString(), {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) return { success: false, error: `Upload failed: ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to upload document" };
  }
}

/** Resolve titles/types for multiple document IDs (e.g. after restoring a session). */
export async function fetchDocumentsBulk(
  ids: string[],
): Promise<Result<Array<{ id: string; title: string; type: string }>>> {
  if (!ids.length) return { success: true, data: [] };
  try {
    const res = await fetch(
      `${API_URL}/api/ai/documents/bulk?ids=${ids.map(encodeURIComponent).join(",")}`,
      { credentials: "include" },
    );
    if (!res.ok)
      return { success: false, error: `Failed to fetch document metadata: ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch document metadata" };
  }
}

/** Fetch the reconstructed full-text content of a single document. */
export async function fetchDocumentContent(docId: string): Promise<Result<{
  id: string;
  title: string;
  type: string;
  content: string;
  chunk_count: number;
}>> {
  try {
    const res = await fetch(
      `${API_URL}/api/ai/documents/${encodeURIComponent(docId)}`,
      { credentials: "include" },
    );
    if (!res.ok)
      return { success: false, error: `Failed to fetch document content: ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch document content" };
  }
}

// ── Per-page chat (LaTeX editor AI panel) ────────────────────────────────────

/** Load (or auto-create) the AI chat session for a specific LaTeX editor page. */
export async function getPageChat(
  pageId: string,
  workspaceId: string,
): Promise<Result<ChatSessionDetail>> {
  try {
    const res = await fetch(
      `${API_URL}/api/ai/chats/page/${encodeURIComponent(pageId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { credentials: "include" },
    );
    if (!res.ok) return { success: false, error: `Failed to load page chat: ${res.status}` };
    const data = await res.json();
    return { success: true, data: data.chat };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load page chat" };
  }
}

/** Clear all messages from a page's AI chat (does NOT delete the session). */
export async function clearPageChat(pageId: string): Promise<Result<void>> {
  try {
    const res = await fetch(
      `${API_URL}/api/ai/chats/page/${encodeURIComponent(pageId)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) return { success: false, error: `Failed to clear page chat: ${res.status}` };
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to clear page chat" };
  }
}

// ── Editor-specific streaming (latex_editor intent) ──────────────────────────

export interface EditorStreamOptions {
  chatId: string;
  workspaceId: string;
  projectId?: string;
  /** Full content of the active .tex file */
  fileContent?: string;
  /** Name of the active .tex file */
  filename?: string;
  /** Text the user has selected in the editor */
  selection?: string;
  /** Lines surrounding the cursor position */
  cursorContext?: string;
  /** ── Rich context (v2) ── */
  /** 1-based start line of selection */
  selectionStartLine?: number;
  /** 1-based end line of selection */
  selectionEndLine?: number;
  /** 15 lines before the selection */
  contextBefore?: string;
  /** 15 lines after the selection */
  contextAfter?: string;
  /** Current section heading the cursor is in */
  currentSection?: string | null;
  /** Current LaTeX environment the cursor is in */
  currentEnvironment?: string | null;
  /** Packages, labels, sections summary for document awareness */
  documentStructureSummary?: string;
  /** Parsed compile errors — used by /fix command */
  compileErrors?: Array<{ line: number | null; message: string; context: string }>;
  /** Slash command hint for focused system prompt */
  commandHint?: string;
  /** Cursor line number (1-based) */
  cursorLine?: number;
  /** Cursor column number (1-based) */
  cursorColumn?: number;
  /** Selection start column (1-based) */
  selectionStartColumn?: number;
  /** Selection end column (1-based) */
  selectionEndColumn?: number;
  onMeta?: (meta: { agent: string; intent: string; sources?: SourceItem[] }) => void;
  signal?: AbortSignal;
}

/** Stream an AI response from the latex_editor agent with full document context. */
export async function* streamEditorChat(
  messages: ChatMessage[],
  opts: EditorStreamOptions,
): AsyncGenerator<string, void, unknown> {
  const aiMessages = messages.map(({ role, content }) => ({ role, content }));
  const response = await fetch(`${API_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    credentials: "include",
    body: JSON.stringify({
      messages: aiMessages,
      intent_hint: "latex_editor",
      chat_id: opts.chatId,
      workspace_id: opts.workspaceId,
      project_id: opts.projectId ?? null,
      // Editor-specific fields
      file_content: opts.fileContent ?? "",
      filename: opts.filename ?? "main.tex",
      selection: opts.selection ?? "",
      cursor_context: opts.cursorContext ?? "",
      // Rich context v2
      selection_start_line: opts.selectionStartLine ?? null,
      selection_end_line: opts.selectionEndLine ?? null,
      selection_start_column: opts.selectionStartColumn ?? null,
      selection_end_column: opts.selectionEndColumn ?? null,
      context_before: opts.contextBefore ?? "",
      context_after: opts.contextAfter ?? "",
      current_section: opts.currentSection ?? null,
      current_environment: opts.currentEnvironment ?? null,
      document_structure: opts.documentStructureSummary ?? "",
      compile_errors: opts.compileErrors ?? [],
      command_hint: opts.commandHint ?? null,
      // Cursor position
      cursor_line: opts.cursorLine ?? null,
      cursor_column: opts.cursorColumn ?? null,
    }),
    signal: opts.signal,
  });

  if (!response.ok) throw new Error(`Editor AI request failed: ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") return;
        if (data.startsWith("[META]")) {
          try { opts.onMeta?.(JSON.parse(data.slice(6))); } catch {}
          continue;
        }
        if (data.startsWith("[ACTION]")) continue;
        yield data.replace(/\\n/g, "\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Isolated PDF preview compile ─────────────────────────────────────────────

const COMPILER_URL =
  process.env.NEXT_PUBLIC_COMPILER_URL ||
  (typeof window !== "undefined"
    ? (window as any).__COMPILER_URL__ ?? "http://localhost:2918"
    : "http://localhost:2918");

export interface PreviewCompileResult {
  pdf: string; // base64
  success: boolean;
  log: string;
}

/**
 * Compile an AI suggestion in isolation (without affecting project files).
 * Sends request directly to Flux-Latex-Compiler /compile/preview.
 */
export async function compilePreview(opts: {
  baseContent: string;
  suggestion: string;
  injectAtEnd?: boolean;
  engine?: string;
  sessionId: string;
}): Promise<Result<PreviewCompileResult>> {
  try {
    const res = await fetch(`${COMPILER_URL}/compile/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_content: opts.baseContent,
        suggestion: opts.suggestion,
        inject_at_end: opts.injectAtEnd ?? true,
        engine: opts.engine ?? "pdflatex",
        session_id: opts.sessionId,
      }),
    });
    if (!res.ok) return { success: false, error: `Preview compile failed: ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Preview compile failed" };
  }
}

