export type FluxMessageRole = 'user' | 'assistant' | 'system';

export interface MessageAttachment {
  id: string;
  name: string;
  size?: number;
  type?: string;
  sourceType?: 'library' | 'upload' | 'paper';
  itemId?: string;
  fileId?: string;
  hasPdf?: boolean;
  indexed?: boolean;
}

export interface SourceItem {
  index?: number;
  id?: string;
  source?: string;
  title?: string;
  url?: string;
  snippet?: string;
  page?: number;
  authors?: string;
  year?: string | number;
  sourceType?: string;
}

export interface HitlInterrupt {
  id: string;
  tool?: string;
  description?: string;
  args?: Record<string, unknown>;
  allowedDecisions?: Array<'approve' | 'reject' | 'edit'>;
  raw?: unknown;
}

export interface HitlDecision {
  decision: 'approve' | 'reject' | 'edit';
  interruptId?: string;
  editedArgs?: Record<string, unknown>;
  reason?: string;
}

export interface WorkItemItem {
  id?: string;
  title: string;
  priority?: string;
  assignee?: string;
  dueDate?: string | null;
  isOverdue?: boolean;
  completed?: boolean;
  project?: {
    name: string;
    avatar?: string;
  } | null;
}

export interface WorkItemOverviewWidget {
  type: 'work_item_overview';
  title: string;
  subtitle?: string;
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  groups: Array<{
    label: string;
    workItems: WorkItemItem[];
  }>;
}

export interface MetricSummaryWidget {
  type: 'metric_summary';
  title: string;
  metrics: Array<{
    label: string;
    value: string | number;
    tone?: 'default' | 'good' | 'warn' | 'bad';
  }>;
}

export interface EditorPatchItem {
  id: string;
  fileId?: string | null;
  filePath: string;
  kind?: 'replace' | 'insert_preamble' | 'insert_after' | 'insert_before';
  title: string;
  rationale?: string;
  searchText: string;
  replaceText: string;
  fromLine?: number;
  toLine?: number;
  matchStrategy?: 'exact' | 'normalized_whitespace' | 'preamble';
  warnings?: string[];
}

export interface ProvenanceItem {
  repo: string;
  path: string;
  commitSha: string;
  url: string;
}

export interface EditorPatchesWidget {
  type: 'editor_patches';
  title: string;
  patches: EditorPatchItem[];
  provenance?: ProvenanceItem[];
  streaming?: boolean;
}

export type ResponseWidget =
  | WorkItemOverviewWidget
  | MetricSummaryWidget
  | EditorPatchesWidget;

export interface AgentAction {
  type:
    | 'tool_start'
    | 'tool_end'
    | 'tool_call'
    | 'agent_handoff'
    | 'agent_done'
    | 'thinking';
  tool?: string;
  agent?: string;
  status?: 'calling' | 'done' | 'error';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  needs_confirm?: boolean;
  error?: string;
  from?: string;
  to?: string;
  parallel?: boolean;
  request?: string;
  success?: boolean;
  count?: number;
  action?: string;
  widgets?: ResponseWidget[];
}

export type MessagePart =
  | { type: 'text'; text: string; streaming?: boolean }
  | { type: 'reasoning'; text: string; streaming?: boolean }
  | {
      type: 'tool';
      toolCallId: string;
      toolName: string;
      agent?: string;
      status: 'calling' | 'done' | 'error';
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      error?: string;
    }
  | {
      type: 'agent-handoff';
      to: string;
      parallel?: boolean;
      status: 'calling' | 'done' | 'error';
    }
  | {
      type: 'hitl';
      interruptId: string;
      interrupts: HitlInterrupt[];
      status: 'pending' | 'submitting' | 'approved' | 'rejected';
      reason?: string;
    }
  | { type: 'sources'; sources: SourceItem[] }
  | { type: 'widgets'; widgets: ResponseWidget[] };

export interface SelectionContextSnapshot {
  filename: string;
  startLine: number;
  endLine: number;
  text?: string;
}

export interface FluxMessage {
  id: string;
  role: FluxMessageRole;
  content: string;
  parts: MessagePart[];
  attachments?: MessageAttachment[];
  sources?: SourceItem[];
  actions?: AgentAction[];
  widgets?: ResponseWidget[];
  agent?: string;
  createdAt?: string;
  selectionContext?: SelectionContextSnapshot;
}
