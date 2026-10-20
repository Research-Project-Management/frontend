'use client';

/**
 * ChatTab.tsx
 *
 * Dedicated Standalone Project Chat Viewlet for Primary Sidebar.
 * Completely decoupled from the Review and Track Changes subsystems.
 */

import React from 'react';
import { useParams } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { SidebarPanelHeader, usePageStore } from '@/features/editor/core';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { ProjectChatView } from './ProjectChatView';

export interface ChatTabProps {
  onClose?: () => void;
}

export const ChatTab = React.memo(function ChatTab({ onClose }: ChatTabProps) {
  const { pageId: routePageId, projectId: routeProjectId } = useParams<{
    pageId?: string;
    projectId?: string;
  }>();

  const storeActivePageId = usePageStore((s) => s.activePageId);
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const currentPageProjectId = usePageStore((s) => extractProjectId(s.currentPage));
  const rootPageId = routePageId || storeParentPageId || currentPageId;
  const pageId = storeActivePageId || currentPageId || rootPageId || '';
  const storeProjectId = usePageStore((s) => s.projectId);
  const projectId = routeProjectId || storeProjectId || currentPageProjectId || '';

  const { user } = useAuth();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-foreground select-none">
      {/* Dedicated Header for Project Chat (No review controls or track changes) */}
      <SidebarPanelHeader
        title="Project Chat"
        onClose={onClose}
        closeAriaLabel="Close chat panel"
      >
        <div className="flex items-center gap-1 text-muted-foreground mr-1">
          <MessageSquare className="size-4 shrink-0 opacity-70" />
        </div>
      </SidebarPanelHeader>

      {/* Standalone Chat View */}
      <ProjectChatView
        projectId={projectId}
        pageId={pageId}
        currentUserId={user?.id}
      />
    </div>
  );
});

export default ChatTab;
