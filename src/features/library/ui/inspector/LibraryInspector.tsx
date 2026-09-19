'use client';

import React from 'react';
import { useLibrarySidebarStore } from '../../store/sidebar.store';
import { useLibraryViewStore } from '../../store/library-view.store';
import { useLibraryItemDetailQuery } from '../../data/items.queries';
import OriginalPanel from '../../components/Panel';

interface LibraryInspectorProps {
  scopeId?: string;
}

/**
 * LibraryInspector Zone
 * Self-contained right side inspector panel.
 * Connects directly to `useLibraryViewStore` to inspect the selected document.
 */
export function LibraryInspector({ scopeId }: LibraryInspectorProps) {
  const isInspectorOpen = useLibrarySidebarStore((s) => s.isInspectorOpen);
  const toggleInspector = useLibrarySidebarStore((s) => s.toggleInspector);
  const activeItemId = useLibraryViewStore((s) => s.activeItemId);

  const { data: item } = useLibraryItemDetailQuery(scopeId, activeItemId || undefined);

  if (!isInspectorOpen) return null;

  return (
    <aside className="h-full border-l border-border/60 bg-background flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-right duration-150">
      <OriginalPanel
        item={item || null}
        paper={item || null}
        scopeId={scopeId}
        onClose={toggleInspector}
      />
    </aside>
  );
}

export default LibraryInspector;
