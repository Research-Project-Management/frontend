import type { ChatMessage, ChatSession, ChatSessionDetail } from "~/types/chat";
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
    onMeta?: (meta: {
      agent: string;
      intent: string;
      sources?: unknown[];
    }) => void;
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
): Promise<{ id: string; title: string; chunk_count: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("title", file.name);
  const res = await fetch(`${API_URL}/api/ai/documents/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}
