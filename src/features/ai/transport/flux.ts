import { apiPost, apiRawFetch } from '@/shared/lib/api';
import { logger } from '@/shared/lib/logger';
import type { AiStreamEvent } from '../types/event';
import type {
  AiTransportPort,
  ResumeRequest,
  StreamRequest,
  StreamResult,
} from './transport.port';
import {
  decodeFluxSseFrame,
  SseFrameParser,
  ThinkTagSplitter,
} from './sse';

const PERSONAL_SCOPE_SENTINELS = new Set([
  'all',
  'me',
  'user',
  'personal',
  'flux',
  'null',
  'undefined',
]);

export function normalizeSpaceId(value?: string | null): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || PERSONAL_SCOPE_SENTINELS.has(trimmed.toLowerCase())) {
    return undefined;
  }
  return trimmed;
}

async function* iterateSseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AiStreamEvent, void, unknown> {
  const reader = body.getReader();
  const parser = new SseFrameParser();
  const splitter = new ThinkTagSplitter();

  function* emitEvents(events: AiStreamEvent[]): Generator<AiStreamEvent, boolean, unknown> {
    for (const ev of events) {
      if (ev.type === 'text-delta') {
        for (const piece of splitter.feed(ev.delta)) {
          yield piece;
        }
        continue;
      }
      if (ev.type === 'done') {
        for (const tail of splitter.flush()) {
          yield tail;
        }
        yield ev;
        return true;
      }
      if (ev.type === 'error') {
        for (const tail of splitter.flush()) {
          yield tail;
        }
        yield ev;
        return true;
      }
      yield ev;
    }
    return false;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const frames = parser.feed(value);
      for (const frame of frames) {
        const events = decodeFluxSseFrame(frame.event, frame.data);
        const stopped = yield* emitEvents(events);
        if (stopped) return;
      }
    }

    const trailingFrames = parser.flush();
    for (const frame of trailingFrames) {
      const events = decodeFluxSseFrame(frame.event, frame.data);
      const stopped = yield* emitEvents(events);
      if (stopped) return;
    }

    for (const tail of splitter.flush()) {
      yield tail;
    }
  } finally {
    reader.releaseLock();
  }
}

export class FluxHttpTransport implements AiTransportPort {
  async stream(request: StreamRequest): Promise<StreamResult> {
    const { messages, context, signal } = request;
    const spaceId = normalizeSpaceId(context.spaceId);

    const wireMessages = messages.map(({ role, content, attachments }) => ({
      role,
      content,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    }));

    let endpoint = '/api/ai/chat';
    if (context.mode === 'editor') {
      endpoint = '/api/ai/editor-chat';
    } else if (context.mode === 'paper' && context.paper?.paperId) {
      endpoint = `/api/ai/papers/${encodeURIComponent(context.paper.paperId)}/chat`;
    }

    const ed = context.editor;
    const body: Record<string, unknown> = {
      messages: wireMessages,
      spaceId: spaceId ?? undefined,
      chatId: context.chatId ?? undefined,
      documentIds:
        context.documentIds && context.documentIds.length > 0
          ? context.documentIds
          : undefined,
      webSearchSites:
        context.webSearchSites && context.webSearchSites.length > 0
          ? context.webSearchSites
          : undefined,
      intentHint: context.intentHint ?? undefined,
    };

    if (context.paper?.quotedPassage) {
      body.selection = context.paper.quotedPassage;
    }

    if (ed) {
      if (ed.pageId) body.pageId = ed.pageId;
      if (ed.filename) body.filename = ed.filename;
      if (ed.fileContent != null) body.fileContent = ed.fileContent;
      if (ed.selection != null) body.selection = ed.selection;
      if (ed.cursorContext != null) body.cursorContext = ed.cursorContext;
      if (ed.cursorLine != null) body.cursorLine = ed.cursorLine;
      if (ed.cursorColumn != null) body.cursorColumn = ed.cursorColumn;
      if (ed.selectionStartLine != null) {
        body.selectionStartLine = ed.selectionStartLine;
      }
      if (ed.selectionEndLine != null) {
        body.selectionEndLine = ed.selectionEndLine;
      }
      if (ed.selectionStartColumn != null) {
        body.selectionStartColumn = ed.selectionStartColumn;
      }
      if (ed.selectionEndColumn != null) {
        body.selectionEndColumn = ed.selectionEndColumn;
      }
      if (ed.contextBefore != null) body.contextBefore = ed.contextBefore;
      if (ed.contextAfter != null) body.contextAfter = ed.contextAfter;
      if (ed.currentSection != null) body.currentSection = ed.currentSection;
      if (ed.currentEnvironment != null) {
        body.currentEnvironment = ed.currentEnvironment;
      }
      if (ed.documentStructureSummary != null) {
        body.documentStructureSummary = ed.documentStructureSummary;
      }
      if (ed.documentStructure != null) {
        body.documentStructure = ed.documentStructure;
      }
      if (ed.compileErrors != null) body.compileErrors = ed.compileErrors;
      if (ed.userSelection != null) body.userSelection = ed.userSelection;
    }

    const response = await apiRawFetch(endpoint, 'POST', body, {
      headers: {
        Accept: 'text/event-stream',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const chatIdHeader = response.headers?.get?.('x-chat-id') ?? null;

    return {
      chatIdHeader,
      events: iterateSseEvents(response.body),
    };
  }

  async resume(request: ResumeRequest): Promise<StreamResult> {
    const spaceId = normalizeSpaceId(request.spaceId);
    const response = await apiRawFetch(
      '/api/ai/chat/resume',
      'POST',
      {
        chatId: request.chatId,
        decision: request.decision,
        spaceId: spaceId ?? undefined,
        pageId: request.pageId ?? undefined,
        documentIds:
          request.documentIds && request.documentIds.length > 0
            ? request.documentIds
            : undefined,
      },
      {
        headers: {
          Accept: 'text/event-stream',
        },
        signal: request.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`AI resume failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const chatIdHeader = response.headers?.get?.('x-chat-id') ?? request.chatId;

    return {
      chatIdHeader,
      events: iterateSseEvents(response.body),
    };
  }

  async cancel(chatId: string, spaceId?: string | null): Promise<void> {
    if (!chatId) return;
    const cleanSpaceId = normalizeSpaceId(spaceId);
    const qs = cleanSpaceId
      ? `?spaceId=${encodeURIComponent(cleanSpaceId)}`
      : '';
    try {
      await apiPost(`/api/ai/chat/${encodeURIComponent(chatId)}/cancel${qs}`, {});
    } catch (err) {
      logger.debug('[FluxHttpTransport] Cooperative cancel failed', {
        chatId,
        err,
      });
    }
  }
}

export const fluxTransport = new FluxHttpTransport();
