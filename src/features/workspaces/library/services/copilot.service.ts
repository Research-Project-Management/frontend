import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/api';
import type { CopilotMessage, CopilotCitation } from '../types/copilot.types';

export interface StreamPaperOptions {
  selection?: {
    text: string;
    pageNumber: number;
  };
  chatId?: string;
  onCitation?: (citations: CopilotCitation[]) => void;
  signal?: AbortSignal;
}

/**
 * Stream paper-scoped AI Copilot responses via SSE
 */
export async function* streamPaperCopilotChat(
  paperId: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  options?: StreamPaperOptions,
): AsyncGenerator<string, void, unknown> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}/api/ai/rag/papers/${encodeURIComponent(paperId)}/stream`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      messages,
      selection_context: options?.selection ?? null,
      chat_id: options?.chatId ?? `paper-${paperId}`,
      intent_hint: 'paper_rag_qa',
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`AI Copilot streaming failed (${response.status}): ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('ReadableStream not supported by browser environment');
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
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') return;

          try {
            const parsed: any = JSON.parse(dataStr);
            if (typeof parsed.delta === 'string') {
              yield parsed.delta;
            } else if (typeof parsed.content === 'string') {
              yield parsed.content;
            } else if (typeof parsed.text === 'string') {
              yield parsed.text;
            }

            if (Array.isArray(parsed.citations) && options?.onCitation) {
              options.onCitation(parsed.citations);
            }
          } catch {
            // Raw text chunk fallback
            yield dataStr;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
