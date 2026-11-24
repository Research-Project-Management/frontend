export interface AgentMeta {
  id: string;
  label: string;
  badgeClass: string;
  description: string;
}

const KNOWN_AGENTS: Record<string, AgentMeta> = {
  rag_agent: {
    id: 'rag_agent',
    label: 'Documents',
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
  editor_agent: {
    id: 'editor_agent',
    label: 'LaTeX Editor',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Read, debug, polish, and propose verified LaTeX patches',
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
    label: 'Projects',
    badgeClass: 'bg-ai/10 text-ai',
    description: 'Manage project settings and members',
  },
};

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
