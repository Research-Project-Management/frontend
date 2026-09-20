import type {
  ChatMessage,
  ChatSession,
  ChatSessionDetail,
  CreateChatSessionInput,
  SourceItem,
  AgentAction,
} from '../types/chat.types';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiRawFetch,
} from '@/shared/lib/api';
import { logger } from '@/shared/lib/logger';

// ── Streaming Chat ────────────────────────────────────────────────────────────

export interface StreamChatOptions {
  projectId?: string | null;
  scopeId?: string | null;
  documentIds?: string[] | null;
  intentHint?: string | null;
  webSearchSites?: string[] | null;
  selection?: string | null;
  cursorContext?: string | null;
  chatId?: string | null;
  onMeta?: (meta: {
    chatId?: string;
    title?: string;
    agent?: string;
    intent?: string;
    sources?: SourceItem[];
  }) => void;
  onAction?: (action: AgentAction) => void;
  signal?: AbortSignal;
  [key: string]: unknown;
}

interface SseCallbacks {
  onMeta?: (meta: any) => void;
  onAction?: (action: any) => void;
}

function parseSseDataChunk(
  data: string,
  callbacks?: SseCallbacks,
): { done?: boolean; content?: string } {
  if (data === '[DONE]') {
    return { done: true };
  }
  if (data.startsWith('[META]')) {
    try {
      const meta = JSON.parse(data.slice(6));
      callbacks?.onMeta?.(meta);
    } catch (err) {
      logger.debug('[chatService] Failed to parse stream meta', { err });
    }
    return {};
  }
  if (data.startsWith('[ACTION]')) {
    try {
      const action = JSON.parse(data.slice(8));
      callbacks?.onAction?.(action);
    } catch (err) {
      logger.debug('[chatService] Failed to parse stream action', { err });
    }
    return {};
  }

  if (data.startsWith('{')) {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        const p = parsed as Record<string, any>;
        if (p.type === 'meta' && callbacks?.onMeta) {
          callbacks.onMeta(p.data || p);
          return {};
        }
        if (p.type === 'action' && callbacks?.onAction) {
          callbacks.onAction(p.data || p);
          return {};
        }
        if (typeof p.content === 'string') {
          return { content: p.content };
        }
        if (typeof p.text === 'string') {
          return { content: p.text };
        }
        if (typeof p.delta === 'string') {
          return { content: p.delta };
        }
      }
    } catch {
      // Non-JSON or malformed payload, fallback to raw
    }
  }

  return { content: data };
}

/**
 * Stream chat responses from the AI backend with authenticated proxy and token support.
 */
export async function* streamChatResponse(
  messages: ChatMessage[],
  options?: StreamChatOptions,
): AsyncGenerator<string, void, unknown> {
  const aiMessages = messages.map(({ role, content }) => ({ role, content }));
  const response = await apiRawFetch('/api/ai/chat', 'POST', {
    messages: aiMessages,
    project_id: options?.projectId ?? null,
    document_ids: options?.documentIds ?? null,
    intent_hint: options?.intentHint ?? null,
    web_search_sites: options?.webSearchSites ?? null,
    selection: options?.selection ?? null,
    cursor_context: options?.cursorContext ?? null,
    chat_id: options?.chatId ?? null,
    ...options,
  }, {
    headers: {
      Accept: 'text/event-stream',
    },
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          const chunk = parseSseDataChunk(data, options);
          if (chunk.done) return;
          if (chunk.content !== undefined) {
            yield chunk.content;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export interface StreamEditorChatOptions {
  chatId?: string | null;
  projectId?: string | null;
  scopeId?: string | null;
  documentIds?: string[] | null;
  filename?: string | null;
  fileContent?: string | null;
  selection?: string | null;
  cursorContext?: string | null;
  selectionStartLine?: number | null;
  selectionEndLine?: number | null;
  selectionStartColumn?: number | null;
  selectionEndColumn?: number | null;
  contextBefore?: string | null;
  contextAfter?: string | null;
  currentSection?: string | null;
  currentEnvironment?: string | null;
  documentStructureSummary?: string | null;
  compileErrors?: unknown;
  userSelection?: unknown;
  onMeta?: (meta: { agent: string; intent: string; sources?: SourceItem[] }) => void;
  onAction?: (action: AgentAction) => void;
  signal?: AbortSignal;
  [key: string]: unknown;
}

/**
 * Stream LaTeX Editor chat responses.
 */
export async function* streamEditorChat(
  messages: ChatMessage[],
  options?: StreamEditorChatOptions,
): AsyncGenerator<string, void, unknown> {
  const aiMessages = messages.map(({ role, content }) => ({ role, content }));
  const response = await apiRawFetch('/api/ai/editor-chat', 'POST', {
    messages: aiMessages,
    chat_id: options?.chatId ?? null,
    project_id: options?.projectId ?? null,
    document_ids: options?.documentIds ?? null,
    filename: options?.filename ?? null,
    file_content: options?.fileContent ?? null,
    selection: options?.selection ?? null,
    cursor_context: options?.cursorContext ?? null,
    selection_start_line: options?.selectionStartLine ?? null,
    selection_end_line: options?.selectionEndLine ?? null,
    selection_start_column: options?.selectionStartColumn ?? null,
    selection_end_column: options?.selectionEndColumn ?? null,
    context_before: options?.contextBefore ?? null,
    context_after: options?.contextAfter ?? null,
    current_section: options?.currentSection ?? null,
    current_environment: options?.currentEnvironment ?? null,
    document_structure_summary: options?.documentStructureSummary ?? null,
    compile_errors: options?.compileErrors ?? null,
    user_selection: options?.userSelection ?? null,
    ...options,
  }, {
    headers: {
      Accept: 'text/event-stream',
    },
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Editor AI request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          const chunk = parseSseDataChunk(data, options);
          if (chunk.done) return;
          if (chunk.content !== undefined) {
            yield chunk.content;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── REST Chat Sessions ────────────────────────────────────────────────────────

export async function fetchChatSessions(
  projectId?: string | null,
  scopeId?: string | null,
): Promise<ChatSession[]> {
  const params: Record<string, string> = {};
  const pid = projectId || scopeId;
  if (pid && pid !== 'all' && pid !== 'me' && pid !== 'flux') {
    params.projectId = pid;
  }

  try {
    const data = await apiGet<{ chats?: ChatSession[]; data?: { chats?: ChatSession[] } | ChatSession[] }>(
      '/api/ai/chats',
      { params },
    );
    return (
      data.chats ||
      (data.data as { chats?: ChatSession[] })?.chats ||
      (Array.isArray(data.data) ? data.data : [])
    );
  } catch (err) {
    logger.error('[chatService] Failed to fetch chat sessions', err);
    return [];
  }
}

export const listChatSessions = fetchChatSessions;

export async function getChatSession(chatId: string): Promise<ChatSessionDetail> {
  const data = await apiGet<{ chat?: ChatSessionDetail; data?: { chat?: ChatSessionDetail } | ChatSessionDetail }>(
    `/api/ai/chats/${chatId}`,
  );
  return (
    data.chat ||
    (data.data as { chat?: ChatSessionDetail })?.chat ||
    (data.data as ChatSessionDetail) ||
    (data as unknown as ChatSessionDetail)
  );
}

export async function createChatSession(
  input: {
    title: string;
    projectId?: string | null;
    messages?: ChatMessage[];
    documentIds?: string[];
  },
): Promise<ChatSessionDetail> {
  const data = await apiPost<{ chat?: ChatSessionDetail; data?: { chat?: ChatSessionDetail } | ChatSessionDetail }>(
    '/api/ai/chats',
    {
      title: input.title,
      projectId: input.projectId,
      messages: input.messages || [],
      documentIds: input.documentIds,
    },
  );
  return (
    data.chat ||
    (data.data as { chat?: ChatSessionDetail })?.chat ||
    (data.data as ChatSessionDetail) ||
    (data as unknown as ChatSessionDetail)
  );
}

export async function appendChatMessages(
  chatId: string,
  messages: ChatMessage[],
  documentIds?: string[],
): Promise<ChatSessionDetail> {
  const data = await apiPost<{ chat?: ChatSessionDetail; data?: { chat?: ChatSessionDetail } | ChatSessionDetail }>(
    `/api/ai/chats/${chatId}/messages`,
    { messages, documentIds },
  );
  return (
    data.chat ||
    (data.data as { chat?: ChatSessionDetail })?.chat ||
    (data.data as ChatSessionDetail) ||
    (data as unknown as ChatSessionDetail)
  );
}

export async function renameChatSession(
  chatId: string,
  title: string,
): Promise<ChatSession> {
  const data = await apiPatch<{ chat?: ChatSession; data?: { chat?: ChatSession } | ChatSession }>(
    `/api/ai/chats/${chatId}`,
    { title },
  );
  return (
    data.chat ||
    (data.data as { chat?: ChatSession })?.chat ||
    (data.data as ChatSession) ||
    (data as unknown as ChatSession)
  );
}

export async function deleteChatSession(chatId: string): Promise<void> {
  await apiDelete(`/api/ai/chats/${chatId}`);
}

export async function clearAiMemory(scopeId?: string): Promise<void> {
  const path = scopeId ? `/api/ai/memory/${encodeURIComponent(scopeId)}` : '/api/ai/memory';
  await apiDelete(path);
}

// ── Page Chat (LaTeX & Collaborative Docs) ────────────────────────────────────

export async function getPageChat(pageId: string, _options?: unknown): Promise<ChatMessage[]> {
  try {
    const data = await apiGet<{ messages?: ChatMessage[]; data?: { messages?: ChatMessage[] } | ChatMessage[] }>(
      `/api/ai/page-chats/${pageId}`,
    );
    return (
      data.messages ||
      (data.data as { messages?: ChatMessage[] })?.messages ||
      (Array.isArray(data.data) ? data.data : [])
    );
  } catch (err) {
    logger.error('[chatService] Failed to get page chat', err);
    return [];
  }
}

export async function clearPageChat(pageId: string): Promise<void> {
  await apiDelete(`/api/ai/page-chats/${pageId}`);
}

// ── Document RAG & Sources ────────────────────────────────────────────────────

export async function uploadDocument(
  scopeId: string,
  file: File,
): Promise<{ id: string; name: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  if (scopeId) {
    formData.append('projectId', scopeId);
  }

  const response = await apiRawFetch('/api/ai/documents/upload', 'POST', formData);
  if (!response.ok) {
    throw new Error(`Failed to upload document: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return (data.data || data) as { id: string; name: string; size: number };
}

export async function fetchDocumentsBulk(
  ids: string[],
): Promise<Array<{ id: string; name: string; size: number }>> {
  const data = await apiPost<{ documents?: Array<{ id: string; name: string; size: number }>; data?: { documents?: Array<{ id: string; name: string; size: number }> } | Array<{ id: string; name: string; size: number }> }>(
    '/api/ai/documents/bulk',
    { ids },
  );
  return (
    data.documents ||
    (data.data as { documents?: Array<{ id: string; name: string; size: number }> })?.documents ||
    (Array.isArray(data.data) ? data.data : [])
  );
}

export async function fetchDocumentContent(
  docId: string,
): Promise<{ text: string }> {
  const data = await apiGet<{ text?: string; data?: { text?: string } | string }>(
    `/api/ai/documents/${docId}/content`,
  );
  return {
    text:
      data.text ||
      (data.data as { text?: string })?.text ||
      (typeof data.data === 'string' ? data.data : '') ||
      '',
  };
}
