import { z } from 'zod';
import type { FluxMessageRole, MessageAttachment, ResponseWidget, SourceItem, AgentAction } from './message';

export const sourceItemSchema = z.object({
  id: z.string().optional(),
  source: z.string().optional(),
  snippet: z.string().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  page: z.number().optional(),
  authors: z.string().optional(),
  year: z.union([z.number(), z.string()]).optional(),
  sourceType: z.string().optional(),
});

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

export const workItemItemSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  isOverdue: z.boolean().optional(),
  completed: z.boolean().optional(),
  project: z
    .object({
      name: z.string(),
      avatar: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export const workItemOverviewWidgetSchema = z.object({
  type: z.literal('work_item_overview'),
  title: z.string(),
  subtitle: z.string().optional(),
  total: z.number(),
  done: z.number(),
  inProgress: z.number(),
  overdue: z.number(),
  groups: z.array(
    z.object({
      label: z.string(),
      workItems: z.array(workItemItemSchema),
    }),
  ),
});

export const metricSummaryWidgetSchema = z.object({
  type: z.literal('metric_summary'),
  title: z.string(),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      tone: z.enum(['default', 'good', 'warn', 'bad']).optional(),
    }),
  ),
});

export const responseWidgetSchema = z.discriminatedUnion('type', [
  workItemOverviewWidgetSchema,
  metricSummaryWidgetSchema,
]);

export const chatSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  spaceId: z.string().nullish(),
  projectId: z.string().nullable().optional(),
  messageCount: z.number().optional(),
  lastMessage: z.string().optional(),
  updatedAt: z.string(),
  createdAt: z.string().optional(),
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

export const chatSessionDetailSchema = chatSessionSchema.extend({
  messages: z.array(z.unknown()),
  documentIds: z.array(z.string()).default([]),
});

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

export interface CreateChatSessionInput {
  title: string;
  spaceId?: string | null;
  messages?: StoredChatMessage[];
  documentIds?: string[];
}

export const documentItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  chunk_count: z.number().optional(),
  tags: z.array(z.string()).default([]),
  type: z.string().optional(),
  size: z.number().optional(),
  created_at: z.string().optional(),
  user_id: z.string().optional(),
  chat_id: z.string().optional(),
});

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
