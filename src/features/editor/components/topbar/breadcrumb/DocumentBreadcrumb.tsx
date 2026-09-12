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
      { pageId: currentPage!.id, title: trimmed },
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
      {/* Flux Logo / Navigation */}
      <button
        type="button"
        onClick={() => router.push('/projects')}
        aria-label="Navigate to projects"
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
              const projId = proj && typeof proj === 'object' ? (proj as any).id : proj;
              if (projId) {
                router.push(`/projects/${projId}/pages`);
                return;
              }
              router.back();
            }}
            title="Back to project"
            aria-label={`Back to project ${projectName}`}
            className="px-1.5 py-0.5 text-sm rounded-md text-foreground hover:bg-muted transition-colors shrink-0 max-w-[140px] truncate"
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
              className="text-sm font-medium text-foreground hover:bg-muted rounded-md px-1.5 py-0.5 transition-colors select-none truncate max-w-[180px]"
            >
              {currentPage.title}
            </button>
          )}
        </>
      )}
    </div>
  );
}
