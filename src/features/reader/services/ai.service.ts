import { apiRawFetch } from "@/shared/lib/api";
import type { CopilotCitation, StreamPaperOptions } from '../types/reader.types';

export type { StreamPaperOptions };

interface SseStreamPayload {
  type?: string;
  citations?: CopilotCitation[];
  text?: string;
  delta?: string;
  content?: string;
}

export async function* streamPaperChat(
  paperId: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  options?: StreamPaperOptions,
): AsyncGenerator<string, void, unknown> {
  const response = await apiRawFetch(
    `/api/ai/rag/papers/${encodeURIComponent(paperId)}/stream`,
    'POST',
    {
      messages,
      selection_context: options?.selection ?? null,
      chat_id: options?.chatId ?? `paper-${paperId}`,
      intent_hint: 'paper_rag_qa',
    },
    {
      headers: {
        Accept: 'text/event-stream',
      },
      signal: options?.signal,
    },
  );

  if (!response.ok) {
    throw new Error(`AI streaming failed (${response.status}): ${response.statusText}`);
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

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') return;

          try {
            const parsed = JSON.parse(dataStr) as SseStreamPayload;
            if (parsed.type === 'citations' && Array.isArray(parsed.citations)) {
              if (options?.onCitation) {
                options.onCitation(parsed.citations);
              }
            }
            if (parsed.text) {
              yield parsed.text;
            } else if (parsed.delta) {
              yield parsed.delta;
            } else if (parsed.content) {
              yield parsed.content;
            }
          } catch {
            yield dataStr;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const AiService = {
  streamPaperChat,
};
