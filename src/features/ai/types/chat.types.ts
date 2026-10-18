import { z } from 'zod';
import {
  sourceItemSchema,
  messageAttachmentSchema,
  workItemItemSchema,
  workItemOverviewWidgetSchema,
  metricSummaryWidgetSchema,
  responseWidgetSchema,
  chatMessageSchema,
  chatSessionSchema,
  chatSessionDetailSchema,
  createChatSessionSchema,
  agentActionSchema,
  agentIdSchema,
} from '../schemas/chat.schema';

// ── Inferred Types from Zod ───────────────────────────────────────────────────

export type SourceItem = z.infer<typeof sourceItemSchema>;
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;
export type WorkItemItem = z.infer<typeof workItemItemSchema>;
export type WorkItemOverviewWidget = z.infer<typeof workItemOverviewWidgetSchema>;
export type MetricSummaryWidget = z.infer<typeof metricSummaryWidgetSchema>;
export type ResponseWidget = z.infer<typeof responseWidgetSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatSession = z.infer<typeof chatSessionSchema>;
export type ChatSessionDetail = z.infer<typeof chatSessionDetailSchema>;
export type CreateChatSessionInput = z.infer<typeof createChatSessionSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;
export type AgentId = z.infer<typeof agentIdSchema>;

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

// ── Domain Specific Interfaces ───────────────────────────────────────────────

/** A source document managed in the Sources panel (NotebookLM-style). */
export interface SourceDoc {
  id: string;
  name: string;
  enabled: boolean;
}

/** Legacy request format (still supported by proxy) */
export interface ChatRequest {
  session_id: string;
  query: string;
  enable_web_search?: boolean;
  use_system_knowledge?: boolean;
  selected_files?: string[];
}

/** Agent output from ai */
export interface AgentOutput {
  agent_name: string;
  content: string;
  sources: Array<{ source: string; score: number }>;
  metadata: Record<string, unknown>;
}

/** Response type identifiers for SSE events */
export interface ChatTypeResponse {
  type: 'answer' | 'trace';
}

export interface ChatAnswerResponse {
  type: 'answer';
  content: string;
}

export interface ChatTraceResponse {
  type: 'trace';
  step: number;
  node: string;
  description: string;
  details: object;
}

/** Tool category for color coding */
export type ToolCategory = 'read' | 'create' | 'update' | 'delete' | 'analyze';

/** Pretty labels for tools displayed in ActionCard */
export const TOOL_LABELS: Record<string, { label: string; icon: string; category: ToolCategory }> = {
  // ─── Work item management ────────────────────────────────────────────────
  list_work_items:             { label: 'Listing Work Items',      icon: 'list-todo', category: 'read' },
  get_my_work_items:           { label: 'Getting My Work Items',   icon: 'list-todo', category: 'read' },
  summarize_member_work_items: { label: 'Summarizing Workload',    icon: 'bar-chart-3', category: 'analyze' },
  create_work_item:            { label: 'Creating Work Item',      icon: 'plus', category: 'create' },
  update_work_item:            { label: 'Updating Work Item',      icon: 'pencil', category: 'update' },
  delete_work_item:            { label: 'Deleting Work Item',      icon: 'trash-2', category: 'delete' },
  list_tasks:                  { label: 'Listing Work Items',      icon: 'list-todo', category: 'read' },
  get_my_tasks:                { label: 'Getting My Work Items',   icon: 'list-todo', category: 'read' },
  summarize_member_tasks:      { label: 'Summarizing Workload',    icon: 'bar-chart-3', category: 'analyze' },

  // ─── Projects ─────────────────────────────────────────────────────────────
  list_projects:          { label: 'Listing Projects',        icon: 'folder-kanban', category: 'read' },
  get_project_overview:   { label: 'Project Overview',        icon: 'bar-chart-3', category: 'read' },
  get_project_details:    { label: 'Project Details',         icon: 'folder-kanban', category: 'read' },
  update_project:         { label: 'Updating Project',        icon: 'pencil', category: 'update' },
  add_project_member:     { label: 'Adding Member',           icon: 'user', category: 'create' },
  remove_project_member:  { label: 'Removing Member',         icon: 'user', category: 'delete' },
  update_member_role:     { label: 'Updating Role',           icon: 'shield', category: 'update' },

  // ─── Research & RAG ────────────────────────────────────────────────────────
  search_documents:       { label: 'Searching Documents',     icon: 'search', category: 'read' },
  web_search:             { label: 'Searching Web',           icon: 'globe', category: 'read' },

  // ─── Workspace ────────────────────────────────────────────────────────────
  search_workspace:       { label: 'Searching',               icon: 'search', category: 'read' },
  list_members:           { label: 'Listing Members',         icon: 'users', category: 'read' },
  get_workspace_overview: { label: 'Workspace Overview',      icon: 'home', category: 'read' },
  get_workspace_activity: { label: 'Activity Feed',           icon: 'activity', category: 'read' },

  // ─── Pages ────────────────────────────────────────────────────────────────
  list_pages:             { label: 'Listing Pages',           icon: 'file-text', category: 'read' },
  list_workspace_pages:   { label: 'Workspace Pages',         icon: 'file-text', category: 'read' },
  get_page_content:       { label: 'Reading Page',            icon: 'book-open', category: 'read' },
  get_page_versions:      { label: 'Page History',            icon: 'clock', category: 'read' },
  create_page:            { label: 'Creating Page',           icon: 'file-plus', category: 'create' },
  update_page:            { label: 'Updating Page',           icon: 'pencil', category: 'update' },
  delete_page:            { label: 'Deleting Page',           icon: 'trash-2', category: 'delete' },

  // ─── Labels ─────────────────────────────────────────────────────────────────
  list_labels:            { label: 'Listing Labels',          icon: 'tag', category: 'read' },
  create_label:           { label: 'Creating Label',          icon: 'tag', category: 'create' },
  delete_label:           { label: 'Deleting Label',          icon: 'trash-2', category: 'delete' },

  // ─── Stickies ─────────────────────────────────────────────────────────────
  list_stickies:          { label: 'Listing Stickies',        icon: 'pin', category: 'read' },
  create_sticky:          { label: 'Creating Sticky',         icon: 'pin', category: 'create' },
  update_sticky:          { label: 'Updating Sticky',         icon: 'pencil', category: 'update' },
  delete_sticky:          { label: 'Deleting Sticky',         icon: 'trash-2', category: 'delete' },

  // ─── Comments ─────────────────────────────────────────────────────────────
  get_work_item_comments: { label: 'Work Item Comments',      icon: 'message-square', category: 'read' },
  add_work_item_comment:  { label: 'Adding Comment',          icon: 'message-square', category: 'create' },
  get_page_comments:      { label: 'Page Comments',           icon: 'message-square', category: 'read' },
  add_page_comment:       { label: 'Adding Comment',          icon: 'message-square', category: 'create' },

  // ─── Users ────────────────────────────────────────────────────────────────
  get_current_user:       { label: 'Current User',            icon: 'user', category: 'read' },
  search_users:           { label: 'Searching Users',         icon: 'search', category: 'read' },

  // ─── Analysis ─────────────────────────────────────────────────────────────
  get_workload_distribution: { label: 'Workload Analysis',    icon: 'bar-chart-3', category: 'analyze' },
  get_overdue_report:        { label: 'Overdue Report',       icon: 'alert-triangle', category: 'analyze' },
  get_project_velocity:      { label: 'Project Velocity',     icon: 'trending-up', category: 'analyze' },
  generate_team_summary:     { label: 'Team Summary',         icon: 'users', category: 'analyze' },
};

/** Color scheme per tool category */
export const TOOL_CATEGORY_COLORS: Record<ToolCategory, string> = {
  read:    'text-primary',
  create:  'text-success',
  update:  'text-warning',
  delete:  'text-destructive',
  analyze: 'text-primary',
};

// ── Agent Configuration ─────────────────────────────────────────────────────────

export interface AgentConfig {
  id: AgentId;
  label: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  quickPrompts: string[];
}

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 'action',
    label: 'Action',
    description: 'Manage work items, projects, and pages in your workspace',
    icon: '',
    color: 'text-ai',
    bg: 'bg-ai/10 hover:bg-ai/15',
    border: 'border-ai/20',
    quickPrompts: [
      'Show my work items',
      'Show project overview',
      'Who\'s in my team?',
      'Create a new work item',
      'What happened recently?',
    ],
  },
  {
    id: 'rag',
    label: 'Documents',
    description: 'Search and summarize your uploaded files',
    icon: '',
    color: 'text-ai',
    bg: 'bg-ai/10 hover:bg-ai/15',
    border: 'border-ai/20',
    quickPrompts: [
      'Summarize this document',
      'What are the key findings?',
      'Explain the methodology',
    ],
  },
  {
    id: 'analyze',
    label: 'Analyze',
    description: 'Review data and research papers',
    icon: '',
    color: 'text-success',
    bg: 'bg-success/8 hover:bg-success/14',
    border: 'border-success/25',
    quickPrompts: [
      'Compare these papers',
      'Analyze the data',
      'Review strengths & weaknesses',
    ],
  },
  {
    id: 'latex',
    label: 'LaTeX',
    description: 'Generate equations, tables, and templates',
    icon: '',
    color: 'text-warning',
    bg: 'bg-warning/8 hover:bg-warning/14',
    border: 'border-warning/25',
    quickPrompts: [
      'Generate an equation',
      'Create a table',
      'Write a document template',
    ],
  },
  {
    id: 'web_search',
    label: 'Web Search',
    description: 'Search academic and general web sources',
    icon: '',
    color: 'text-ai',
    bg: 'bg-ai/10 hover:bg-ai/15',
    border: 'border-ai/20',
    quickPrompts: [
      'Find papers on...',
      'Latest research in...',
      'Search arXiv for...',
    ],
  },
  {
    id: 'work_item',
    label: 'Work Item Planner',
    description: 'Break down work into actionable work items',
    icon: '',
    color: 'text-destructive',
    bg: 'bg-destructive/8 hover:bg-destructive/14',
    border: 'border-destructive/25',
    quickPrompts: [
      'Plan a research sprint',
      'Break down this feature',
      'Suggest next steps',
    ],
  },
  {
    id: 'chat',
    label: 'Chat',
    description: 'General conversational AI',
    icon: '',
    color: 'text-muted-foreground',
    bg: 'bg-muted hover:bg-muted',
    border: 'border-border',
    quickPrompts: [
      'Explain this concept',
      'Help me think through...',
    ],
  },
];
