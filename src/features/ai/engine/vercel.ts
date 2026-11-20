import { Chat } from '@ai-sdk/react';
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { fluxTransport } from '../transport/flux';
import type { AiTransportPort } from '../transport/transport.port';
import type { TurnContext, TurnMode } from '../types/context';
import type { AiStreamEvent } from '../types/event';
import type {
  EditorPatchItem,
  EditorPatchesWidget,
  FluxMessage,
  HitlDecision,
  HitlInterrupt,
  MessageAttachment,
  MessagePart,
  ResponseWidget,
  SourceItem,
} from '../types/message';
import type { ThreadStatus } from '../types/session';
import type {
  ThreadEngine,
  ThreadEngineCallbacks,
  ThreadEngineInit,
  ThreadSnapshot,
} from './engine.port';
import { buildWidgetsFromToolOutput } from './history';

type FluxDataParts = {
  tool: {
    toolCallId: string;
    toolName: string;
    agent?: string;
    status: 'calling' | 'done' | 'error';
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
  };
  handoff: {
    to: string;
    parallel?: boolean;
    status: 'calling' | 'done' | 'error';
  };
  hitl: {
    interruptId: string;
    interrupts: HitlInterrupt[];
    status: 'pending' | 'submitting' | 'approved' | 'rejected';
    reason?: string;
  };
  sources: {
    sources: SourceItem[];
  };
  widgets: {
    widgets: ResponseWidget[];
  };
  attachments: {
    attachments: MessageAttachment[];
  };
  meta: {
    chatId?: string;
    title?: string;
    agent?: string;
    intent?: string;
  };
};

interface FluxUIMetadata {
  agent?: string;
  createdAt?: string;
}

type FluxUIMessage = UIMessage<FluxUIMetadata, FluxDataParts>;

function toFluxMessages(uiMessages: FluxUIMessage[]): FluxMessage[] {
  return uiMessages.map((msg) => {
    const parts: MessagePart[] = [];
    const textSegments: string[] = [];
    let attachments: MessageAttachment[] | undefined;
    let sources: SourceItem[] | undefined;
    let widgets: ResponseWidget[] | undefined;

    for (const part of msg.parts) {
      if (part.type === 'text') {
        if (part.text || part.state === 'streaming') {
          parts.push({
            type: 'text',
            text: part.text,
            streaming: part.state === 'streaming',
          });
        }
        if (part.text) {
          textSegments.push(part.text);
        }
      } else if (part.type === 'reasoning') {
        if (part.text || part.state === 'streaming') {
          parts.push({
            type: 'reasoning',
            text: part.text,
            streaming: part.state === 'streaming',
          });
        }
      } else if (part.type === 'data-tool') {
        parts.push({
          type: 'tool',
          ...part.data,
        });
      } else if (part.type === 'data-handoff') {
        parts.push({
          type: 'agent-handoff',
          ...part.data,
        });
      } else if (part.type === 'data-hitl') {
        parts.push({
          type: 'hitl',
          ...part.data,
        });
      } else if (part.type === 'data-sources') {
        sources = part.data.sources;
        if (part.data.sources.length > 0) {
          parts.push({
            type: 'sources',
            sources: part.data.sources,
          });
        }
      } else if (part.type === 'data-widgets') {
        widgets = widgets
          ? [...widgets, ...part.data.widgets]
          : [...part.data.widgets];
        if (part.data.widgets.length > 0) {
          parts.push({
            type: 'widgets',
            widgets: part.data.widgets,
          });
        }
      } else if (part.type === 'data-attachments') {
        attachments = part.data.attachments;
      }
    }

    return {
      id: msg.id,
      role: msg.role,
      content: textSegments.join(''),
      parts,
      attachments,
      sources,
      widgets,
      agent: msg.metadata?.agent,
      createdAt: msg.metadata?.createdAt,
    };
  });
}

function toVercelMessages(messages: FluxMessage[]): FluxUIMessage[] {
  return messages.map((msg) => {
    const parts: FluxUIMessage['parts'] = [];

    if (msg.attachments && msg.attachments.length > 0) {
      parts.push({
        type: 'data-attachments',
        id: `att-${msg.id}`,
        data: { attachments: msg.attachments },
      });
    }

    if (msg.parts.length > 0) {
      for (let i = 0; i < msg.parts.length; i++) {
        const part = msg.parts[i];
        switch (part.type) {
          case 'reasoning':
            parts.push({
              type: 'reasoning',
              id: `r-${msg.id}-${i}`,
              text: part.text,
              state: part.streaming ? 'streaming' : 'done',
            });
            break;
          case 'text':
            parts.push({
              type: 'text',
              text: part.text,
              state: part.streaming ? 'streaming' : 'done',
            });
            break;
          case 'tool':
            parts.push({
              type: 'data-tool',
              id: part.toolCallId,
              data: {
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                agent: part.agent,
                status: part.status,
                input: part.input,
                output: part.output,
                error: part.error,
              },
            });
            break;
          case 'agent-handoff':
            parts.push({
              type: 'data-handoff',
              id: `handoff-${msg.id}-${i}`,
              data: {
                to: part.to,
                parallel: part.parallel,
                status: part.status,
              },
            });
            break;
          case 'hitl':
            parts.push({
              type: 'data-hitl',
              id: part.interruptId,
              data: {
                interruptId: part.interruptId,
                interrupts: part.interrupts,
                status: part.status,
                reason: part.reason,
              },
            });
            break;
          case 'sources':
            parts.push({
              type: 'data-sources',
              id: `sources-${msg.id}-${i}`,
              data: { sources: part.sources },
            });
            break;
          case 'widgets':
            parts.push({
              type: 'data-widgets',
              id: `widgets-${msg.id}-${i}`,
              data: { widgets: part.widgets },
            });
            break;
        }
      }
    } else if (msg.content) {
      parts.push({ type: 'text', text: msg.content, state: 'done' });
    }

    const metadata: FluxUIMetadata | undefined =
      msg.agent || msg.createdAt
        ? { agent: msg.agent, createdAt: msg.createdAt }
        : undefined;

    return {
      id: msg.id,
      role: msg.role,
      parts,
      ...(metadata ? { metadata } : {}),
    };
  });
}

function collectPendingInterrupts(messages: readonly FluxMessage[]): HitlInterrupt[] {
  const pending: HitlInterrupt[] = [];
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === 'hitl' && part.status === 'pending') {
        pending.push(...part.interrupts);
      }
    }
  }
  return pending;
}

function toReadableUiChunkStream(
  events: AsyncIterable<AiStreamEvent>,
  callbacks: {
    onMeta: (meta: { chatId?: string; title?: string; agent?: string }) => void;
    onInterrupt: (interrupts: HitlInterrupt[]) => void;
  },
): ReadableStream<UIMessageChunk<FluxUIMetadata, FluxDataParts>> {
  return new ReadableStream<UIMessageChunk<FluxUIMetadata, FluxDataParts>>({
    async start(controller) {
      const assistantMsgId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      let seq = 0;
      let openReasoningId: string | null = null;
      let openTextId: string | null = null;
      const openToolsByName = new Map<string, string[]>();
      const activeHandoffs = new Map<string, { to: string; parallel?: boolean }>();
      const streamedEditorPatches: EditorPatchItem[] = [];
      let finalizedMetaWidgets = false;
      let finishedByInterrupt = false;
      let hasErrored = false;

      const closeReasoning = () => {
        if (openReasoningId) {
          controller.enqueue({ type: 'reasoning-end', id: openReasoningId });
          openReasoningId = null;
        }
      };

      const closeText = () => {
        if (openTextId) {
          controller.enqueue({ type: 'text-end', id: openTextId });
          openTextId = null;
        }
      };

      const closeBlocks = () => {
        closeReasoning();
        closeText();
      };

      try {
        controller.enqueue({ type: 'start', messageId: assistantMsgId });

        for await (const ev of events) {
          switch (ev.type) {
            case 'meta': {
              callbacks.onMeta({
                chatId: ev.chatId,
                title: ev.title,
                agent: ev.agent,
              });
              if (ev.agent) {
                controller.enqueue({
                  type: 'message-metadata',
                  messageMetadata: { agent: ev.agent },
                });
              }
              controller.enqueue({
                type: 'data-meta',
                transient: true,
                data: {
                  chatId: ev.chatId,
                  title: ev.title,
                  agent: ev.agent,
                  intent: ev.intent,
                },
              });
              if (ev.sources && ev.sources.length > 0) {
                controller.enqueue({
                  type: 'data-sources',
                  id: 'sources',
                  data: { sources: ev.sources },
                });
              }
              if (ev.widgets && ev.widgets.length > 0) {
                finalizedMetaWidgets = true;
                controller.enqueue({
                  type: 'data-widgets',
                  id: 'widgets-meta',
                  data: { widgets: ev.widgets },
                });
              }
              break;
            }

            case 'reasoning-delta': {
              closeText();
              if (!openReasoningId) {
                openReasoningId = `reasoning-${++seq}`;
                controller.enqueue({ type: 'reasoning-start', id: openReasoningId });
              }
              controller.enqueue({
                type: 'reasoning-delta',
                id: openReasoningId,
                delta: ev.delta,
              });
              break;
            }

            case 'text-delta': {
              closeReasoning();
              if (!openTextId) {
                openTextId = `text-${++seq}`;
                controller.enqueue({ type: 'text-start', id: openTextId });
              }
              controller.enqueue({
                type: 'text-delta',
                id: openTextId,
                delta: ev.delta,
              });
              break;
            }

            case 'thinking': {
              if (ev.agent) {
                callbacks.onMeta({ agent: ev.agent });
                controller.enqueue({
                  type: 'message-metadata',
                  messageMetadata: { agent: ev.agent },
                });
              }
              break;
            }

            case 'agent-handoff': {
              closeBlocks();
              const handoffId = `handoff-${++seq}`;
              activeHandoffs.set(handoffId, {
                to: ev.to,
                parallel: ev.parallel,
              });
              controller.enqueue({
                type: 'data-handoff',
                id: handoffId,
                data: {
                  to: ev.to,
                  parallel: ev.parallel,
                  status: 'calling',
                },
              });
              break;
            }

            case 'agent-done': {
              const targetEntry = Array.from(activeHandoffs.entries()).find(
                ([, val]) => !ev.agent || val.to.includes(ev.agent),
              );
              if (targetEntry) {
                const [handoffId, info] = targetEntry;
                activeHandoffs.delete(handoffId);
                controller.enqueue({
                  type: 'data-handoff',
                  id: handoffId,
                  data: {
                    to: info.to,
                    parallel: info.parallel,
                    status: ev.status === 'error' ? 'error' : 'done',
                  },
                });
              }
              break;
            }

            case 'tool-start': {
              closeBlocks();
              const toolCallId = `tool-${++seq}`;
              const queue = openToolsByName.get(ev.tool) ?? [];
              queue.push(toolCallId);
              openToolsByName.set(ev.tool, queue);
              controller.enqueue({
                type: 'data-tool',
                id: toolCallId,
                data: {
                  toolCallId,
                  toolName: ev.tool,
                  agent: ev.agent,
                  status: 'calling',
                  input: ev.input,
                },
              });
              break;
            }

            case 'tool-end': {
              closeBlocks();
              const queue = openToolsByName.get(ev.tool);
              const toolCallId = queue?.shift() || `tool-${++seq}`;
              controller.enqueue({
                type: 'data-tool',
                id: toolCallId,
                data: {
                  toolCallId,
                  toolName: ev.tool,
                  agent: ev.agent,
                  status: ev.status === 'error' ? 'error' : 'done',
                  output: ev.output,
                  error: ev.error,
                },
              });

              const widgets =
                ev.widgets && ev.widgets.length > 0
                  ? ev.widgets
                  : buildWidgetsFromToolOutput(ev.tool, ev.output);
              if (widgets.length > 0) {
                controller.enqueue({
                  type: 'data-widgets',
                  id: `widgets-${toolCallId}`,
                  data: { widgets },
                });
              }
              break;
            }

            case 'hitl-interrupt': {
              closeBlocks();
              finishedByInterrupt = true;
              callbacks.onInterrupt(ev.interrupts);
              controller.enqueue({
                type: 'data-hitl',
                id: ev.interruptId,
                data: {
                  interruptId: ev.interruptId,
                  interrupts: ev.interrupts,
                  status: 'pending',
                },
              });
              break;
            }

            case 'editor-patch-preview': {
              const existingIdx = streamedEditorPatches.findIndex(
                (p) => p.id === ev.patch.id,
              );
              if (existingIdx >= 0) {
                streamedEditorPatches[existingIdx] = ev.patch;
              } else {
                streamedEditorPatches.push(ev.patch);
              }
              const liveWidget: EditorPatchesWidget = {
                type: 'editor_patches',
                title:
                  streamedEditorPatches.length === 1
                    ? 'Proposed LaTeX Edit'
                    : `Proposed LaTeX Edits (${streamedEditorPatches.length})`,
                patches: [...streamedEditorPatches],
                streaming: true,
              };
              controller.enqueue({
                type: 'data-widgets',
                id: 'widgets-meta',
                data: { widgets: [liveWidget] },
              });
              break;
            }

            case 'error': {
              closeBlocks();
              hasErrored = true;
              controller.enqueue({
                type: 'error',
                errorText: ev.message,
              });
              break;
            }

            case 'done': {
              break;
            }
          }

          if (hasErrored) {
            break;
          }
        }

        if (!hasErrored) {
          closeBlocks();
          if (streamedEditorPatches.length > 0 && !finalizedMetaWidgets) {
            controller.enqueue({
              type: 'data-widgets',
              id: 'widgets-meta',
              data: {
                widgets: [
                  {
                    type: 'editor_patches',
                    title:
                      streamedEditorPatches.length === 1
                        ? 'Proposed LaTeX Edit'
                        : `Proposed LaTeX Edits (${streamedEditorPatches.length})`,
                    patches: [...streamedEditorPatches],
                  },
                ],
              },
            });
          }
          for (const [handoffId, info] of activeHandoffs) {
            controller.enqueue({
              type: 'data-handoff',
              id: handoffId,
              data: {
                to: info.to,
                parallel: info.parallel,
                status: 'done',
              },
            });
          }
          controller.enqueue({
            type: 'finish',
            finishReason: finishedByInterrupt ? 'interrupted' : 'stop',
          });
        }
        controller.close();
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          try {
            controller.close();
          } catch {
            // Stream already closed
          }
          return;
        }
        controller.error(err);
      }
    },
  });
}

interface PendingResumeBody {
  __fluxResume?: {
    chatId: string;
    decision: unknown;
    spaceId?: string | null;
    pageId?: string | null;
    documentIds?: string[];
  };
}

export class VercelThreadEngine implements ThreadEngine {
  private readonly chat: Chat<FluxUIMessage>;
  private readonly transport: AiTransportPort;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribes: Array<() => void> = [];

  private threadKey: string;
  private chatId: string | null;
  private title = '';
  private activeAgent: string | null = null;
  private isLoadingHistory = false;
  private isCancelling = false;
  private mode: TurnMode;
  private spaceId: string | null;
  private pageId: string | null;
  private documentIds: string[];
  private callbacks?: ThreadEngineCallbacks;

  private pendingSendContext?: TurnContext;
  private lastSubmitted?: { text: string; context?: TurnContext };
  private pendingHitlDecisionType: 'approve' | 'reject' = 'approve';
  private cachedSnapshot: ThreadSnapshot;

  constructor(
    init: ThreadEngineInit,
    transport: AiTransportPort = fluxTransport,
  ) {
    this.transport = transport;
    this.threadKey = init.threadKey;
    this.chatId = init.chatId ?? null;
    this.pageId = init.pageId ?? null;
    this.spaceId = init.spaceId ?? null;
    this.mode = init.mode ?? 'chat';
    this.documentIds = init.documentIds ? [...init.documentIds] : [];
    this.callbacks = init.callbacks;

    const vercelTransport: ChatTransport<FluxUIMessage> = {
      sendMessages: async ({ messages, abortSignal }) => {
        const ctx = this.pendingSendContext ?? {
          mode: this.mode,
          spaceId: this.spaceId,
          chatId: this.chatId,
          documentIds: this.documentIds,
        };

        const fluxMsgs = toFluxMessages(messages).map(({ role, content, attachments }) => ({
          role,
          content,
          attachments,
        }));

        const streamResult = await this.transport.stream({
          messages: fluxMsgs,
          context: {
            ...ctx,
            mode: ctx.mode ?? this.mode,
            spaceId: ctx.spaceId !== undefined ? ctx.spaceId : this.spaceId,
            chatId: ctx.chatId !== undefined ? ctx.chatId : this.chatId,
            documentIds:
              ctx.documentIds !== undefined
                ? ctx.documentIds
                : this.documentIds,
            editor:
              ctx.editor ??
              (this.pageId ? { pageId: this.pageId } : undefined),
          },
          signal: abortSignal,
        });

        if (streamResult.chatIdHeader) {
          this.handleMetaUpdate({ chatId: streamResult.chatIdHeader });
        }

        return toReadableUiChunkStream(streamResult.events, {
          onMeta: (meta) => this.handleMetaUpdate(meta),
          onInterrupt: () => {
            this.rebuildAndNotify();
          },
        });
      },

      reconnectToStream: async ({ abortSignal, body }) => {
        const payload = (body as PendingResumeBody | undefined)?.__fluxResume;
        if (!payload) {
          return null;
        }

        const streamResult = await this.transport.resume({
          chatId: payload.chatId,
          decision: payload.decision,
          spaceId: payload.spaceId,
          pageId: payload.pageId,
          documentIds: payload.documentIds,
          signal: abortSignal,
        });

        if (streamResult.chatIdHeader) {
          this.handleMetaUpdate({ chatId: streamResult.chatIdHeader });
        }

        return toReadableUiChunkStream(streamResult.events, {
          onMeta: (meta) => this.handleMetaUpdate(meta),
          onInterrupt: () => {
            this.rebuildAndNotify();
          },
        });
      },
    };

    this.chat = new Chat<FluxUIMessage>({
      id: this.chatId ?? this.threadKey,
      transport: vercelTransport,
      onFinish: ({ isError }) => {
        this.finalizeSubmittingHitl(isError ? 'pending' : this.pendingHitlDecisionType === 'reject' ? 'rejected' : 'approved');
        this.activeAgent = null;
        this.isCancelling = false;
        this.rebuildAndNotify();
        this.callbacks?.onTurnSettled?.(this.chatId, this.spaceId);
      },
      onError: () => {
        this.finalizeSubmittingHitl('pending');
        this.isCancelling = false;
        this.rebuildAndNotify();
        this.callbacks?.onTurnSettled?.(this.chatId, this.spaceId);
      },
    });

    this.unsubscribes.push(
      this.chat['~registerMessagesCallback'](() => this.rebuildAndNotify()),
      this.chat['~registerStatusCallback'](() => this.rebuildAndNotify()),
      this.chat['~registerErrorCallback'](() => this.rebuildAndNotify()),
    );

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
    if (!trimmed && (!attachments || attachments.length === 0)) {
      return;
    }

    if (context?.spaceId !== undefined) {
      this.spaceId = context.spaceId ?? null;
    }
    if (context?.chatId !== undefined) {
      this.chatId = context.chatId ?? null;
    }
    if (context?.mode) {
      this.mode = context.mode;
    }
    if (context?.documentIds) {
      this.documentIds = [...context.documentIds];
    }

    const effectiveContent =
      trimmed || `[Attached ${attachments?.length ?? 0} file(s)]`;

    this.lastSubmitted = { text: effectiveContent, context };
    this.pendingSendContext = context;
    this.isCancelling = false;

    const parts: FluxUIMessage['parts'] = [
      { type: 'text', text: effectiveContent, state: 'done' },
      ...(attachments && attachments.length > 0
        ? [
            {
              type: 'data-attachments' as const,
              id: `att-user-${Date.now()}`,
              data: { attachments },
            },
          ]
        : []),
    ];

    try {
      await this.chat.sendMessage({
        role: 'user',
        parts,
      });
    } finally {
      this.pendingSendContext = undefined;
    }
  }

  async resume(
    decision: HitlDecision | HitlDecision[],
    spaceId?: string | null,
  ): Promise<void> {
    if (!this.chatId) {
      throw new Error('Cannot resume HITL run without chatId');
    }

    const list = Array.isArray(decision) ? decision : [decision];
    this.pendingHitlDecisionType =
      list[0]?.decision === 'reject' ? 'reject' : 'approve';

    const wireDecision = {
      decisions: list.map((d) => ({
        type: d.decision,
        ...(d.editedArgs ? { edited_action: { args: d.editedArgs } } : {}),
        ...(d.reason ? { message: d.reason } : {}),
      })),
    };

    // Transition pending HITL part into submitting state immediately
    const updatedMessages = this.chat.messages.map((msg) => ({
      ...msg,
      parts: msg.parts.map((part) => {
        if (part.type === 'data-hitl' && part.data.status === 'pending') {
          return {
            ...part,
            data: {
              ...part.data,
              status: 'submitting' as const,
              reason: list[0]?.reason,
            },
          };
        }
        return part;
      }),
    }));
    this.chat.messages = updatedMessages;
    this.rebuildAndNotify();

    await this.chat.resumeStream({
      body: {
        __fluxResume: {
          chatId: this.chatId,
          decision: wireDecision,
          spaceId: spaceId !== undefined ? spaceId : this.spaceId,
          pageId: this.pageId,
          documentIds:
            this.documentIds.length > 0 ? this.documentIds : undefined,
        },
      } satisfies PendingResumeBody,
    });
  }

  async stop(): Promise<void> {
    if (this.chatId) {
      this.isCancelling = true;
      this.rebuildAndNotify();
      void this.transport.cancel(this.chatId, this.spaceId);
    }
    try {
      await this.chat.stop();
    } finally {
      this.isCancelling = false;
      this.activeAgent = null;
      this.rebuildAndNotify();
    }
  }

  async retry(): Promise<void> {
    if (!this.lastSubmitted) return;
    this.chat.clearError();
    const { text, context } = this.lastSubmitted;
    // Remove last failed user message if no assistant reply succeeded after it
    const msgs = this.chat.messages;
    const last = msgs[msgs.length - 1];
    if (last?.role === 'user') {
      this.chat.messages = msgs.slice(0, -1);
    }
    await this.send(text, context);
  }

  reset(options?: { keepMeta?: boolean }): void {
    void this.chat.stop();
    this.chat.clearError();
    this.chat.messages = [];
    this.activeAgent = null;
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
    pageId?: string | null;
    mode?: TurnMode;
    documentIds?: string[];
    callbacks?: ThreadEngineCallbacks;
  }): void {
    let changed = false;
    if (meta.chatId !== undefined && meta.chatId !== this.chatId) {
      this.chatId = meta.chatId;
      changed = true;
    }
    if (meta.title !== undefined && meta.title !== this.title) {
      this.title = meta.title;
      changed = true;
    }
    if (meta.spaceId !== undefined && meta.spaceId !== this.spaceId) {
      this.spaceId = meta.spaceId;
      changed = true;
    }
    if (meta.pageId !== undefined && meta.pageId !== this.pageId) {
      this.pageId = meta.pageId;
      changed = true;
    }
    if (meta.mode !== undefined && meta.mode !== this.mode) {
      this.mode = meta.mode;
      changed = true;
    }
    if (meta.documentIds !== undefined) {
      const docsChanged =
        meta.documentIds.length !== this.documentIds.length ||
        meta.documentIds.some((id, idx) => id !== this.documentIds[idx]);
      if (docsChanged) {
        this.documentIds = [...meta.documentIds];
        changed = true;
      }
    }
    if (meta.callbacks !== undefined) {
      this.callbacks = meta.callbacks;
    }
    if (changed) {
      this.rebuildAndNotify();
    }
  }

  hydrateMessages(
    messages: FluxMessage[],
    meta?: {
      chatId?: string | null;
      title?: string;
      spaceId?: string | null;
      documentIds?: string[];
    },
  ): void {
    if (meta?.chatId !== undefined) this.chatId = meta.chatId;
    if (meta?.title !== undefined) this.title = meta.title;
    if (meta?.spaceId !== undefined) this.spaceId = meta.spaceId;
    if (meta?.documentIds !== undefined) {
      this.documentIds = [...meta.documentIds];
    }
    this.isLoadingHistory = false;
    this.chat.clearError();
    this.chat.messages = toVercelMessages(messages);
    this.rebuildAndNotify();
  }

  rebindKey(newKey: string): void {
    if (this.threadKey === newKey) return;
    this.threadKey = newKey;
    if (!this.chatId && !newKey.startsWith('draft:') && !newKey.startsWith('page:')) {
      this.chatId = newKey;
    }
    this.rebuildAndNotify();
  }

  async dispose(): Promise<void> {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes.length = 0;
    this.listeners.clear();
    await this.chat.dispose();
  }

  private handleMetaUpdate(meta: {
    chatId?: string;
    title?: string;
    agent?: string;
  }): void {
    let changed = false;
    let newlyAssignedChatId: string | null = null;

    if (meta.chatId && meta.chatId !== this.chatId) {
      const wasDraft = !this.chatId;
      this.chatId = meta.chatId;
      changed = true;
      if (wasDraft) {
        newlyAssignedChatId = meta.chatId;
      }
    }
    if (meta.title && meta.title !== this.title) {
      this.title = meta.title;
      changed = true;
    }
    if (meta.agent && meta.agent !== this.activeAgent) {
      this.activeAgent = meta.agent;
      changed = true;
    }

    if (changed) {
      this.rebuildAndNotify();
    }
    if (newlyAssignedChatId) {
      this.callbacks?.onChatCreated?.(newlyAssignedChatId, this.title || undefined);
    }
  }

  private finalizeSubmittingHitl(
    nextStatus: 'pending' | 'approved' | 'rejected',
  ): void {
    let touched = false;
    const updated = this.chat.messages.map((msg) => {
      const hasSubmitting = msg.parts.some(
        (p) => p.type === 'data-hitl' && p.data.status === 'submitting',
      );
      if (!hasSubmitting) return msg;
      touched = true;
      return {
        ...msg,
        parts: msg.parts.map((part) =>
          part.type === 'data-hitl' && part.data.status === 'submitting'
            ? { ...part, data: { ...part.data, status: nextStatus } }
            : part,
        ),
      };
    });
    if (touched) {
      this.chat.messages = updated;
    }
  }

  private resolveStatus(
    fluxMessages: readonly FluxMessage[],
    pendingInterrupts: readonly HitlInterrupt[],
  ): ThreadStatus {
    if (this.isCancelling) return 'cancelling';
    if (
      this.chat.status === 'submitted' ||
      this.chat.status === 'streaming'
    ) {
      return 'streaming';
    }
    if (pendingInterrupts.length > 0) {
      return 'waiting_approval';
    }
    if (this.chat.status === 'error') {
      return 'error';
    }
    void fluxMessages;
    return 'idle';
  }

  private buildSnapshot(): ThreadSnapshot {
    const fluxMessages = toFluxMessages(this.chat.messages);
    const pendingInterrupts = collectPendingInterrupts(fluxMessages);
    const status = this.resolveStatus(fluxMessages, pendingInterrupts);

    return {
      threadKey: this.threadKey,
      chatId: this.chatId,
      title: this.title,
      status,
      isStreaming: status === 'streaming' || status === 'cancelling',
      isLoadingHistory: this.isLoadingHistory,
      messages: fluxMessages,
      activeAgent: this.activeAgent,
      pendingInterrupts,
      error: this.chat.error ?? null,
      mode: this.mode,
      spaceId: this.spaceId,
      pageId: this.pageId,
      documentIds: this.documentIds,
    };
  }

  private rebuildAndNotify(): void {
    this.cachedSnapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => listener());
  }
}

export function createVercelThreadEngine(
  init: ThreadEngineInit,
  transport: AiTransportPort = fluxTransport,
): ThreadEngine {
  return new VercelThreadEngine(init, transport);
}
