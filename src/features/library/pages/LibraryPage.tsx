'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { LibrarySidebar } from '../components/sidebar';
import { LibraryTopbar } from '../components/topbar';
import { LibraryContent } from '../components/content';
import { LibraryInspector } from '../components/inspector';
import { LibraryModals } from '../components/modals';
import { useLibrarySidebarStore } from '../store';

interface LibraryPageProps {
  scopeId?: string;
  collectionId?: string;
  view?: string;
  title?: string;
}

/**
 * Modern Workspace Engine Library Page
 * Decoupled layout frame combining 5 autonomous UI zones.
 */
export function ModernLibraryPage({
  scopeId: propScopeId,
  collectionId: propCollectionId,
  view,
  title,
}: LibraryPageProps) {
  const params = useParams() as { collectionId?: string; projectId?: string };
  const activeScope = useLibrarySidebarStore((s) => s.activeScope);

  const effectiveScopeId =
    propScopeId ||
    (activeScope.type === 'project' ? activeScope.id : 'user');

  const effectiveCollectionId =
    propCollectionId || params?.collectionId || undefined;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar (Left navigation, scopes, folders, tags) */}
      <LibrarySidebar />

      {/* Main Workspace (Topbar + Data Content) */}
      <main className="flex flex-1 flex-col overflow-hidden min-w-0">
        <LibraryTopbar title={title || activeScope.name || 'My Library'} />
        <div className="flex-1 overflow-hidden min-h-0 relative">
          <LibraryContent
            scopeId={effectiveScopeId}
            collectionId={effectiveCollectionId}
            view={view}
          />
        </div>
      </main>

      {/* Inspector Panel (Right side details, metadata, attachments) */}
      <LibraryInspector scopeId={effectiveScopeId} />

      {/* Modals (Centralized Dialog Bus) */}
      <LibraryModals scopeId={effectiveScopeId} />
    </div>
  );
}

export default ModernLibraryPage;
