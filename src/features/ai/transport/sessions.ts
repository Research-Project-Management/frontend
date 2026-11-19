import { apiDelete, apiGet, apiPatch, apiPost } from '@/shared/lib/api';
import { logger } from '@/shared/lib/logger';
import type {
  ChatSession,
  ChatSessionDetail,
  CreateChatSessionInput,
  StoredChatMessage,
} from '../types/session';
import { normalizeSpaceId } from './flux';

export async function fetchSessions(
  spaceId?: string | null,
): Promise<ChatSession[]> {
  const params: Record<string, string> = {};
  const cleanSpaceId = normalizeSpaceId(spaceId);
  if (cleanSpaceId) {
    params.spaceId = cleanSpaceId;
  }

  const data = await apiGet<ChatSession[] | { chats?: ChatSession[] }>(
    '/api/ai/chats',
    { params },
  );
  return Array.isArray(data) ? data : (data?.chats ?? []);
}

export async function getSession(chatId: string): Promise<ChatSessionDetail> {
  const data = await apiGet<ChatSessionDetail & { chat?: ChatSessionDetail }>(
    `/api/ai/chats/${encodeURIComponent(chatId)}`,
  );
  return data.chat ?? data;
}

export async function createSession(
  input: CreateChatSessionInput,
): Promise<ChatSessionDetail> {
  const cleanSpaceId = normalizeSpaceId(input.spaceId);
  const data = await apiPost<ChatSessionDetail & { chat?: ChatSessionDetail }>(
    '/api/ai/chats',
    {
      title: input.title,
      spaceId: cleanSpaceId,
      messages: input.messages ?? [],
      documentIds: input.documentIds,
    },
  );
  return data.chat ?? data;
}

export async function renameSession(
  chatId: string,
  title: string,
): Promise<ChatSession> {
  const data = await apiPatch<ChatSession & { chat?: ChatSession }>(
    `/api/ai/chats/${encodeURIComponent(chatId)}`,
    { title },
  );
  return data.chat ?? data;
}

export async function deleteSession(chatId: string): Promise<void> {
  await apiDelete(`/api/ai/chats/${encodeURIComponent(chatId)}`);
}

export async function getPageChat(
  pageId: string,
): Promise<{ chatId: string | null; messages: StoredChatMessage[] }> {
  try {
    const data = await apiGet<
      | StoredChatMessage[]
      | {
          id?: string;
          chatId?: string;
          chat?: { id?: string; messages?: StoredChatMessage[] } | null;
          messages?: StoredChatMessage[];
        }
    >(`/api/ai/chats/page/${encodeURIComponent(pageId)}`);

    if (Array.isArray(data)) {
      return { chatId: null, messages: data };
    }
    const chatId = data?.chat?.id ?? data?.id ?? data?.chatId ?? null;
    const messages = Array.isArray(data?.chat?.messages)
      ? data.chat.messages
      : (data?.messages ?? []);
    return { chatId, messages };
  } catch (err) {
    logger.debug('[sessions] Failed to load page chat', { pageId, err });
    return { chatId: null, messages: [] };
  }
}

export async function clearPageChat(pageId: string): Promise<void> {
  await apiDelete(`/api/ai/chats/page/${encodeURIComponent(pageId)}`);
}
