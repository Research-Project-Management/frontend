import type { TurnContext } from '../types/context';
import type { AiStreamEvent } from '../types/event';
import type { FluxMessage } from '../types/message';

export interface StreamRequest {
  messages: Pick<FluxMessage, 'role' | 'content' | 'attachments'>[];
  context: TurnContext;
  signal?: AbortSignal;
}

export interface ResumeRequest {
  chatId: string;
  decision: unknown;
  spaceId?: string | null;
  documentIds?: string[];
  signal?: AbortSignal;
}

export interface StreamResult {
  chatIdHeader?: string | null;
  events: AsyncIterable<AiStreamEvent>;
}

export interface AiTransportPort {
  stream(request: StreamRequest): Promise<StreamResult>;
  resume(request: ResumeRequest): Promise<StreamResult>;
  cancel(chatId: string, spaceId?: string | null): Promise<void>;
}
