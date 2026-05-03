import type {
  ChatMessage,
  ChatSession,
  ChatSessionDetail,
  SourceItem,
  AgentAction,
} from "~/types/chat";
import { API_URL } from "~/lib/api";

/**
 * Stream chat responses from the AI backend via RPM-BE proxy.
 *
 * Flow: Frontend → RPM-BE (/api/ai/chat) → Flux-AI (/chat) → SSE stream
 */
export async function* streamChatResponse(
  messages: ChatMessage[],
  options?: {
    projectId?: string;
    documentIds?: string[];
    intentHint?: string;
    webSearchSites?: string[];
    workspaceId?: string;
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
  const response = await fetch(`${API_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    credentials: "include",
    body: JSON.stringify({
      messages,
      project_id: options?.projectId,
      document_ids: options?.documentIds,
      intent_hint: options?.intentHint,
      web_search_sites: options?.webSearchSites ?? null,
      workspace_id: options?.workspaceId ?? null,
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
): Promise<ChatSyncResponse> {
  const response = await fetch(`${API_URL}/api/ai/chat/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      messages,
      project_id: options?.projectId,
      document_ids: options?.documentIds,
      intent_hint: options?.intentHint,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI sync request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Hook for streaming AI chat in React components.
 */
export function useChatStream() {
  const streamChat = async (
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: {
      projectId?: string;
      documentIds?: string[];
      intentHint?: string;
      onComplete?: () => void;
      onError?: (error: Error) => void;
    },
  ) => {
    const controller = new AbortController();

    try {
      for await (const chunk of streamChatResponse(messages, {
        projectId: options?.projectId,
        documentIds: options?.documentIds,
        intentHint: options?.intentHint,
        signal: controller.signal,
      })) {
        onChunk(chunk);
      }
      options?.onComplete?.();
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        options?.onError?.(error);
      }
    }

    return () => controller.abort();
  };

  return { streamChat };
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

/** List all chat sessions for a workspace (sidebar data). */
export async function listChatSessions(
  workspaceId: string,
): Promise<ChatSession[]> {
  const res = await fetch(
    `${API_URL}/api/ai/chats?workspaceId=${encodeURIComponent(workspaceId)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`Failed to list chats: ${res.status}`);
  const data = await res.json();
  return data.chats;
}

/** Create a new chat session, optionally with initial messages already included. */
export async function createChatSession(opts: {
  workspaceId: string;
  title?: string;
  projectId?: string;
  messages?: ChatMessage[];
  documentIds?: string[];
}): Promise<ChatSessionDetail> {
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
  if (!res.ok) throw new Error(`Failed to create chat: ${res.status}`);
  const data = await res.json();
  return data.chat;
}

/** Fetch a specific chat session with all messages. */
export async function getChatSession(
  chatId: string,
): Promise<ChatSessionDetail> {
  const res = await fetch(
    `${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}`,
    {
      credentials: "include",
    },
  );
  if (!res.ok) throw new Error(`Failed to get chat: ${res.status}`);
  const data = await res.json();
  return data.chat;
}

/** Append messages to an existing session (called after each AI exchange). */
export async function appendChatMessages(
  chatId: string,
  messages: ChatMessage[],
  documentIds?: string[],
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}/messages`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messages, documentIds }),
    },
  );
  if (!res.ok) throw new Error(`Failed to append messages: ${res.status}`);
}

/** Rename a chat session title. */
export async function renameChatSession(
  chatId: string,
  title: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}/title`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    },
  );
  if (!res.ok) throw new Error(`Failed to rename chat: ${res.status}`);
}

/** Delete a chat session. */
export async function deleteChatSession(chatId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok) throw new Error(`Failed to delete chat: ${res.status}`);
}

export async function uploadDocument(
  file: File,
  chatId?: string,
): Promise<{ id: string; title: string; chunk_count: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("title", file.name);
  // Pass chatId as query param so RPM-BE can inject it into the multipart
  // forwarded to Flux-AI, scoping the RAG chunks to this session.
  const url = new URL(`${API_URL}/api/ai/documents/upload`);
  if (chatId) url.searchParams.set("chatId", chatId);
  const res = await fetch(url.toString(), {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

/** Resolve titles/types for multiple document IDs (e.g. after restoring a session). */
export async function fetchDocumentsBulk(
  ids: string[],
): Promise<Array<{ id: string; title: string; type: string }>> {
  if (!ids.length) return [];
  const res = await fetch(
    `${API_URL}/api/ai/documents/bulk?ids=${ids.map(encodeURIComponent).join(",")}`,
    { credentials: "include" },
  );
  if (!res.ok)
    throw new Error(`Failed to fetch document metadata: ${res.status}`);
  return res.json();
}

/** Fetch the reconstructed full-text content of a single document. */
export async function fetchDocumentContent(docId: string): Promise<{
  id: string;
  title: string;
  type: string;
  content: string;
  chunk_count: number;
}> {
  const res = await fetch(
    `${API_URL}/api/ai/documents/${encodeURIComponent(docId)}`,
    { credentials: "include" },
  );
  if (!res.ok)
    throw new Error(`Failed to fetch document content: ${res.status}`);
  return res.json();
}

// ── Per-page chat (LaTeX editor AI panel) ────────────────────────────────────

/** Load (or auto-create) the AI chat session for a specific LaTeX editor page. */
export async function getPageChat(
  pageId: string,
  workspaceId: string,
): Promise<ChatSessionDetail> {
  const res = await fetch(
    `${API_URL}/api/ai/chats/page/${encodeURIComponent(pageId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`Failed to load page chat: ${res.status}`);
  const data = await res.json();
  return data.chat;
}

/** Clear all messages from a page's AI chat (does NOT delete the session). */
export async function clearPageChat(pageId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/ai/chats/page/${encodeURIComponent(pageId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok) throw new Error(`Failed to clear page chat: ${res.status}`);
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
  onMeta?: (meta: { agent: string; intent: string; sources?: SourceItem[] }) => void;
  signal?: AbortSignal;
}

/** Stream an AI response from the latex_editor agent with full document context. */
export async function* streamEditorChat(
  messages: ChatMessage[],
  opts: EditorStreamOptions,
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${API_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    credentials: "include",
    body: JSON.stringify({
      messages,
      intent_hint: "latex_editor",
      chat_id: opts.chatId,
      workspace_id: opts.workspaceId,
      project_id: opts.projectId ?? null,
      // Editor-specific fields
      file_content: opts.fileContent ?? "",
      filename: opts.filename ?? "main.tex",
      selection: opts.selection ?? "",
      cursor_context: opts.cursorContext ?? "",
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
  typeof window !== "undefined"
    ? (window as any).__COMPILER_URL__ ?? "http://localhost:8001"
    : "http://localhost:8001";

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
}): Promise<PreviewCompileResult> {
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
  if (!res.ok) throw new Error(`Preview compile failed: ${res.status}`);
  return res.json();
}

