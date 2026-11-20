'use client';

import type React from 'react';
import {
  BarChart3,
  BookOpen,
  Clock,
  FilePlus,
  FileText,
  FolderKanban,
  Globe,
  Home,
  ListTodo,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Search,
  Settings2,
  Shield,
  Tag,
  Trash2,
  TrendingUp,
  User,
  Users,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { MessagePart } from '../../types/message';

export type ToolCategory = 'read' | 'create' | 'update' | 'delete' | 'analyze';

export interface ToolMeta {
  label: string;
  icon: LucideIcon;
  category: ToolCategory;
}

export type ToolPartData = Extract<MessagePart, { type: 'tool' }>;
export type ToolUIComponent = React.ComponentType<{ part: ToolPartData }>;

export const TOOL_META: Record<string, ToolMeta> = {
  // Research & RAG
  search_documents: { label: 'Searching Documents', icon: Search, category: 'read' },
  search_knowledge: { label: 'Searching Knowledge Base', icon: Search, category: 'read' },
  rag_search: { label: 'Retrieving Evidence', icon: BookOpen, category: 'read' },
  web_search: { label: 'Searching Web', icon: Globe, category: 'read' },
  search_arxiv: { label: 'Searching arXiv', icon: BookOpen, category: 'read' },
  fetch_web_page: { label: 'Reading Web Source', icon: Globe, category: 'read' },

  // Library Agent
  search_items: { label: 'Searching Library', icon: Search, category: 'read' },
  library_stats: { label: 'Library Overview', icon: BarChart3, category: 'analyze' },
  get_item: { label: 'Inspecting Paper', icon: BookOpen, category: 'read' },
  audit_library: { label: 'Auditing Library', icon: AlertTriangle, category: 'analyze' },
  cite_items: { label: 'Formatting Citations', icon: FileText, category: 'read' },
  add_paper: { label: 'Adding Paper', icon: FilePlus, category: 'create' },
  manage_collection: { label: 'Managing Collection', icon: FolderKanban, category: 'update' },
  organize_item: { label: 'Organizing Item', icon: Tag, category: 'update' },
  save_note: { label: 'Saving Note', icon: Pencil, category: 'create' },
  trash_items: { label: 'Moving to Trash', icon: Trash2, category: 'delete' },
  merge_duplicates: { label: 'Merging Duplicates', icon: FolderKanban, category: 'delete' },

  // Editor Agent (LaTeX IDE)
  list_files: { label: 'Listing Project Files', icon: FileText, category: 'read' },
  read_file: { label: 'Reading LaTeX File', icon: BookOpen, category: 'read' },
  get_outline_and_symbols: { label: 'Inspecting Manuscript Symbols', icon: FileText, category: 'analyze' },
  search_manuscript: { label: 'Searching Manuscript', icon: Search, category: 'read' },
  inspect_citations: { label: 'Inspecting .bib Citations', icon: BookOpen, category: 'read' },
  validate_citations: { label: 'Validating Bibliography', icon: AlertTriangle, category: 'analyze' },
  lint_manuscript: { label: 'Checking LaTeX Syntax', icon: Settings2, category: 'analyze' },
  list_review_comments: { label: 'Reading Review Comments', icon: MessageSquare, category: 'read' },
  scan_citation_gaps: { label: 'Auditing Citation Gaps', icon: BookOpen, category: 'analyze' },
  audit_manuscript_structure: {
    label: 'Auditing Manuscript Structure',
    icon: FolderKanban,
    category: 'analyze',
  },
  propose_edit: { label: 'Preparing Verified Diff', icon: Pencil, category: 'update' },
  add_bibtex_entries: { label: 'Adding BibTeX Entries', icon: FilePlus, category: 'create' },
  resolve_citation: { label: 'Resolving Citation DOI/arXiv', icon: BookOpen, category: 'create' },
  sync_library_citations: { label: 'Syncing Library Bibliography', icon: FolderKanban, category: 'update' },
  create_review_suggestion: { label: 'Creating Track Changes Suggestion', icon: Pencil, category: 'update' },

  // Work items
  list_work_items: { label: 'Listing Work Items', icon: ListTodo, category: 'read' },
  get_my_work_items: { label: 'Getting My Work Items', icon: ListTodo, category: 'read' },
  get_work_item: { label: 'Inspecting Work Item', icon: ListTodo, category: 'read' },
  summarize_member_work_items: { label: 'Summarizing Workload', icon: BarChart3, category: 'analyze' },
  create_work_item: { label: 'Creating Work Item', icon: Plus, category: 'create' },
  update_work_item: { label: 'Updating Work Item', icon: Pencil, category: 'update' },
  assign_work_item: { label: 'Assigning Work Item', icon: User, category: 'update' },
  delete_work_item: { label: 'Deleting Work Item', icon: Trash2, category: 'delete' },
  list_tasks: { label: 'Listing Work Items', icon: ListTodo, category: 'read' },
  get_my_tasks: { label: 'Getting My Work Items', icon: ListTodo, category: 'read' },
  summarize_member_tasks: { label: 'Summarizing Workload', icon: BarChart3, category: 'analyze' },

  // Projects
  list_projects: { label: 'Listing Projects', icon: FolderKanban, category: 'read' },
  get_project_overview: { label: 'Project Overview', icon: BarChart3, category: 'read' },
  get_project_details: { label: 'Project Details', icon: FolderKanban, category: 'read' },
  update_project: { label: 'Updating Project', icon: Pencil, category: 'update' },
  add_project_member: { label: 'Adding Member', icon: User, category: 'create' },
  remove_project_member: { label: 'Removing Member', icon: User, category: 'delete' },
  update_member_role: { label: 'Updating Role', icon: Shield, category: 'update' },

  // Workspace & Pages
  search_workspace: { label: 'Searching Workspace', icon: Search, category: 'read' },
  list_members: { label: 'Listing Members', icon: Users, category: 'read' },
  get_workspace_overview: { label: 'Workspace Overview', icon: Home, category: 'read' },
  get_workspace_activity: { label: 'Activity Feed', icon: Clock, category: 'read' },
  list_pages: { label: 'Listing Pages', icon: FileText, category: 'read' },
  list_workspace_pages: { label: 'Workspace Pages', icon: FileText, category: 'read' },
  get_page_content: { label: 'Reading Page', icon: BookOpen, category: 'read' },
  get_page_versions: { label: 'Page History', icon: Clock, category: 'read' },
  create_page: { label: 'Creating Page', icon: FilePlus, category: 'create' },
  update_page: { label: 'Updating Page', icon: Pencil, category: 'update' },
  delete_page: { label: 'Deleting Page', icon: Trash2, category: 'delete' },

  // Labels & Stickies & Comments
  list_labels: { label: 'Listing Labels', icon: Tag, category: 'read' },
  create_label: { label: 'Creating Label', icon: Tag, category: 'create' },
  delete_label: { label: 'Deleting Label', icon: Trash2, category: 'delete' },
  list_stickies: { label: 'Listing Stickies', icon: Pin, category: 'read' },
  create_sticky: { label: 'Creating Sticky', icon: Pin, category: 'create' },
  update_sticky: { label: 'Updating Sticky', icon: Pencil, category: 'update' },
  delete_sticky: { label: 'Deleting Sticky', icon: Trash2, category: 'delete' },
  get_work_item_comments: { label: 'Work Item Comments', icon: MessageSquare, category: 'read' },
  add_work_item_comment: { label: 'Adding Comment', icon: MessageSquare, category: 'create' },
  get_page_comments: { label: 'Page Comments', icon: MessageSquare, category: 'read' },
  add_page_comment: { label: 'Adding Comment', icon: MessageSquare, category: 'create' },

  // Users & Analytics
  get_current_user: { label: 'Current User', icon: User, category: 'read' },
  search_users: { label: 'Searching Users', icon: Search, category: 'read' },
  get_workload_distribution: { label: 'Workload Analysis', icon: BarChart3, category: 'analyze' },
  get_overdue_report: { label: 'Overdue Report', icon: AlertTriangle, category: 'analyze' },
  audit_project_health: { label: 'Auditing Project Health', icon: Shield, category: 'analyze' },
  get_project_velocity: { label: 'Project Velocity', icon: TrendingUp, category: 'analyze' },
  generate_team_summary: { label: 'Team Summary', icon: Users, category: 'analyze' },
};

export const CATEGORY_SURFACE: Record<ToolCategory, string> = {
  read: 'bg-primary/10 text-primary',
  create: 'bg-success/10 text-success',
  update: 'bg-warning/10 text-warning',
  delete: 'bg-destructive/10 text-destructive',
  analyze: 'bg-ai/10 text-ai',
};

export function getToolMeta(toolName: string): ToolMeta {
  const known = TOOL_META[toolName];
  if (known) return known;

  const lower = (toolName || '').toLowerCase();
  const label = toolName
    ? toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Tool Execution';

  if (lower.includes('delete') || lower.includes('remove')) {
    return { label, icon: Trash2, category: 'delete' };
  }
  if (lower.includes('create') || lower.includes('add')) {
    return { label, icon: Plus, category: 'create' };
  }
  if (lower.includes('update') || lower.includes('edit')) {
    return { label, icon: Pencil, category: 'update' };
  }
  if (lower.includes('search') || lower.includes('find')) {
    return { label, icon: Search, category: 'read' };
  }
  return { label, icon: Settings2, category: 'read' };
}

const customToolRegistry = new Map<string, ToolUIComponent>();

export function registerToolUI(
  toolName: string,
  component: ToolUIComponent,
): void {
  customToolRegistry.set(toolName, component);
}

export function getToolUI(toolName: string): ToolUIComponent | undefined {
  return customToolRegistry.get(toolName);
}
