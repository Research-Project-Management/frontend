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
} from '@/features/projects/shell/services/project.service';
import { prefetchProjectWorkspace } from '@/features/projects/project-id/work-items/hooks/use-work-items-query';
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
 * Centralized Navigation Data Prefetch Coordinator (Deep Module).
 *
 * Hides cross-domain query keys, service calls, and cache freshness policies
 * behind a small, high-leverage interface for navigation components.
 */

export function prefetchAppSection(
  queryClient: QueryClient,
  section: string,
): void {
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
}

export function prefetchWorkspaceRoute(
  queryClient: QueryClient,
  routePath: string,
): void {
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
  }
}

export function prefetchProjectSubmodule(
  queryClient: QueryClient,
  projectId: string,
  moduleKey: string,
): void {
  if (!projectId) return;

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
}

export function prefetchLibraryCollection(
  queryClient: QueryClient,
  scopeId: string | undefined,
  collectionId: string,
): void {
  if (!collectionId) return;
  const targetScope = normalizeScopeId(scopeId);
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
}
