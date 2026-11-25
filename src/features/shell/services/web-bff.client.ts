import type { QueryClient } from '@tanstack/react-query';
import { apiGet } from '@/shared/lib/api';
import type { BffEnvelope, BffResponseMeta } from '@/shared/types/bff.types';
import {
  projectKeys,
  type Project,
  type ProjectListResponse,
} from '@/features/projects/shell/services/project.service';
import type { ProjectOverviewData } from '@/features/projects/project-id/overview/types/overview.types';
import type { YourWorkSummaryResponse } from '@/features/projects/your-work/schemas/your-work.schema';

export type { BffEnvelope, BffResponseMeta };

export interface WebWorkspaceShellData {
  projects: {
    items: Project[];
    myProjectIds: string[];
    sharedProjectIds: string[];
    total: number;
  };
  yourWork: YourWorkSummaryResponse | null;
  chat: {
    totalConversations: number;
    totalUnreadCount: number;
  };
}

export interface WebProjectChannelSummary {
  id: string;
  name: string | null;
  topic: string | null;
  isDefault: boolean;
  memberCount: number;
  unreadCount: number;
  isMuted: boolean;
  isPinned: boolean;
  updatedAt: string;
}

export interface WebProjectBootstrapData {
  overview: ProjectOverviewData;
  channels: WebProjectChannelSummary[];
}

export const webBffKeys = {
  workspaceShell: () => ['bff', 'web', 'workspace-shell'] as const,
  projectBootstrap: (projectId: string) =>
    ['bff', 'web', 'project-bootstrap', projectId] as const,
};

export function fetchWebWorkspaceShell(options?: {
  refresh?: boolean;
  signal?: AbortSignal;
}): Promise<BffEnvelope<WebWorkspaceShellData>> {
  return apiGet<BffEnvelope<WebWorkspaceShellData>>(
    '/api/v1/bff/web/workspace-shell',
    {
      params: options?.refresh ? { refresh: 'true' } : undefined,
      signal: options?.signal,
    },
  );
}

export function fetchWebProjectBootstrap(
  projectId: string,
  options?: { refresh?: boolean; signal?: AbortSignal },
): Promise<BffEnvelope<WebProjectBootstrapData>> {
  return apiGet<BffEnvelope<WebProjectBootstrapData>>(
    `/api/v1/bff/web/projects/${encodeURIComponent(projectId)}/bootstrap`,
    {
      params: options?.refresh ? { refresh: 'true' } : undefined,
      signal: options?.signal,
    },
  );
}

export function hydrateWorkspaceShellCache(
  queryClient: QueryClient,
  envelope: BffEnvelope<WebWorkspaceShellData>,
): void {
  const { projects, yourWork } = envelope.data;

  if (projects && Array.isArray(projects.items)) {
    const mySet = new Set(projects.myProjectIds);
    const sharedSet = new Set(projects.sharedProjectIds);

    const listResponse: ProjectListResponse = {
      projects: projects.items,
      myProjects: projects.items.filter((p) => mySet.has(p.id)),
      sharedProjects: projects.items.filter((p) => sharedSet.has(p.id)),
      total: projects.total,
    };

    queryClient.setQueryData(projectKeys.all(), listResponse);
  }

  if (yourWork !== null) {
    queryClient.setQueryData(['your-work', 'me'], yourWork);
  }
}

export function hydrateProjectBootstrapCache(
  queryClient: QueryClient,
  projectId: string,
  envelope: BffEnvelope<WebProjectBootstrapData>,
): void {
  if (envelope.data?.overview) {
    queryClient.setQueryData(
      projectKeys.overview(projectId),
      envelope.data.overview,
    );
  }
}
