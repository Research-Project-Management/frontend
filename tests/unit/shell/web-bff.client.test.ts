import { QueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/shell/services/project.service';
import {
  hydrateProjectBootstrapCache,
  hydrateWorkspaceShellCache,
  type BffEnvelope,
  type WebProjectBootstrapData,
  type WebWorkspaceShellData,
} from '@/features/shell/services/web-bff.client';
import type { Project } from '@/features/projects/shell/types/project.types';
import type { ProjectOverviewData } from '@/features/projects/project-id/overview/types/overview.types';

describe('Web BFF Frontend Hydration', () => {
  it('reconstructs myProjects/sharedProjects from normalized IDs and hydrates TanStack Query caches', () => {
    const queryClient = new QueryClient();
    const p1 = { id: 'p1', name: 'Owned' } as Project;
    const p2 = { id: 'p2', name: 'Shared' } as Project;

    const envelope: BffEnvelope<WebWorkspaceShellData> = {
      data: {
        projects: {
          items: [p1, p2],
          myProjectIds: ['p1'],
          sharedProjectIds: ['p2'],
          total: 2,
        },
        yourWork: { assigned: [], created: [], subscribed: [] } as never,
        chat: { totalConversations: 3, totalUnreadCount: 5 },
      },
      meta: {
        channel: 'web',
        partial: false,
        degradedSections: [],
        timedOutSections: [],
        circuitOpenSections: [],
        cacheHit: false,
        generatedAt: '2026-11-25T00:00:00.000Z',
        durationMs: 12,
      },
    };

    hydrateWorkspaceShellCache(queryClient, envelope);

    expect(queryClient.getQueryData(projectKeys.all())).toEqual({
      projects: [p1, p2],
      myProjects: [p1],
      sharedProjects: [p2],
      total: 2,
    });
    expect(queryClient.getQueryData(['your-work', 'me'])).toEqual({
      assigned: [],
      created: [],
      subscribed: [],
    });
  });

  it('skips hydrating degraded null yourWork while still hydrating projects', () => {
    const queryClient = new QueryClient();
    const p1 = { id: 'p1', name: 'Owned' } as Project;

    const envelope: BffEnvelope<WebWorkspaceShellData> = {
      data: {
        projects: {
          items: [p1],
          myProjectIds: ['p1'],
          sharedProjectIds: [],
          total: 1,
        },
        yourWork: null,
        chat: { totalConversations: 0, totalUnreadCount: 0 },
      },
      meta: {
        channel: 'web',
        partial: true,
        degradedSections: ['yourWork'],
        timedOutSections: [],
        circuitOpenSections: [],
        cacheHit: false,
        generatedAt: '2026-11-25T00:00:00.000Z',
        durationMs: 15,
      },
    };

    hydrateWorkspaceShellCache(queryClient, envelope);

    expect(queryClient.getQueryData(projectKeys.all())).toBeDefined();
    expect(queryClient.getQueryData(['your-work', 'me'])).toBeUndefined();
  });

  it('hydrates project overview cache from WebProjectBootstrapData', () => {
    const queryClient = new QueryClient();
    const overview = { id: 'proj-1', name: 'Flux Paper' } as unknown as ProjectOverviewData;

    const envelope: BffEnvelope<WebProjectBootstrapData> = {
      data: {
        overview,
        channels: [],
      },
      meta: {
        channel: 'web',
        partial: false,
        degradedSections: [],
        timedOutSections: [],
        circuitOpenSections: [],
        cacheHit: true,
        generatedAt: '2026-11-25T00:00:00.000Z',
        durationMs: 2,
      },
    };

    hydrateProjectBootstrapCache(queryClient, 'proj-1', envelope);

    expect(queryClient.getQueryData(projectKeys.overview('proj-1'))).toEqual(
      overview,
    );
  });
});
