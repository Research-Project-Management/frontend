'use client';

/**
 * use-pages-workspace.ts
 *
 * Deep hook encapsulating workspace scope resolution (personal vs project space),
 * project route canonicalization, and responsive Pages sidebar state.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useWorkspaceContextStore } from '@/features/shell/store/workspace-context.store';
import { MEDIA_QUERY_TABLET, subscribeMediaQuery } from '@/shared/hooks/use-media-query';
import { STORAGE_KEYS } from '@/config/storage-keys';
import { APP_EVENTS, onAppEvent } from '@/config/events';

export function usePagesWorkspace(propSpaceId?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams() as { projectId?: string };
  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  const isProjectMode = Boolean(
    propSpaceId ||
      params?.projectId ||
      (activeSpace.type === 'project' && activeSpace.projectId),
  );

  const spaceId = useMemo(() => {
    if (propSpaceId) return propSpaceId;
    if (params?.projectId) return params.projectId;
    if (activeSpace.type === 'project' && activeSpace.projectId) {
      return activeSpace.projectId;
    }
    return '';
  }, [propSpaceId, params?.projectId, activeSpace.type, activeSpace.projectId]);

  useEffect(() => {
    if (!propSpaceId && !params?.projectId && activeSpace.type === 'project' && spaceId) {
      router.replace(`/projects/${spaceId}/pages`);
    }
  }, [propSpaceId, params?.projectId, activeSpace.type, spaceId, router]);

  useEffect(() => {
    setMounted(true);
    const isMobile = window.innerWidth < 1024;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PAGES_SIDEBAR_VISIBLE);
      if (saved !== null) {
        setIsSidebarVisible(isMobile ? false : saved === 'true');
        return;
      }
    } catch {
      // ignore storage errors
    }

    setIsSidebarVisible(!isMobile);

    return subscribeMediaQuery(MEDIA_QUERY_TABLET, (matches) => {
      setIsSidebarVisible(!matches);
    });
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarVisible(false);
    }
  }, [pathname]);

  useEffect(() => {
    return onAppEvent(APP_EVENTS.TOGGLE_PAGES_SIDEBAR, () => {
      setIsSidebarVisible((prev) => !prev);
    });
  }, []);

  const handleToggleSidebar = useCallback((visible: boolean) => {
    setIsSidebarVisible(visible);
    try {
      if (window.innerWidth >= 1024) {
        localStorage.setItem(STORAGE_KEYS.PAGES_SIDEBAR_VISIBLE, String(visible));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  return {
    router,
    spaceId,
    isProjectMode,
    mounted,
    isSidebarVisible,
    handleToggleSidebar,
  };
}
