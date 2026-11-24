import { apiDelete, apiGet, apiPatch } from '@/shared/lib/api';
import type { ChatSession, ChatSessionDetail } from '../types/session';
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
