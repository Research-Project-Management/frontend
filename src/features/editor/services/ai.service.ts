/**
 * ai.service.ts
 *
 * Frontend service mirroring Backend `modules/ai/`:
 *  - Editor Chat streaming SSE (`/api/ai/editor-chat`)
 *  - Page Chat state (`/api/ai/page-chats/:pageId`)
 *  - AI Sessions CRUD (`/api/ai/chats`)
 */

import type {
  ChatMessage,
  ChatSession,
  ChatSessionDetail,
  SourceItem,
} from '../types/editor-ai.types';
import { API_BASE_URL as API_URL } from '@/shared/constants';
import { getAuthToken } from '@/shared/lib/api';

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...extra,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface StreamEditorChatOptions {
  chatId?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
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
  onMeta?: (meta: { agent: string; intent: string; sources?: SourceItem[] }) => void;
  onAction?: (action: unknown) => void;
  signal?: AbortSignal;
  [key: string]: unknown;
}

/**
 * Stream LaTeX Editor chat responses via SSE (backend: modules/ai/thread).
 */
export async function* streamEditorChat(
  messages: ChatMessage[],
  options?: StreamEditorChatOptions,
): AsyncGenerator<string, void, unknown> {
  const aiMessages = messages.map(({ role, content }) => ({ role, content }));
  const response = await fetch(`${API_URL}/api/ai/editor-chat`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }),
    credentials: 'include',
    body: JSON.stringify({
      messages: aiMessages,
      chat_id: options?.chatId ?? null,
      workspace_id: options?.workspaceId ?? null,
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
    }),
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
          if (data === '[DONE]') return;
          if (data.startsWith('[META]')) {
            try {
              const meta = JSON.parse(data.slice(6));
              options?.onMeta?.(meta);
            } catch {}
            continue;
          }
          if (data.startsWith('[ACTION]')) {
            try {
              const action = JSON.parse(data.slice(8));
              options?.onAction?.(action);
            } catch {}
            continue;
          }
          yield data.replace(/\\n/g, '\n');
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getPageChat(pageId: string, workspaceId?: string): Promise<any> {
  const url = workspaceId
    ? `${API_URL}/api/ai/page-chats/${encodeURIComponent(pageId)}?workspaceId=${encodeURIComponent(workspaceId)}`
    : `${API_URL}/api/ai/page-chats/${encodeURIComponent(pageId)}`;
  const res = await fetch(url, {
    headers: getHeaders(),
    credentials: 'include',
  });
  if (!res.ok) return { _id: null, id: null, messages: [] };
  const data = await res.json();
  if (data?.chat) return data.chat;
  return data;
}

export async function clearPageChat(pageId: string, workspaceId?: string): Promise<void> {
  const url = workspaceId
    ? `${API_URL}/api/ai/page-chats/${encodeURIComponent(pageId)}?workspaceId=${encodeURIComponent(workspaceId)}`
    : `${API_URL}/api/ai/page-chats/${encodeURIComponent(pageId)}`;
  await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });
}

export async function getChatSession(chatId: string): Promise<ChatSessionDetail> {
  const res = await fetch(`${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to get chat session');
  return res.json();
}

export async function createChatSession(input: {
  workspaceId: string;
  title: string;
  projectId?: string | null;
  messages?: ChatMessage[];
  documentIds?: string[];
}): Promise<ChatSessionDetail> {
  const res = await fetch(`${API_URL}/api/ai/chats`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      title: input.title,
      projectId: input.projectId,
      messages: input.messages || [],
      documentIds: input.documentIds,
    }),
  });
  if (!res.ok) throw new Error('Failed to create chat session');
  return res.json();
}

export async function appendChatMessages(
  chatId: string,
  messages: ChatMessage[],
  documentIds?: string[],
): Promise<ChatSessionDetail> {
  const res = await fetch(`${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ messages, documentIds }),
  });
  if (!res.ok) throw new Error('Failed to append messages');
  return res.json();
}

export async function listChatSessions(
  workspaceId?: string | null,
  projectId?: string | null,
): Promise<ChatSession[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.append('workspaceId', workspaceId);
  if (projectId) params.append('projectId', projectId);

  const res = await fetch(`${API_URL}/api/ai/chats?${params.toString()}`, {
    headers: getHeaders(),
    credentials: 'include',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.chats || [];
}

export async function renameChatSession(
  chatId: string,
  title: string,
): Promise<ChatSession> {
  const res = await fetch(`${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}`, {
    method: 'PATCH',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to rename chat session');
  return res.json();
}

export async function deleteChatSession(chatId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/ai/chats/${encodeURIComponent(chatId)}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete chat session');
}

export const EditorAiService = {
  streamEditorChat,
  getPageChat,
  clearPageChat,
  getChatSession,
  createChatSession,
  appendChatMessages,
  listChatSessions,
  renameChatSession,
  deleteChatSession,
};
