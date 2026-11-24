import type { TurnContext, TurnMode } from '../types/context';
import type { FluxMessage, HitlDecision, HitlInterrupt } from '../types/message';
import type { ThreadStatus } from '../types/session';

export interface ThreadSnapshot {
  readonly threadKey: string;
  readonly chatId: string | null;
  readonly title: string;
  readonly status: ThreadStatus;
  readonly isStreaming: boolean;
  readonly isLoadingHistory: boolean;
  readonly messages: readonly FluxMessage[];
  readonly activeAgent: string | null;
  readonly pendingInterrupts: readonly HitlInterrupt[];
  readonly error: Error | null;
  readonly mode: TurnMode;
  readonly spaceId: string | null;
  readonly documentIds: readonly string[];
}

export interface ThreadEngineCallbacks {
  onChatCreated?: (chatId: string, title?: string) => void;
  onTurnSettled?: (chatId: string | null, spaceId: string | null) => void;
}

export interface ThreadEngineInit {
  threadKey: string;
  chatId?: string | null;
  spaceId?: string | null;
  mode?: TurnMode;
  documentIds?: string[];
  callbacks?: ThreadEngineCallbacks;
}

export interface ThreadEngine {
  getSnapshot(): ThreadSnapshot;
  subscribe(listener: () => void): () => void;
  send(text: string, context?: TurnContext): Promise<void>;
  resume(decision: HitlDecision | HitlDecision[], spaceId?: string | null): Promise<void>;
  stop(): Promise<void>;
  retry(): Promise<void>;
  reset(options?: { keepMeta?: boolean }): void;
  setLoadingHistory(loading: boolean): void;
  setMeta(meta: {
    chatId?: string | null;
    title?: string;
    spaceId?: string | null;
    mode?: TurnMode;
    documentIds?: string[];
    callbacks?: ThreadEngineCallbacks;
  }): void;
  hydrateMessages(
    messages: FluxMessage[],
    meta?: { chatId?: string | null; title?: string; spaceId?: string | null; documentIds?: string[] },
  ): void;
  rebindKey(newKey: string): void;
  dispose(): Promise<void>;
}
