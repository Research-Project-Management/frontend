export interface AgentMeta {
  id: string;
  label: string;
  badgeClass: string;
  description: string;
}

const KNOWN_AGENTS: Record<string, AgentMeta> = {
  rag_agent: {
    id: 'rag_agent',
    label: 'Knowledge RAG',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Search and synthesize uploaded & library documents',
  },
  web_search_agent: {
    id: 'web_search_agent',
    label: 'Web Search',
    badgeClass: 'bg-ai/15 text-ai',
    description: 'Search academic and general web sources',
  },
  library_agent: {
    id: 'library_agent',
    label: 'Library',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Search, organize, cite, and manage library items',
  },
  library: {
    id: 'library',
    label: 'Library',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Search, organize, cite, and manage library items',
  },
  direct: {
    id: 'direct',
    label: 'Direct',
    badgeClass: 'bg-secondary/80 text-muted-foreground',
    description: 'Direct reasoning and generation assistant',
  },
  work_item_agent: {
    id: 'work_item_agent',
    label: 'Work Items',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Manage project work items',
  },
  project_agent: {
    id: 'project_agent',
    label: 'Project Agent',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Manage project settings and members',
  },
  workspace_agent: {
    id: 'workspace_agent',
    label: 'Workspace Agent',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Workspace search, pages, and stickies',
  },
  // Legacy compatibility labels
  rag: {
    id: 'rag',
    label: 'Knowledge RAG',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Search and synthesize documents',
  },
  web_search: {
    id: 'web_search',
    label: 'Web Search',
    badgeClass: 'bg-ai/15 text-ai',
    description: 'Search web sources',
  },
  action: {
    id: 'action',
    label: 'Workspace Agent',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Execute workspace actions',
  },
  analyze: {
    id: 'analyze',
    label: 'Analysis',
    badgeClass: 'bg-success/15 text-success',
    description: 'Analyze research data and papers',
  },
  latex: {
    id: 'latex',
    label: 'LaTeX',
    badgeClass: 'bg-warning/15 text-warning',
    description: 'LaTeX equations and document assistance',
  },
  work_item: {
    id: 'work_item',
    label: 'Work Items',
    badgeClass: 'bg-destructive/10 text-destructive',
    description: 'Plan and inspect work items',
  },
  chat: {
    id: 'chat',
    label: 'Assistant',
    badgeClass: 'bg-secondary/80 text-muted-foreground',
    description: 'General assistant',
  },
};

export function shouldShowAgentBadge(agentId?: string | null): boolean {
  void agentId;
  return false;
}

export function getAgentMeta(agentId: string): AgentMeta {
  const key = (agentId || '').trim();
  const known = KNOWN_AGENTS[key];
  if (known) return known;

  const fallbackLabel = key
    ? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Assistant';
  return {
    id: key || 'assistant',
    label: fallbackLabel,
    badgeClass: 'bg-secondary text-muted-foreground',
    description: fallbackLabel,
  };
}
