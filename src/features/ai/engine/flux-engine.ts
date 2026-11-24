import { fluxTransport } from '../transport/flux';
import type { AiTransportPort, StreamResult } from '../transport/transport.port';
import type { TurnContext, TurnMode } from '../types/context';
import type { AiStreamEvent } from '../types/event';
import type {
  EditorPatchItem,
  EditorPatchesWidget,
  FluxMessage,
  HitlDecision,
  HitlInterrupt,
  MessagePart,
  ResponseWidget,
} from '../types/message';
import type { ThreadStatus } from '../types/session';
import type {
  ThreadEngine,
  ThreadEngineCallbacks,
  ThreadEngineInit,
  ThreadSnapshot,
} from './engine.port';
import { buildWidgetsFromToolOutput } from './history';

export interface StreamTurnState {
  readonly message: FluxMessage;
  readonly error: Error | null;
  readonly openTextIndex: number | null;
  readonly openReasoningIndex: number | null;
  readonly openToolsByName: ReadonlyMap<string, readonly number[]>;
  readonly activeHandoffIndices: readonly number[];
  readonly streamedEditorPatches: readonly EditorPatchItem[];
  readonly metaWidgetsPartIndex: number | null;
  readonly sourcesPartIndex: number | null;
  readonly finalizedMetaWidgets: boolean;
  readonly seq: number;
}

const createMessageId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isAbortError = (err: unknown): boolean =>
  err instanceof Error && err.name === 'AbortError';

function collectPendingInterrupts(messages: readonly FluxMessage[]): HitlInterrupt[] {
  const pending: HitlInterrupt[] = [];
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === 'hitl' && part.status === 'pending') pending.push(...part.interrupts);
    }
  }
  return pending;
}

function collectWidgets(parts: readonly MessagePart[]): ResponseWidget[] | undefined {
  const all: ResponseWidget[] = [];
  for (const p of parts) if (p.type === 'widgets') all.push(...p.widgets);
  return all.length > 0 ? all : undefined;
}

function closePart(parts: readonly MessagePart[], idx: number | null): readonly MessagePart[] {
  if (idx === null) return parts;
  const part = parts[idx];
  if (!part || (part.type !== 'text' && part.type !== 'reasoning') || !part.streaming) return parts;
  const next = [...parts];
  next[idx] = { ...part, streaming: false };
  return next;
}

const closeOpenBlocks = (state: StreamTurnState): readonly MessagePart[] =>
  closePart(closePart(state.message.parts, state.openTextIndex), state.openReasoningIndex);

function upsertPart(
  parts: readonly MessagePart[],
  idx: number | null,
  part: MessagePart,
): { parts: MessagePart[]; index: number } {
  const next = [...parts];
  if (idx !== null) {
    next[idx] = part;
    return { parts: next, index: idx };
  }
  next.push(part);
  return { parts: next, index: next.length - 1 };
}

function buildEditorPatchesWidget(
  patches: readonly EditorPatchItem[],
  streaming: boolean,
): EditorPatchesWidget {
  return {
    type: 'editor_patches',
    title:
      patches.length === 1
        ? 'Proposed LaTeX Edit'
        : `Proposed LaTeX Edits (${patches.length})`,
    patches: [...patches],
    ...(streaming ? { streaming: true } : {}),
  };
}

function appendStreamDelta(
  state: StreamTurnState,
  kind: 'text' | 'reasoning',
  delta: string,
): StreamTurnState {
  const otherIdx = kind === 'text' ? state.openReasoningIndex : state.openTextIndex;
  const ownIdx = kind === 'text' ? state.openTextIndex : state.openReasoningIndex;
  const nextParts = [...closePart(state.message.parts, otherIdx)];
  let nextOwnIdx = ownIdx;

  if (nextOwnIdx !== null && nextParts[nextOwnIdx]?.type === kind) {
    const existing = nextParts[nextOwnIdx] as Extract<MessagePart, { type: 'text' | 'reasoning' }>;
    nextParts[nextOwnIdx] = { ...existing, text: existing.text + delta, streaming: true };
  } else {
    nextOwnIdx = nextParts.length;
    nextParts.push({ type: kind, text: delta, streaming: true });
  }

  return {
    ...state,
    message: {
      ...state.message,
      ...(kind === 'text' ? { content: state.message.content + delta } : {}),
      parts: nextParts,
    },
    openTextIndex: kind === 'text' ? nextOwnIdx : null,
    openReasoningIndex: kind === 'reasoning' ? nextOwnIdx : null,
  };
}

export function createStreamTurnState(messageId = createMessageId()): StreamTurnState {
  return {
    message: { id: messageId, role: 'assistant', content: '', parts: [] },
    error: null,
    openTextIndex: null,
    openReasoningIndex: null,
    openToolsByName: new Map(),
    activeHandoffIndices: [],
    streamedEditorPatches: [],
    metaWidgetsPartIndex: null,
    sourcesPartIndex: null,
    finalizedMetaWidgets: false,
    seq: 0,
  };
}

export function reduceStreamEvent(state: StreamTurnState, ev: AiStreamEvent): StreamTurnState {
  switch (ev.type) {
    case 'meta': {
      let parts: readonly MessagePart[] = state.message.parts;
      let sources = state.message.sources;
      let { sourcesPartIndex, metaWidgetsPartIndex, finalizedMetaWidgets } = state;
      let changed = Boolean(ev.agent && ev.agent !== state.message.agent);

      if (ev.sources?.length) {
        sources = ev.sources;
        ({ parts, index: sourcesPartIndex } = upsertPart(parts, sourcesPartIndex, {
          type: 'sources',
          sources: ev.sources,
        }));
        changed = true;
      }
      if (ev.widgets?.length) {
        finalizedMetaWidgets = true;
        ({ parts, index: metaWidgetsPartIndex } = upsertPart(parts, metaWidgetsPartIndex, {
          type: 'widgets',
          widgets: ev.widgets,
        }));
        changed = true;
      }

      if (!changed) return state;
      return {
        ...state,
        message: {
          ...state.message,
          parts: [...parts],
          sources,
          widgets: collectWidgets(parts),
          agent: ev.agent ?? state.message.agent,
        },
        sourcesPartIndex,
        metaWidgetsPartIndex,
        finalizedMetaWidgets,
      };
    }

    case 'reasoning-delta':
      return appendStreamDelta(state, 'reasoning', ev.delta);

    case 'text-delta':
      return appendStreamDelta(state, 'text', ev.delta);

    case 'thinking':
      return ev.agent && ev.agent !== state.message.agent
        ? { ...state, message: { ...state.message, agent: ev.agent } }
        : state;

    case 'agent-handoff': {
      const nextParts: MessagePart[] = [
        ...closeOpenBlocks(state),
        { type: 'agent-handoff', to: ev.to, parallel: ev.parallel, status: 'calling' },
      ];
      return {
        ...state,
        message: { ...state.message, parts: nextParts },
        openTextIndex: null,
        openReasoningIndex: null,
        activeHandoffIndices: [...state.activeHandoffIndices, nextParts.length - 1],
      };
    }

    case 'agent-done': {
      const idx = state.activeHandoffIndices.find((i) => {
        const p = state.message.parts[i];
        return p?.type === 'agent-handoff' && (!ev.agent || p.to.includes(ev.agent));
      });
      if (idx === undefined) return state;
      const existing = state.message.parts[idx];
      if (existing?.type !== 'agent-handoff') return state;
      const nextParts = [...state.message.parts];
      nextParts[idx] = { ...existing, status: ev.status === 'error' ? 'error' : 'done' };
      return {
        ...state,
        message: { ...state.message, parts: nextParts },
        activeHandoffIndices: state.activeHandoffIndices.filter((i) => i !== idx),
      };
    }

    case 'tool-start': {
      const seq = state.seq + 1;
      const nextParts: MessagePart[] = [
        ...closeOpenBlocks(state),
        {
          type: 'tool',
          toolCallId: `tool-${seq}`,
          toolName: ev.tool,
          agent: ev.agent,
          status: 'calling',
          input: ev.input,
        },
      ];
      const nextOpenTools = new Map(state.openToolsByName);
      nextOpenTools.set(ev.tool, [...(nextOpenTools.get(ev.tool) ?? []), nextParts.length - 1]);
      return {
        ...state,
        message: { ...state.message, parts: nextParts },
        openTextIndex: null,
        openReasoningIndex: null,
        openToolsByName: nextOpenTools,
        seq,
      };
    }

    case 'tool-end': {
      const nextParts = [...closeOpenBlocks(state)];
      const nextOpenTools = new Map(state.openToolsByName);
      const queue = [...(nextOpenTools.get(ev.tool) ?? [])];
      const openIdx = queue.shift();
      let seq = state.seq;

      if (openIdx !== undefined) {
        if (queue.length > 0) nextOpenTools.set(ev.tool, queue);
        else nextOpenTools.delete(ev.tool);
        const existing = nextParts[openIdx];
        if (existing?.type === 'tool') {
          nextParts[openIdx] = {
            ...existing,
            agent: ev.agent ?? existing.agent,
            status: ev.status === 'error' ? 'error' : 'done',
            output: ev.output,
            error: ev.error,
          };
        }
      } else {
        seq += 1;
        nextParts.push({
          type: 'tool',
          toolCallId: `tool-${seq}`,
          toolName: ev.tool,
          agent: ev.agent,
          status: ev.status === 'error' ? 'error' : 'done',
          output: ev.output,
          error: ev.error,
        });
      }

      const widgets = ev.widgets?.length ? ev.widgets : buildWidgetsFromToolOutput(ev.tool, ev.output);
      if (widgets.length > 0) nextParts.push({ type: 'widgets', widgets });

      return {
        ...state,
        message: { ...state.message, parts: nextParts, widgets: collectWidgets(nextParts) },
        openTextIndex: null,
        openReasoningIndex: null,
        openToolsByName: nextOpenTools,
        seq,
      };
    }

    case 'hitl-interrupt': {
      const nextParts: MessagePart[] = [
        ...closeOpenBlocks(state),
        { type: 'hitl', interruptId: ev.interruptId, interrupts: ev.interrupts, status: 'pending' },
      ];
      return {
        ...state,
        message: { ...state.message, parts: nextParts },
        openTextIndex: null,
        openReasoningIndex: null,
      };
    }

    case 'editor-patch-preview': {
      const nextPatches = [...state.streamedEditorPatches];
      const existingIdx = nextPatches.findIndex((p) => p.id === ev.patch.id);
      if (existingIdx >= 0) nextPatches[existingIdx] = ev.patch;
      else nextPatches.push(ev.patch);

      const { parts, index } = upsertPart(state.message.parts, state.metaWidgetsPartIndex, {
        type: 'widgets',
        widgets: [buildEditorPatchesWidget(nextPatches, true)],
      });
      return {
        ...state,
        message: { ...state.message, parts, widgets: collectWidgets(parts) },
        streamedEditorPatches: nextPatches,
        metaWidgetsPartIndex: index,
      };
    }

    case 'error': {
      const closed = closeOpenBlocks(state);
      return {
        ...state,
        message: closed === state.message.parts ? state.message : { ...state.message, parts: [...closed] },
        error: new Error(ev.message),
        openTextIndex: null,
        openReasoningIndex: null,
      };
    }

    case 'done':
      return state;
  }
}

export function finalizeStreamTurn(state: StreamTurnState): StreamTurnState {
  const closed = closeOpenBlocks(state);
  const nextParts: MessagePart[] = [...closed];
  let changed = closed !== state.message.parts;

  if (
    state.streamedEditorPatches.length > 0 &&
    !state.finalizedMetaWidgets &&
    state.metaWidgetsPartIndex !== null
  ) {
    nextParts[state.metaWidgetsPartIndex] = {
      type: 'widgets',
      widgets: [buildEditorPatchesWidget(state.streamedEditorPatches, false)],
    };
    changed = true;
  }

  for (const idx of state.activeHandoffIndices) {
    const part = nextParts[idx];
    if (part?.type === 'agent-handoff' && part.status === 'calling') {
      nextParts[idx] = { ...part, status: 'done' };
      changed = true;
    }
  }

  return {
    ...state,
    ...(changed
      ? { message: { ...state.message, parts: nextParts, widgets: collectWidgets(nextParts) } }
      : {}),
    openTextIndex: null,
    openReasoningIndex: null,
    activeHandoffIndices: [],
  };
}

function transitionHitlParts(
  messages: readonly FluxMessage[],
  fromStatus: 'pending' | 'submitting',
  toStatus: 'pending' | 'submitting' | 'approved' | 'rejected',
  reason?: string,
): { messages: readonly FluxMessage[]; changed: boolean } {
  let changed = false;
  const updated = messages.map((msg) => {
    if (!msg.parts.some((p) => p.type === 'hitl' && p.status === fromStatus)) return msg;
    changed = true;
    return {
      ...msg,
      parts: msg.parts.map((part) =>
        part.type === 'hitl' && part.status === fromStatus
          ? { ...part, status: toStatus, ...(reason !== undefined ? { reason } : {}) }
          : part,
      ),
    };
  });
  return { messages: changed ? updated : messages, changed };
}

export class FluxThreadEngine implements ThreadEngine {
  private readonly transport: AiTransportPort;
  private readonly listeners = new Set<() => void>();

  private threadKey: string;
  private chatId: string | null;
  private title = '';
  private activeAgent: string | null = null;
  private isLoadingHistory = false;
  private isStreamingTurn = false;
  private isCancelling = false;
  private error: Error | null = null;
  private mode: TurnMode;
  private spaceId: string | null;
  private documentIds: string[];
  private callbacks?: ThreadEngineCallbacks;

  private messages: readonly FluxMessage[] = [];
  private lastSubmitted?: { text: string; context?: TurnContext };
  private pendingHitlDecisionType: 'approve' | 'reject' = 'approve';
  private abortController: AbortController | null = null;
  private activeStreamPromise: Promise<void> | null = null;
  private activeRunId = 0;
  private cachedSnapshot: ThreadSnapshot;

  constructor(init: ThreadEngineInit, transport: AiTransportPort = fluxTransport) {
    this.transport = transport;
    this.threadKey = init.threadKey;
    this.chatId = init.chatId ?? null;
    this.spaceId = init.spaceId ?? null;
    this.mode = init.mode ?? 'chat';
    this.documentIds = init.documentIds ? [...init.documentIds] : [];
    this.callbacks = init.callbacks;
    this.cachedSnapshot = this.buildSnapshot();
  }

  getSnapshot(): ThreadSnapshot {
    return this.cachedSnapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async send(text: string, context?: TurnContext): Promise<void> {
    const trimmed = text.trim();
    const attachments = context?.attachments;
    if (!trimmed && !attachments?.length) return;

    if (context?.spaceId !== undefined) this.spaceId = context.spaceId ?? null;
    if (context?.chatId !== undefined) this.chatId = context.chatId ?? null;
    if (context?.mode) this.mode = context.mode;
    if (context?.documentIds) this.documentIds = [...context.documentIds];

    const effectiveContent = trimmed || `[Attached ${attachments?.length ?? 0} file(s)]`;
    this.lastSubmitted = { text: effectiveContent, context };
    this.error = null;
    this.isCancelling = false;

    const userMsg: FluxMessage = {
      id: createMessageId(),
      role: 'user',
      content: effectiveContent,
      parts: [{ type: 'text', text: effectiveContent, streaming: false }],
      ...(attachments?.length ? { attachments } : {}),
    };
    this.messages = [...this.messages, userMsg];

    const outgoing = this.messages.map(({ role, content, attachments: att }) => ({
      role,
      content,
      attachments: att,
    }));
    const ctx = context ?? {
      mode: this.mode,
      spaceId: this.spaceId,
      chatId: this.chatId,
      documentIds: this.documentIds,
    };

    await this.runStreamTurn((signal) =>
      this.transport.stream({
        messages: outgoing,
        context: {
          ...ctx,
          mode: ctx.mode ?? this.mode,
          spaceId: ctx.spaceId !== undefined ? ctx.spaceId : this.spaceId,
          chatId: ctx.chatId !== undefined ? ctx.chatId : this.chatId,
          documentIds: ctx.documentIds !== undefined ? ctx.documentIds : this.documentIds,
        },
        signal,
      }),
    );
  }

  async resume(decision: HitlDecision | HitlDecision[], spaceId?: string | null): Promise<void> {
    if (!this.chatId) throw new Error('Cannot resume HITL run without chatId');

    const list = Array.isArray(decision) ? decision : [decision];
    this.pendingHitlDecisionType = list[0]?.decision === 'reject' ? 'reject' : 'approve';
    const wireDecision = {
      decisions: list.map((d) => ({
        type: d.decision,
        ...(d.editedArgs ? { edited_action: { args: d.editedArgs } } : {}),
        ...(d.reason ? { message: d.reason } : {}),
      })),
    };

    this.messages = transitionHitlParts(this.messages, 'pending', 'submitting', list[0]?.reason).messages;
    this.error = null;
    this.rebuildAndNotify();

    const chatId = this.chatId;
    await this.runStreamTurn((signal) =>
      this.transport.resume({
        chatId,
        decision: wireDecision,
        spaceId: spaceId !== undefined ? spaceId : this.spaceId,
        documentIds: this.documentIds.length > 0 ? this.documentIds : undefined,
        signal,
      }),
    );
  }

  async stop(): Promise<void> {
    if (this.chatId) {
      this.isCancelling = true;
      this.rebuildAndNotify();
      void this.transport.cancel(this.chatId, this.spaceId);
    }
    this.abortController?.abort();
    try {
      await this.activeStreamPromise;
    } finally {
      this.isCancelling = false;
      this.isStreamingTurn = false;
      this.activeAgent = null;
      this.rebuildAndNotify();
    }
  }

  async retry(): Promise<void> {
    if (!this.lastSubmitted) return;
    this.error = null;
    const { text, context } = this.lastSubmitted;
    if (this.messages[this.messages.length - 1]?.role === 'user') {
      this.messages = this.messages.slice(0, -1);
    }
    await this.send(text, context);
  }

  reset(options?: { keepMeta?: boolean }): void {
    this.activeRunId += 1;
    this.abortController?.abort();
    this.abortController = null;
    this.messages = [];
    this.error = null;
    this.activeAgent = null;
    this.isStreamingTurn = false;
    this.isCancelling = false;
    this.isLoadingHistory = false;
    this.lastSubmitted = undefined;
    if (!options?.keepMeta) {
      this.chatId = null;
      this.title = '';
      this.documentIds = [];
    }
    this.rebuildAndNotify();
  }

  setLoadingHistory(loading: boolean): void {
    if (this.isLoadingHistory === loading) return;
    this.isLoadingHistory = loading;
    this.rebuildAndNotify();
  }

  setMeta(meta: {
    chatId?: string | null;
    title?: string;
    spaceId?: string | null;
    mode?: TurnMode;
    documentIds?: string[];
    callbacks?: ThreadEngineCallbacks;
  }): void {
    let changed = false;
    if (meta.chatId !== undefined && meta.chatId !== this.chatId) { this.chatId = meta.chatId; changed = true; }
    if (meta.title !== undefined && meta.title !== this.title) { this.title = meta.title; changed = true; }
    if (meta.spaceId !== undefined && meta.spaceId !== this.spaceId) { this.spaceId = meta.spaceId; changed = true; }
    if (meta.mode !== undefined && meta.mode !== this.mode) { this.mode = meta.mode; changed = true; }
    if (meta.documentIds !== undefined) {
      const docsChanged =
        meta.documentIds.length !== this.documentIds.length ||
        meta.documentIds.some((id, i) => id !== this.documentIds[i]);
      if (docsChanged) { this.documentIds = [...meta.documentIds]; changed = true; }
    }
    if (meta.callbacks !== undefined) this.callbacks = meta.callbacks;
    if (changed) this.rebuildAndNotify();
  }

  hydrateMessages(
    messages: FluxMessage[],
    meta?: { chatId?: string | null; title?: string; spaceId?: string | null; documentIds?: string[] },
  ): void {
    if (meta?.chatId !== undefined) this.chatId = meta.chatId;
    if (meta?.title !== undefined) this.title = meta.title;
    if (meta?.spaceId !== undefined) this.spaceId = meta.spaceId;
    if (meta?.documentIds !== undefined) this.documentIds = [...meta.documentIds];
    this.isLoadingHistory = false;
    this.error = null;
    this.messages = [...messages];
    this.rebuildAndNotify();
  }

  rebindKey(newKey: string): void {
    if (this.threadKey === newKey) return;
    this.threadKey = newKey;
    if (!this.chatId && !newKey.startsWith('draft:')) {
      this.chatId = newKey;
    }
    this.rebuildAndNotify();
  }

  async dispose(): Promise<void> {
    this.activeRunId += 1;
    this.abortController?.abort();
    this.abortController = null;
    this.listeners.clear();
  }

  private async runStreamTurn(
    openStream: (signal: AbortSignal) => Promise<StreamResult>,
  ): Promise<void> {
    const runId = ++this.activeRunId;
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;
    this.isStreamingTurn = true;
    this.rebuildAndNotify();

    const task = (async () => {
      let turnState = createStreamTurnState();
      let assistantIndex: number | null = null;
      let hasErrored = false;

      const commitAssistant = (msg: FluxMessage) => {
        if (assistantIndex === null) {
          assistantIndex = this.messages.length;
          this.messages = [...this.messages, msg];
        } else {
          const next = [...this.messages];
          next[assistantIndex] = msg;
          this.messages = next;
        }
      };

      const finalizeAssistant = () => {
        const prev = turnState.message;
        turnState = finalizeStreamTurn(turnState);
        if (turnState.message !== prev && assistantIndex !== null) {
          commitAssistant(turnState.message);
        }
      };

      try {
        const streamResult = await openStream(controller.signal);
        if (runId !== this.activeRunId) return;
        if (streamResult.chatIdHeader) this.handleMetaUpdate({ chatId: streamResult.chatIdHeader });

        for await (const ev of streamResult.events) {
          if (runId !== this.activeRunId || controller.signal.aborted) break;
          const prev = turnState.message;
          turnState = reduceStreamEvent(turnState, ev);

          if (ev.type === 'meta') {
            this.handleMetaUpdate({ chatId: ev.chatId, title: ev.title, agent: ev.agent });
          } else if (ev.type === 'thinking' && ev.agent) {
            this.handleMetaUpdate({ agent: ev.agent });
          }

          if (turnState.message !== prev) {
            commitAssistant(turnState.message);
            this.rebuildAndNotify();
          }
          if (turnState.error) {
            hasErrored = true;
            this.error = turnState.error;
            break;
          }
        }

        if (runId !== this.activeRunId) return;
        if (!hasErrored) {
          finalizeAssistant();
          const nextStatus = this.pendingHitlDecisionType === 'reject' ? 'rejected' : 'approved';
          this.messages = transitionHitlParts(this.messages, 'submitting', nextStatus).messages;
        } else {
          this.messages = transitionHitlParts(this.messages, 'submitting', 'pending').messages;
        }
      } catch (err) {
        if (runId !== this.activeRunId) return;
        if (isAbortError(err) || controller.signal.aborted) {
          finalizeAssistant();
        } else {
          this.error = err instanceof Error ? err : new Error(String(err));
          this.messages = transitionHitlParts(this.messages, 'submitting', 'pending').messages;
        }
      } finally {
        if (runId === this.activeRunId) {
          this.abortController = null;
          this.activeStreamPromise = null;
          this.isStreamingTurn = false;
          this.isCancelling = false;
          this.activeAgent = null;
          this.rebuildAndNotify();
          this.callbacks?.onTurnSettled?.(this.chatId, this.spaceId);
        }
      }
    })();

    this.activeStreamPromise = task;
    await task;
  }

  private handleMetaUpdate(meta: { chatId?: string; title?: string; agent?: string }): void {
    let changed = false;
    let newlyAssignedChatId: string | null = null;
    if (meta.chatId && meta.chatId !== this.chatId) {
      if (!this.chatId) newlyAssignedChatId = meta.chatId;
      this.chatId = meta.chatId;
      changed = true;
    }
    if (meta.title && meta.title !== this.title) { this.title = meta.title; changed = true; }
    if (meta.agent && meta.agent !== this.activeAgent) { this.activeAgent = meta.agent; changed = true; }
    if (changed) this.rebuildAndNotify();
    if (newlyAssignedChatId) {
      this.callbacks?.onChatCreated?.(newlyAssignedChatId, this.title || undefined);
    }
  }

  private buildSnapshot(): ThreadSnapshot {
    const pendingInterrupts = collectPendingInterrupts(this.messages);
    const status: ThreadStatus = this.isCancelling
      ? 'cancelling'
      : this.isStreamingTurn
        ? 'streaming'
        : pendingInterrupts.length > 0
          ? 'waiting_approval'
          : this.error
            ? 'error'
            : 'idle';

    return {
      threadKey: this.threadKey,
      chatId: this.chatId,
      title: this.title,
      status,
      isStreaming: status === 'streaming' || status === 'cancelling',
      isLoadingHistory: this.isLoadingHistory,
      messages: this.messages,
      activeAgent: this.activeAgent,
      pendingInterrupts,
      error: this.error,
      mode: this.mode,
      spaceId: this.spaceId,
      documentIds: this.documentIds,
    };
  }

  private rebuildAndNotify(): void {
    this.cachedSnapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => listener());
  }
}

export function createFluxThreadEngine(
  init: ThreadEngineInit,
  transport: AiTransportPort = fluxTransport,
): ThreadEngine {
  return new FluxThreadEngine(init, transport);
}
