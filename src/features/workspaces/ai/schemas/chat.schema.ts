import { z } from 'zod';

export const sourceItemSchema = z.object({
  source: z.string().optional(),
  snippet: z.string().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  authors: z.string().optional(),
  year: z.number().optional(),
});

export const taskItemSchema = z.object({
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

export const taskOverviewWidgetSchema = z.object({
  type: z.literal('task_overview'),
  title: z.string(),
  subtitle: z.string().optional(),
  total: z.number(),
  done: z.number(),
  inProgress: z.number(),
  overdue: z.number(),
  groups: z.array(
    z.object({
      label: z.string(),
      tasks: z.array(taskItemSchema),
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
  taskOverviewWidgetSchema,
  metricSummaryWidgetSchema,
]);

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  sources: z.array(sourceItemSchema).optional(),
  widgets: z.array(responseWidgetSchema).optional(),
  selectionContext: z
    .object({
      filename: z.string(),
      startLine: z.number(),
      endLine: z.number(),
      text: z.string().optional(),
    })
    .optional(),
});

export const chatSessionSchema = z.object({
  _id: z.string(),
  title: z.string(),
  projectId: z.string().nullable(),
  messageCount: z.number(),
  lastMessage: z.string(),
  updatedAt: z.string(),
  createdAt: z.string(),
});

export const chatSessionDetailSchema = chatSessionSchema.extend({
  messages: z.array(
    chatMessageSchema.extend({
      _id: z.string(),
      createdAt: z.string(),
    }),
  ),
  documentIds: z.array(z.string()),
});

export const createChatSessionSchema = z.object({
  workspaceId: z.string(),
  title: z.string(),
  projectId: z.string().optional(),
  messages: z.array(chatMessageSchema),
  documentIds: z.array(z.string()).optional(),
});

export const agentActionSchema = z.object({
  type: z.enum(['tool_start', 'tool_end', 'tool_call', 'agent_handoff', 'agent_done', 'thinking']),
  tool: z.string().optional(),
  agent: z.string().optional(),
  status: z.enum(['calling', 'done', 'error']).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  needs_confirm: z.boolean().optional(),
  error: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  parallel: z.boolean().optional(),
  request: z.string().optional(),
  success: z.boolean().optional(),
});

export const agentIdSchema = z.enum([
  'action',
  'rag',
  'analyze',
  'latex',
  'web_search',
  'chat',
  'task',
]);
