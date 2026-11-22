'use client';

import type React from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Clock,
  FilePlus,
  FileText,
  FolderKanban,
  ListTodo,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings2,
  Shield,
  Tag,
  Trash2,
  User,
  Users,
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
  // Editor Agent (LaTeX Pages)
  list_files: { label: 'Listing Files', icon: FileText, category: 'read' },
  read_file: { label: 'Reading File', icon: BookOpen, category: 'read' },
  get_outline_and_symbols: { label: 'Inspecting Symbols', icon: FileText, category: 'analyze' },
  search_pages: { label: 'Searching Pages', icon: Search, category: 'read' },
  inspect_citations: { label: 'Inspecting Citations', icon: BookOpen, category: 'read' },
  validate_citations: { label: 'Validating Bibliography', icon: AlertTriangle, category: 'analyze' },
  lint_pages: { label: 'Checking LaTeX', icon: Settings2, category: 'analyze' },
  list_review_comments: { label: 'Reading Comments', icon: MessageSquare, category: 'read' },
  scan_citation_gaps: { label: 'Scanning Citation Gaps', icon: BookOpen, category: 'analyze' },
  audit_page_structure: { label: 'Auditing Structure', icon: FileText, category: 'analyze' },
  propose_edit: { label: 'Proposing Edit', icon: Pencil, category: 'update' },
  insert_experiment_table: { label: 'Inserting Results Table', icon: FileText, category: 'update' },
  create_page: { label: 'Creating Page', icon: FilePlus, category: 'create' },
  add_bibtex_entries: { label: 'Adding BibTeX', icon: FilePlus, category: 'create' },
  resolve_citation: { label: 'Resolving Citation', icon: BookOpen, category: 'create' },
  sync_library_citations: { label: 'Syncing Bibliography', icon: FolderKanban, category: 'update' },
  create_review_suggestion: { label: 'Suggesting Edit', icon: Pencil, category: 'update' },

  // Library Agent
  search_items: { label: 'Searching Library', icon: Search, category: 'read' },
  library_stats: { label: 'Library Overview', icon: BarChart3, category: 'analyze' },
  get_item: { label: 'Inspecting Paper', icon: BookOpen, category: 'read' },
  audit_library: { label: 'Auditing Library', icon: AlertTriangle, category: 'analyze' },
  cite_items: { label: 'Formatting Citations', icon: FileText, category: 'read' },
  add_paper: { label: 'Adding Paper', icon: FilePlus, category: 'create' },
  manage_collection: { label: 'Managing Collection', icon: FolderKanban, category: 'update' },
  organize_item: { label: 'Organizing Paper', icon: Tag, category: 'update' },
  save_note: { label: 'Saving Note', icon: Pencil, category: 'create' },
  trash_items: { label: 'Trashing Papers', icon: Trash2, category: 'delete' },
  merge_duplicates: { label: 'Merging Duplicates', icon: FolderKanban, category: 'delete' },

  // Project Agent (Tasks, Projects, Members & Analytics)
  list_work_items: { label: 'Listing Tasks', icon: ListTodo, category: 'read' },
  get_my_work_items: { label: 'Fetching My Tasks', icon: ListTodo, category: 'read' },
  get_work_item: { label: 'Inspecting Task', icon: ListTodo, category: 'read' },
  summarize_member_work_items: { label: 'Summarizing Workload', icon: BarChart3, category: 'analyze' },
  create_work_item: { label: 'Creating Task', icon: Plus, category: 'create' },
  update_work_item: { label: 'Updating Task', icon: Pencil, category: 'update' },
  assign_work_item: { label: 'Assigning Task', icon: User, category: 'update' },
  delete_work_item: { label: 'Deleting Task', icon: Trash2, category: 'delete' },
  add_work_item_comment: { label: 'Adding Comment', icon: MessageSquare, category: 'create' },
  list_projects: { label: 'Listing Projects', icon: FolderKanban, category: 'read' },
  get_project_overview: { label: 'Project Overview', icon: BarChart3, category: 'read' },
  update_project: { label: 'Updating Project', icon: FolderKanban, category: 'update' },
  list_members: { label: 'Listing Members', icon: Users, category: 'read' },
  add_project_member: { label: 'Adding Member', icon: User, category: 'create' },
  remove_project_member: { label: 'Removing Member', icon: User, category: 'delete' },
  update_member_role: { label: 'Updating Role', icon: Shield, category: 'update' },
  get_workspace_activity: { label: 'Activity Feed', icon: Clock, category: 'read' },
  list_labels: { label: 'Listing Labels', icon: Tag, category: 'read' },
  create_label: { label: 'Creating Label', icon: Tag, category: 'create' },
  delete_label: { label: 'Deleting Label', icon: Tag, category: 'delete' },
  get_workload_distribution: { label: 'Workload Analysis', icon: BarChart3, category: 'analyze' },
  get_overdue_report: { label: 'Overdue Report', icon: AlertTriangle, category: 'analyze' },
  audit_project_health: { label: 'Auditing Project Health', icon: Shield, category: 'analyze' },
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
