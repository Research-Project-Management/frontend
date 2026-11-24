import { z } from 'zod';
import type { FluxMessageRole, MessageAttachment, ResponseWidget, SourceItem, AgentAction } from './message';

export const messageAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().optional(),
  type: z.string().optional(),
  sourceType: z
    .enum(['library', 'upload', 'paper', 'storage'])
    .transform((v) => (v === 'storage' ? 'upload' : v))
    .optional(),
  itemId: z.string().optional(),
  fileId: z.string().optional(),
  hasPdf: z.boolean().optional(),
  indexed: z.boolean().optional(),
});

export interface StoredChatMessage {
  id?: string;
  role: FluxMessageRole;
  content: string;
  attachments?: MessageAttachment[];
  sources?: SourceItem[];
  actions?: AgentAction[];
  widgets?: ResponseWidget[];
  agent?: string;
  createdAt?: string;
  parts?: unknown[];
}

export interface ChatSession {
  id: string;
  title: string;
  spaceId?: string | null;
  projectId?: string | null;
  messageCount?: number;
  lastMessage?: string;
  updatedAt: string;
  createdAt?: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: StoredChatMessage[];
  documentIds: string[];
}

export interface DocumentItem {
  id: string;
  title: string;
  chunk_count: number;
  tags: string[];
  type?: string;
  size?: number;
  created_at?: string;
  user_id?: string;
  chat_id?: string;
}

export type KnownAgentId =
  | 'rag_agent'
  | 'web_search_agent'
  | 'library_agent'
  | 'editor_agent'
  | 'project_agent'
  | 'direct';

export type ThreadStatus =
  | 'idle'
  | 'streaming'
  | 'waiting_approval'
  | 'cancelling'
  | 'error';
