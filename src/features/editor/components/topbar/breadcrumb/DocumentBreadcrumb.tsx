'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { usePageStore } from '@/features/editor/store/page.store';
import { usePageActions } from '@/features/editor/hooks/use-page';

export default function DocumentBreadcrumb() {
  const router = useRouter();
  const { currentPage } = usePageStore();
  const { updateTitle: updateTitleMutation } = usePageActions();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const handleCommit = () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === currentPage?.title) {
      setIsEditing(false);
      return;
    }
    updateTitleMutation.mutate(
      { pageId: currentPage!._id, title: trimmed },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success('Page renamed successfully');
        },
        onError: () => {
          setIsEditing(false);
        },
      },
    );
  };

  const projectName =
    currentPage && typeof currentPage.projectId === 'object'
      ? (currentPage.projectId as any).name
      : null;

  return (
    <div className="flex items-center min-w-0 flex-1 justify-center px-2">
      {/* Flux Logo / Workspace navigation */}
      <button
        type="button"
        onClick={() => router.push('/ws')}
        aria-label="Navigate to workspaces"
        className="flex items-center shrink-0 p-1 rounded hover:bg-muted transition-colors outline-none"
      >
        <img src="/Flux.svg" className="size-5" alt="Flux" />
      </button>

      {/* Project name -> back to project pages */}
      {projectName && (
        <>
          <span className="text-muted-foreground/40 mx-1 text-sm select-none shrink-0">/</span>
          <button
            type="button"
            onClick={() => {
              const proj = currentPage?.projectId;
              if (proj && typeof proj === 'object') {
                const ws = (proj as any).workspaceId;
                const wsUrl = ws && typeof ws === 'object' ? ws.url : null;
                if (wsUrl) {
                  router.push(`/${wsUrl}/projects/${(proj as any)._id}/pages`);
                  return;
                }
              }
              router.back();
            }}
            title="Back to project"
            aria-label={`Back to project ${projectName}`}
            className="px-1.5 py-0.5 text-sm rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 max-w-[140px] truncate"
          >
            {projectName}
          </button>
        </>
      )}

      {/* Page title (current document) */}
      {currentPage?.title && (
        <>
          <span className="text-muted-foreground/40 mx-1 text-sm select-none shrink-0">/</span>
          {isEditing ? (
            <input
              autoFocus
              type="text"
              aria-label="Document title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="h-7 px-2 py-0.5 text-sm bg-muted focus:bg-background border border-primary/30 focus:border-primary rounded-md outline-none text-foreground font-medium transition-all min-w-[80px] max-w-[200px]"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setEditTitle(currentPage.title);
              }}
              title="Click to rename document"
              aria-label={`Document title: ${currentPage.title}. Click to rename`}
              className="text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary rounded px-1.5 py-0.5 transition-colors select-none truncate max-w-[180px]"
            >
              {currentPage.title}
            </button>
          )}
        </>
      )}
    </div>
  );
}
