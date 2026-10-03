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

          // Ignore internal action / tool execution events
          if (dataStr.startsWith('[ACTION]')) {
            continue;
          }

          // Handle metadata & sources
          if (dataStr.startsWith('[META]')) {
            try {
              const meta = JSON.parse(dataStr.slice(6)) as Record<string, any>;
              if (Array.isArray(meta.citations)) {
                options?.onCitation?.(meta.citations);
              } else if (Array.isArray(meta.sources)) {
                const citations: CopilotCitation[] = [];
                for (const s of meta.sources) {
                  const pageNum = s.page || s.pageNumber || s.metadata?.page;
                  if (typeof pageNum === 'number' && pageNum > 0) {
                    citations.push({
                      pageNumber: pageNum,
                      section: s.section || s.source,
                      quote: s.snippet,
                    });
                  }
                }
                if (citations.length > 0 && options?.onCitation) {
                  options.onCitation(citations);
                }
              }
            } catch {
              // Ignore malformed meta
            }
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr) as SseStreamPayload;
            if (parsed.type === 'citations' && Array.isArray(parsed.citations)) {
              if (options?.onCitation) {
                options.onCitation(parsed.citations);
              }
              continue;
            }
            const raw = parsed.text ?? parsed.delta ?? parsed.content;
            if (typeof raw === 'string') {
              yield raw.includes('\\n') ? raw.replace(/\\r\\n|\\n/g, '\n') : raw;
              continue;
            }
          } catch {
            // Not a JSON payload, treat as raw token stream
          }

          const unescaped = dataStr.includes('\\n')
            ? dataStr.replace(/\\r\\n|\\n/g, '\n')
            : dataStr;
          yield unescaped;
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
