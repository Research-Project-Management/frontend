import type { QueryClient } from '@tanstack/react-query';
import { homeKeys } from '@/features/projects/home/hooks/use-home';
import { getRecentItems } from '@/features/projects/home/services/home.service';
import { draftKeys } from '@/features/projects/drafts/hooks/use-drafts';
import { DraftService } from '@/features/projects/drafts/services/draft.service';
import { stickyKeys } from '@/features/projects/stickies/constants/sticky.keys';
import { getStickies } from '@/features/projects/stickies/services/sticky.service';
import {
  projectKeys,
  fetchProject,
  fetchUserProjects,
  ProjectService,
} from '@/features/projects/shell/services/project.service';
import {
  prefetchProjectWorkspace,
  stateKeys,
} from '@/features/projects/project-id/work-items/hooks/use-work-items-query';
import { workItemApi } from '@/features/projects/project-id/work-items/api/work-item.api';
import { getYourWork } from '@/features/projects/your-work/services/your-work.service';
import { OverviewService } from '@/features/projects/project-id/overview/services/overview.service';
import { pageKeys } from '@/features/projects/project-id/pages/hooks/use-page';
import { PageService } from '@/features/projects/project-id/pages/services/page.service';
import {
  collectionKeys,
  itemKeys as libraryItemKeys,
  libraryKeys,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';
import {
  CollectionsService,
  ItemsService,
} from '@/features/library/sdk/library.client';

/**
 * Centralized Navigation Intent & Prefetch Budget Controller (Deep Module).
 *
 * Controls runtime prefetch execution across all sidebars and navigation surfaces:
 * 1. Hover-Intent Debounce (65ms): Sweeping the cursor across 10 sidebar items cancels
 *    intermediate timers so 0 wasted requests fire until the pointer rests on a target.
 * 2. Cooldown Budget Registry (15s): Repeatedly hovering the same item within 15 seconds
 *    is a zero-allocation no-op.
 * 3. Network Data-Saver Guard: Automatically disables speculative prefetching when the
 *    browser is offline or on Data-Saver / 2G connections.
 */

const PREFETCH_HOVER_DELAY_MS = 65;
const PREFETCH_COOLDOWN_MS = 15_000;
const MAX_COOLDOWN_ENTRIES = 200;

let activeHoverTimer: ReturnType<typeof setTimeout> | null = null;
const lastPrefetchedAt = new Map<string, number>();

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

function isSpeculativePrefetchAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined') {
    if (navigator.onLine === false) return false;
    const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    if (conn?.saveData) return false;
    if (conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') {
      return false;
    }
  }
  return true;
}

function recordPrefetchExecution(intentKey: string): void {
  if (lastPrefetchedAt.size >= MAX_COOLDOWN_ENTRIES) {
    const oldestKey = lastPrefetchedAt.keys().next().value;
    if (oldestKey !== undefined) {
      lastPrefetchedAt.delete(oldestKey);
    }
  }
  lastPrefetchedAt.set(intentKey, Date.now());
}

export function cancelPendingPrefetchIntent(): void {
  if (activeHoverTimer !== null) {
    clearTimeout(activeHoverTimer);
    activeHoverTimer = null;
  }
}

export function schedulePrefetchIntent(
  intentKey: string,
  task: () => void,
  delayMs: number = PREFETCH_HOVER_DELAY_MS,
): void {
  if (!isSpeculativePrefetchAllowed()) return;

  const lastRun = lastPrefetchedAt.get(intentKey);
  if (lastRun !== undefined && Date.now() - lastRun < PREFETCH_COOLDOWN_MS) {
    return;
  }

  cancelPendingPrefetchIntent();

  if (delayMs <= 0) {
    recordPrefetchExecution(intentKey);
    task();
    return;
  }

  activeHoverTimer = setTimeout(() => {
    activeHoverTimer = null;
    const recentRun = lastPrefetchedAt.get(intentKey);
    if (recentRun !== undefined && Date.now() - recentRun < PREFETCH_COOLDOWN_MS) {
      return;
    }
    recordPrefetchExecution(intentKey);
    task();
  }, delayMs);
}

export function prefetchAppSection(
  queryClient: QueryClient,
  section: string,
): void {
  schedulePrefetchIntent(`app-section:${section}`, () => {
    if (section === 'Projects') {
      void queryClient.prefetchQuery({
        queryKey: homeKeys.recent('me'),
        queryFn: ({ signal }) => getRecentItems('me', signal),
        staleTime: 60_000,
      });
      void queryClient.prefetchQuery({
        queryKey: projectKeys.all(),
        queryFn: () => fetchUserProjects('all'),
        staleTime: 60_000,
      });
      return;
    }

    if (section === 'Library') {
      void queryClient.prefetchQuery({
        queryKey: collectionKeys.all('user'),
        queryFn: () => CollectionsService.getAll('user'),
        staleTime: 5 * 60_000,
      });
      void queryClient.prefetchQuery({
        queryKey: libraryItemKeys.counts('user'),
        queryFn: () => ItemsService.getCounts('user'),
        staleTime: 30_000,
      });
      void queryClient.prefetchQuery({
        queryKey: libraryKeys.items('user', { limit: 100 }),
        queryFn: ({ signal }) =>
          ItemsService.getAll('user', { limit: 100 }, { signal }),
        staleTime: 30_000,
      });
    }
  });
}

export function prefetchWorkspaceRoute(
  queryClient: QueryClient,
  routePath: string,
): void {
  schedulePrefetchIntent(`workspace-route:${routePath}`, () => {
    if (routePath === '/home') {
      void queryClient.prefetchQuery({
        queryKey: homeKeys.recent('me'),
        queryFn: ({ signal }) => getRecentItems('me', signal),
        staleTime: 60_000,
      });
      return;
    }

    if (routePath === '/drafts') {
      void queryClient.prefetchQuery({
        queryKey: draftKeys.list(undefined),
        queryFn: () => DraftService.getMyDrafts(undefined),
        staleTime: 30_000,
      });
      return;
    }

    if (routePath === '/your-work') {
      void queryClient.prefetchQuery({
        queryKey: ['your-work', 'me'],
        queryFn: ({ signal }) => getYourWork(undefined, signal),
        staleTime: 30_000,
      });
      return;
    }

    if (routePath === '/stickies') {
      void queryClient.prefetchQuery({
        queryKey: stickyKeys.list(),
        queryFn: () => getStickies(),
        staleTime: 60_000,
      });
      return;
    }

    if (routePath === '/projects') {
      void queryClient.prefetchQuery({
        queryKey: projectKeys.all(),
        queryFn: () => fetchUserProjects('all'),
        staleTime: 60_000,
      });
    }
  });
}

export function prefetchProjectSubmodule(
  queryClient: QueryClient,
  projectId: string,
  moduleKey: string,
): void {
  if (!projectId) return;

  schedulePrefetchIntent(`project-submodule:${projectId}:${moduleKey}`, () => {
    if (moduleKey === 'work-items') {
      prefetchProjectWorkspace(queryClient, projectId);
      return;
    }

    if (moduleKey === 'overview') {
      void queryClient.prefetchQuery({
        queryKey: projectKeys.byId(projectId),
        queryFn: () => fetchProject(projectId),
        staleTime: 2 * 60_000,
      });
      void queryClient.prefetchQuery({
        queryKey: ['project-overview', projectId],
        queryFn: () => OverviewService.getOverview(projectId),
        staleTime: 60_000,
      });
      return;
    }

    if (moduleKey === 'pages') {
      void queryClient.prefetchQuery({
        queryKey: pageKeys.project(projectId),
        queryFn: () => PageService.getProjectPages(projectId),
        staleTime: 60_000,
      });
      return;
    }

    if (moduleKey === 'settings' || moduleKey === 'budget') {
      void queryClient.prefetchQuery({
        queryKey: projectKeys.byId(projectId),
        queryFn: () => fetchProject(projectId),
        staleTime: 2 * 60_000,
      });
    }
  });
}

export function prefetchLibraryCollection(
  queryClient: QueryClient,
  scopeId: string | undefined,
  collectionId: string,
): void {
  if (!collectionId) return;
  const targetScope = normalizeScopeId(scopeId);
  schedulePrefetchIntent(`library-collection:${targetScope}:${collectionId}`, () => {
    const params = {
      collectionId,
      includeSubcollections: true,
      limit: 100,
    };
    void queryClient.prefetchQuery({
      queryKey: libraryKeys.items(targetScope, params),
      queryFn: ({ signal }) => ItemsService.getAll(targetScope, params, { signal }),
      staleTime: 30_000,
    });
  });
}

export function prefetchLibraryProjectScope(
  queryClient: QueryClient,
  projectId: string,
): void {
  if (!projectId) return;
  const targetScope = normalizeScopeId(projectId);
  schedulePrefetchIntent(`library-project:${targetScope}`, () => {
    void queryClient.prefetchQuery({
      queryKey: collectionKeys.all(targetScope),
      queryFn: () => CollectionsService.getAll(targetScope),
      staleTime: 5 * 60_000,
    });
    void queryClient.prefetchQuery({
      queryKey: libraryKeys.items(targetScope, { limit: 100 }),
      queryFn: ({ signal }) =>
        ItemsService.getAll(targetScope, { limit: 100 }, { signal }),
      staleTime: 30_000,
    });
  });
}

export function prefetchProjectSettingsTab(
  queryClient: QueryClient,
  projectId: string,
  tabKey: string,
): void {
  if (!projectId) return;
  schedulePrefetchIntent(`project-settings:${projectId}:${tabKey}`, () => {
    if (tabKey === 'general' || tabKey === 'modules') {
      void queryClient.prefetchQuery({
        queryKey: projectKeys.byId(projectId),
        queryFn: () => fetchProject(projectId),
        staleTime: 2 * 60_000,
      });
      return;
    }
    if (tabKey === 'members') {
      void queryClient.prefetchQuery({
        queryKey: projectKeys.members(projectId),
        queryFn: async () => {
          const res = await ProjectService.getMembers(projectId);
          return res.members || [];
        },
        staleTime: 60_000,
      });
      return;
    }
    if (tabKey === 'states') {
      void queryClient.prefetchQuery({
        queryKey: stateKeys.all(projectId),
        queryFn: () => workItemApi.states.getStates(projectId),
        staleTime: 5 * 60_000,
      });
    }
  });
}
