/**
 * Chat types — aligned with Flux-AI backend models.
 */

/** A source document managed in the Sources panel (NotebookLM-style). */
export interface SourceDoc {
  id: string;
  name: string;
  enabled: boolean;
}

/** A source citation attached to an assistant message */
export interface SourceItem {
  source?: string;   // RAG: file name / doc name
  snippet?: string;  // RAG: passage excerpt that was cited
  title?: string;    // Web: page title
  url?: string;      // Web: URL
  authors?: string;  // OpenAlex: author list (comma-separated)
  year?: number;     // OpenAlex: publication year
}

/** Single message in a conversation */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
}

/** A persisted chat session (from RPM-BE ChatHistory) */
export interface ChatSession {
  _id: string;
  title: string;
  projectId: string | null;
  messageCount: number;
  lastMessage: string;
  updatedAt: string;
  createdAt: string;
}

/** Full session including messages (returned by GET /api/ai/chats/:id) */
export interface ChatSessionDetail extends ChatSession {
  messages: (ChatMessage & { _id: string; createdAt: string })[];
  documentIds: string[];
}

/** Legacy request format (still supported by RPM-BE proxy) */
export interface ChatRequest {
  session_id: string;
  query: string;
  enable_web_search?: boolean;
  use_system_knowledge?: boolean;
  selected_files?: string[];
}

/** Agent output from Flux-AI */
export interface AgentOutput {
  agent_name: string;
  content: string;
  sources: Array<{ source: string; score: number }>;
  metadata: Record<string, unknown>;
}

/** Response type identifiers for SSE events */
export interface ChatTypeResponse {
  type: "answer" | "trace";
}

export interface ChatAnswerResponse {
  type: "answer";
  content: string;
}

export interface ChatTraceResponse {
  type: "trace";
  step: number;
  node: string;
  description: string;
  details: object;
}

// ── Action Agent Types ──────────────────────────────────────────────────────────

/** A single tool execution event from the action agent */
export interface AgentAction {
  type: "tool_start" | "tool_end";
  tool: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  needs_confirm?: boolean;
  error?: string;
}

/** Tool category for color coding */
export type ToolCategory = "read" | "create" | "update" | "delete" | "analyze";

/** Pretty labels for tools displayed in ActionCard */
export const TOOL_LABELS: Record<string, { label: string; icon: string; category: ToolCategory }> = {
  // ─── Task management ──────────────────────────────────────────────────────
  list_tasks:             { label: "Listing Tasks",           icon: "📋", category: "read" },
  get_my_tasks:           { label: "Getting My Tasks",        icon: "📋", category: "read" },
  summarize_member_tasks: { label: "Summarizing Workload",    icon: "📊", category: "analyze" },
  create_task:            { label: "Creating Task",           icon: "✅", category: "create" },
  update_task:            { label: "Updating Task",           icon: "✏️", category: "update" },
  delete_task:            { label: "Deleting Task",           icon: "🗑️", category: "delete" },

  // ─── Projects ─────────────────────────────────────────────────────────────
  list_projects:          { label: "Listing Projects",        icon: "📁", category: "read" },
  get_project_overview:   { label: "Project Overview",        icon: "📊", category: "read" },
  get_project_details:    { label: "Project Details",         icon: "📁", category: "read" },
  update_project:         { label: "Updating Project",        icon: "✏️", category: "update" },
  add_project_member:     { label: "Adding Member",           icon: "👤", category: "create" },
  remove_project_member:  { label: "Removing Member",         icon: "👤", category: "delete" },
  update_member_role:     { label: "Updating Role",           icon: "🛡️", category: "update" },

  // ─── Workspace ────────────────────────────────────────────────────────────
  search_workspace:       { label: "Searching",               icon: "🔍", category: "read" },
  list_members:           { label: "Listing Members",         icon: "👥", category: "read" },
  get_workspace_overview: { label: "Workspace Overview",      icon: "🏠", category: "read" },
  get_workspace_activity: { label: "Activity Feed",           icon: "📰", category: "read" },

  // ─── Cycles ───────────────────────────────────────────────────────────────
  list_cycles:            { label: "Listing Cycles",          icon: "🔄", category: "read" },
  get_cycle_details:      { label: "Cycle Details",           icon: "🔄", category: "read" },
  create_cycle:           { label: "Creating Cycle",          icon: "🔄", category: "create" },
  update_cycle:           { label: "Updating Cycle",          icon: "✏️", category: "update" },
  delete_cycle:           { label: "Deleting Cycle",          icon: "🗑️", category: "delete" },

  // ─── Pages ────────────────────────────────────────────────────────────────
  list_pages:             { label: "Listing Pages",           icon: "📄", category: "read" },
  list_workspace_pages:   { label: "Workspace Pages",         icon: "📄", category: "read" },
  get_page_content:       { label: "Reading Page",            icon: "📖", category: "read" },
  get_page_versions:      { label: "Page History",            icon: "🕐", category: "read" },
  create_page:            { label: "Creating Page",           icon: "📝", category: "create" },
  update_page:            { label: "Updating Page",           icon: "✏️", category: "update" },
  delete_page:            { label: "Deleting Page",           icon: "🗑️", category: "delete" },

  // ─── Tags ─────────────────────────────────────────────────────────────────
  list_tags:              { label: "Listing Tags",            icon: "🏷️", category: "read" },
  create_tag:             { label: "Creating Tag",            icon: "🏷️", category: "create" },
  delete_tag:             { label: "Deleting Tag",            icon: "🗑️", category: "delete" },

  // ─── Stickies ─────────────────────────────────────────────────────────────
  list_stickies:          { label: "Listing Stickies",        icon: "📌", category: "read" },
  create_sticky:          { label: "Creating Sticky",         icon: "📌", category: "create" },
  update_sticky:          { label: "Updating Sticky",         icon: "✏️", category: "update" },
  delete_sticky:          { label: "Deleting Sticky",         icon: "🗑️", category: "delete" },

  // ─── Comments ─────────────────────────────────────────────────────────────
  get_task_comments:      { label: "Task Comments",           icon: "💬", category: "read" },
  add_task_comment:       { label: "Adding Comment",          icon: "💬", category: "create" },
  get_page_comments:      { label: "Page Comments",           icon: "💬", category: "read" },
  add_page_comment:       { label: "Adding Comment",          icon: "💬", category: "create" },

  // ─── Users ────────────────────────────────────────────────────────────────
  get_current_user:       { label: "Current User",            icon: "👤", category: "read" },
  search_users:           { label: "Searching Users",         icon: "🔍", category: "read" },

  // ─── Analysis ─────────────────────────────────────────────────────────────
  get_workload_distribution: { label: "Workload Analysis",    icon: "📊", category: "analyze" },
  get_overdue_report:        { label: "Overdue Report",       icon: "⚠️", category: "analyze" },
  get_project_velocity:      { label: "Project Velocity",     icon: "📈", category: "analyze" },
  generate_team_summary:     { label: "Team Summary",         icon: "👥", category: "analyze" },
};

/** Color scheme per tool category */
export const TOOL_CATEGORY_COLORS: Record<ToolCategory, string> = {
  read:    "text-[#3370ff]",
  create:  "text-emerald-600 dark:text-emerald-400",
  update:  "text-amber-600 dark:text-amber-400",
  delete:  "text-red-500",
  analyze: "text-violet-600 dark:text-violet-400",
};

// ── Agent Configuration ─────────────────────────────────────────────────────────

export type AgentId = "action" | "rag" | "analyze" | "latex" | "web_search" | "chat" | "task";

export interface AgentConfig {
  id: AgentId;
  label: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  /** Suggested quick prompts for this agent */
  quickPrompts: string[];
}

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: "action",
    label: "Action",
    description: "Manage tasks, projects, and pages in your workspace",
    icon: "",
    color: "text-[#3370ff]",
    bg: "bg-[#3370ff]/8 hover:bg-[#3370ff]/14",
    border: "border-[#3370ff]/25",
    quickPrompts: [
      "Show my tasks",
      "Show project overview",
      "Who's in my team?",
      "Create a new task",
      "What happened recently?",
    ],
  },
  {
    id: "rag",
    label: "Documents",
    description: "Search and summarize your uploaded files",
    icon: "",
    color: "text-violet-500",
    bg: "bg-violet-500/8 hover:bg-violet-500/14",
    border: "border-violet-500/25",
    quickPrompts: [
      "Summarize this document",
      "What are the key findings?",
      "Explain the methodology",
    ],
  },
  {
    id: "analyze",
    label: "Analyze",
    description: "Review data and research papers",
    icon: "",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/8 hover:bg-emerald-500/14",
    border: "border-emerald-500/25",
    quickPrompts: [
      "Compare these papers",
      "Analyze the data",
      "Review strengths & weaknesses",
    ],
  },
  {
    id: "latex",
    label: "LaTeX",
    description: "Generate equations, tables, and templates",
    icon: "",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/8 hover:bg-amber-500/14",
    border: "border-amber-500/25",
    quickPrompts: [
      "Generate an equation",
      "Create a table",
      "Write a document template",
    ],
  },
  {
    id: "web_search",
    label: "Web Search",
    description: "Search academic and general web sources",
    icon: "",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/8 hover:bg-sky-500/14",
    border: "border-sky-500/25",
    quickPrompts: [
      "Find papers on...",
      "Latest research in...",
      "Search arXiv for...",
    ],
  },
  {
    id: "task",
    label: "Task Planner",
    description: "Break down work into actionable tasks",
    icon: "",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/8 hover:bg-rose-500/14",
    border: "border-rose-500/25",
    quickPrompts: [
      "Plan a research sprint",
      "Break down this feature",
      "Suggest next steps",
    ],
  },
  {
    id: "chat",
    label: "Chat",
    description: "General conversational AI",
    icon: "",
    color: "text-muted-foreground",
    bg: "bg-secondary/50 hover:bg-secondary/80",
    border: "border-border/60",
    quickPrompts: [
      "Explain this concept",
      "Help me think through...",
    ],
  },
];
