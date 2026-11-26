'use client';

/**
 * EditorTabs.tsx
 *
 * Canonical Multi-Document Tab Bar (Block 6: UI Features Layer).
 * Location: `features/editor/core/surface/EditorTabs.tsx`
 *
 * Capabilities (1:1 Reader Architecture Parity):
 * - 0ms Tab Switching with in-memory Tri-State LRU document state preservation.
 * - Drag-and-drop tab sorting via `@dnd-kit/core` + `@dnd-kit/sortable` (root tab pinned first).
 * - Disambiguated duplicate filename badges via `computeEditorTabDisplayLabels`.
 * - Preview vs Pinned styling (italic preview tabs, double-click & local-edit auto-pin).
 * - Reactive unsaved dirty indicator dot backed directly by `lruDocumentCache`.
 * - Hover prefetching with deduplication (`navigationCoordinator.prefetchDocument`).
 * - Context menu actions (Pin, Open to Side, Close, Close Others, Close Saved).
 * - Keyboard navigation (ArrowLeft/Right, Home, End, Enter, Delete, Ctrl+W).
 */

import React, { useRef, useCallback, useMemo, useEffect, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { X, FileText, Pin, SplitSquareHorizontal, Settings } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/shared/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import {
  usePageStore,
  useWorkspaceStore,
  useSettingsStore,
  type EditorTab,
  editorCommandBus,
  lruDocumentCache,
} from '@/features/editor/core';
import {
  computeEditorTabDisplayLabels,
  type EditorTabDisplayLabel,
} from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';

// ── Single Tab Item ──────────────────────────────────────────────────────────

interface TabItemProps {
  tab: EditorTab;
  displayLabel: EditorTabDisplayLabel;
  isActive: boolean;
  isRoot: boolean;
  rootPageId: string;
  canClose?: boolean;
  hasClosableTabsToRight: boolean;
  onActivate: (id: string) => void;
  onPinTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
  onCloseTabsToRight: (id: string) => void;
  onCloseSavedTabs: () => void;
  onOpenToSide: (id: string) => void;
  onOpenTabSettings: () => void;
  onPrefetchTab: (tab: EditorTab) => void;
}

const TabItem = React.memo(function TabItem({
  tab,
  displayLabel,
  isActive,
  isRoot,
  canClose = true,
  hasClosableTabsToRight,
  onActivate,
  onPinTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseSavedTabs,
  onOpenToSide,
  onOpenTabSettings,
  onPrefetchTab,
}: TabItemProps) {
  const subscribeToFile = useCallback(
    (onStoreChange: () => void) => lruDocumentCache.subscribeFile(tab.id, onStoreChange),
    [tab.id],
  );
  const isDirty = useSyncExternalStore(
    subscribeToFile,
    () => lruDocumentCache.isDirty(tab.id),
    () => Boolean(tab.isDirty),
  );

  const isPreview = Boolean(tab.isPreview && !tab.isPinned && !isRoot);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: isRoot });

  // Strip dnd-kit role/tabIndex so native ARIA tablist keyboard navigation works identically
  const { role: _dndRole, tabIndex: _dndTabIndex, ...sortableAttrs } = attributes;

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleActivate = useCallback(() => {
    onActivate(tab.id);
  }, [onActivate, tab.id]);

  const handleDoubleClick = useCallback(() => {
    if (isPreview) {
      onPinTab(tab.id);
    }
  }, [isPreview, onPinTab, tab.id]);

  const handleClose = useCallback(() => {
    onCloseTab(tab.id);
  }, [onCloseTab, tab.id]);

  const handleMouseEnter = useCallback(() => {
    onPrefetchTab(tab);
  }, [onPrefetchTab, tab]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    } else if (canClose && (e.key === 'Delete' || (e.key === 'w' && (e.ctrlKey || e.metaKey)))) {
      e.preventDefault();
      handleClose();
    }
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (canClose && e.button === 1) {
      e.preventDefault();
      handleClose();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={sortableStyle}
          {...(isRoot ? {} : sortableAttrs)}
          {...(isRoot ? {} : listeners)}
          role="tab"
          id={`editor-tab-${tab.id}`}
          aria-controls="editor-surface"
          aria-selected={isActive}
          aria-label={`Tab: ${tab.title}`}
          data-preview={isPreview ? 'true' : undefined}
          title={displayLabel.fullPath}
          tabIndex={isActive ? 0 : -1}
          onClick={handleActivate}
          onDoubleClick={handleDoubleClick}
          onAuxClick={handleAuxClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={handleMouseEnter}
          className={cn(
            'group/tab relative flex items-center gap-1.5 h-8 px-2.5 rounded-t-md cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'min-w-0 max-w-[220px] shrink-0 transition-colors motion-reduce:transition-none text-12',
            isDragging && 'opacity-60 z-30 bg-muted/60',
            isActive
              ? 'bg-background text-foreground font-medium border-x border-t border-border border-b-transparent -mb-px z-10'
              : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
          )}
        >
          {/* File Document Icon */}
          <FileText
            className={cn(
              'size-3.5 shrink-0',
              isActive ? 'text-foreground' : 'text-muted-foreground group-hover/tab:text-foreground',
            )}
          />

          {/* File Name + Optional Path Disambiguator */}
          <span
            className={cn(
              'text-12 font-sans font-medium tracking-tight truncate leading-none min-w-0',
              isPreview && 'italic font-normal',
            )}
          >
            {displayLabel.leafTitle}
          </span>
          {displayLabel.disambiguationDir && (
            <span
              data-testid={`tab-disambiguator-${tab.id}`}
              className="text-10 text-muted-foreground/80 truncate max-w-[80px] shrink-0 leading-none"
            >
              {displayLabel.disambiguationDir}
            </span>
          )}

          {/* Close button */}
          {canClose && (
            <button
              type="button"
              aria-label={`Close file ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              onAuxClick={(e) => e.preventDefault()}
              className={cn(
                "ml-auto shrink-0 relative flex items-center justify-center rounded-xs transition-opacity motion-reduce:transition-none outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer hover:bg-muted text-foreground",
                "size-4 p-0.5 after:absolute after:-inset-2 after:content-['']",
                isActive
                  ? 'opacity-70 hover:opacity-100'
                  : 'opacity-40 sm:opacity-0 group-hover/tab:opacity-70 group-hover/tab:hover:opacity-100 group-focus-within/tab:opacity-70 focus-visible:opacity-100',
              )}
            >
              <X className="size-3 shrink-0" />
            </button>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        {isPreview && (
          <>
            <ContextMenuItem onSelect={() => onPinTab(tab.id)}>
              <Pin className="size-3.5" />
              Keep Open (Pin Tab)
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onSelect={() => onOpenToSide(tab.id)}>
          <SplitSquareHorizontal className="size-3.5" />
          Open to the Side
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!canClose} onSelect={handleClose}>
          Close
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onCloseOtherTabs(tab.id)}>
          Close other tabs
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasClosableTabsToRight}
          onSelect={() => onCloseTabsToRight(tab.id)}
        >
          Close tabs to the right
        </ContextMenuItem>
        <ContextMenuItem onSelect={onCloseSavedTabs}>
          Close saved tabs
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onOpenTabSettings}>
          <Settings className="size-3.5" />
          Tab settings
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

// ── Main Tabs Component ──────────────────────────────────────────────────────

const EMPTY_TABS: EditorTab[] = [];

export interface TabsProps {
  rootPageId: string;
  activeFileId: string;
  availableFiles?: { id: string; title: string }[];
  rightSlot?: React.ReactNode;
}

export function EditorTabs({ rootPageId, activeFileId, availableFiles, rightSlot }: TabsProps) {
  const searchParams = useSearchParams();
  const tabListRef = useRef<HTMLDivElement>(null);

  const rawTabs = useWorkspaceStore((s) => s.tabsByProject[rootPageId] ?? EMPTY_TABS);
  const configuredMain = usePageStore((s) => s.mainFilePath) || 'main.tex';

  // Deduplicate strictly by canonical id, prune ghost tabs, and ensure root tab is normalized
  const tabs = useMemo(() => {
    const isRootDoc = (t: EditorTab) =>
      Boolean(t.isRoot) || t.id === rootPageId || t.id === `${rootPageId}-main`;

    const availableIds = availableFiles ? new Set(availableFiles.map((f) => f.id)) : null;

    const seen = new Set<string>();
    const result: EditorTab[] = [];
    for (const t of rawTabs) {
      const isRoot = isRootDoc(t);
      if (
        availableIds &&
        availableIds.size > 0 &&
        !isRoot &&
        t.id !== activeFileId &&
        !t.id.startsWith('asset:') &&
        !availableIds.has(t.id)
      ) {
        continue;
      }
      const key = isRoot ? '__root__' : t.id;
      if (key && !seen.has(key)) {
        seen.add(key);
        const trimmedTitle = (t.title || '').trim();
        const normalizedTitle = isRoot && !trimmedTitle ? configuredMain : t.title;
        result.push({ ...t, title: normalizedTitle });
      }
    }

    if (result.length === 0 && rootPageId) {
      result.push({
        id: rootPageId,
        title: configuredMain,
        isRoot: true,
        isPinned: true,
        isPreview: false,
      });
    }
    return result;
  }, [rawTabs, rootPageId, availableFiles, configuredMain]);

  const displayLabels = useMemo(() => computeEditorTabDisplayLabels(tabs), [tabs]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const sortableIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  const currentParam = searchParams.get('file');

  // Single source of truth for the active tab (strict ID match prioritized before title fallback)
  const resolvedActiveTabId = useMemo(() => {
    if (tabs.length === 0) return null;

    if (activeFileId) {
      if (activeFileId === rootPageId || activeFileId === `${rootPageId}-main`) {
        const rootTab = tabs.find(
          (t) => Boolean(t.isRoot) || t.id === rootPageId || t.id === `${rootPageId}-main`,
        );
        if (rootTab) return rootTab.id;
      } else {
        const match =
          tabs.find((t) => t.id === activeFileId) ?? tabs.find((t) => t.title === activeFileId);
        if (match) return match.id;
      }
    }

    if (currentParam && currentParam !== rootPageId && currentParam !== `${rootPageId}-main`) {
      const match =
        tabs.find((t) => t.id === currentParam) ?? tabs.find((t) => t.title === currentParam);
      if (match) return match.id;
    }

    const rootTab = tabs.find(
      (t) => Boolean(t.isRoot) || t.id === rootPageId || t.id === `${rootPageId}-main`,
    );
    if (rootTab) return rootTab.id;

    const fallbackRoot = tabs.find(
      (t) => t.title === configuredMain || t.title.toLowerCase() === 'main.tex',
    );
    if (fallbackRoot) return fallbackRoot.id;

    return tabs[0]?.id ?? null;
  }, [tabs, currentParam, activeFileId, rootPageId, configuredMain]);

  const resolvedActiveTabIdRef = useRef(resolvedActiveTabId);
  resolvedActiveTabIdRef.current = resolvedActiveTabId;

  const handleTabActivate = useCallback(
    (tabId: string) => {
      const isRoot = tabId === rootPageId || tabId === `${rootPageId}-main`;
      const targetId = isRoot ? rootPageId : tabId;

      if (targetId !== resolvedActiveTabIdRef.current) {
        const targetTab = tabs.find((t) => t.id === tabId);
        navigationCoordinator.openDocument({
          fileId: targetId,
          title: targetTab?.title || '',
          path: targetTab?.path,
          preview: Boolean(targetTab?.isPreview && !targetTab?.isPinned),
        });
      }
    },
    [rootPageId, tabs],
  );

  const handlePinTab = useCallback(
    (tabId: string) => {
      useWorkspaceStore.getState().pinTab(rootPageId, tabId);
    },
    [rootPageId],
  );

  const handleTabClose = useCallback((tabId: string) => {
    editorCommandBus.dispatch({ type: 'navigation:close-tab', fileId: tabId });
  }, []);

  const handleCloseOtherTabs = useCallback((keepFileId: string) => {
    editorCommandBus.dispatch({ type: 'navigation:close-other-tabs', keepFileId });
  }, []);

  const handleCloseTabsToRight = useCallback((fromFileId: string) => {
    editorCommandBus.dispatch({ type: 'navigation:close-tabs-to-right', fromFileId });
  }, []);

  const handleCloseSavedTabs = useCallback(() => {
    editorCommandBus.dispatch({ type: 'navigation:close-saved-tabs' });
  }, []);

  const handleOpenToSide = useCallback((fileId: string) => {
    editorCommandBus.dispatch({ type: 'editor:open-to-side', fileId });
  }, []);

  const handleOpenTabSettings = useCallback(() => {
    useSettingsStore.getState().openSettingsModal('editor');
  }, []);

  useEffect(() => {
    if (!resolvedActiveTabId || !tabListRef.current || typeof document === 'undefined') return;
    const activeEl = document.getElementById(`editor-tab-${resolvedActiveTabId}`);
    if (activeEl && tabListRef.current.contains(activeEl)) {
      activeEl.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }, [resolvedActiveTabId]);

  const handlePrefetchTab = useCallback((tab: EditorTab) => {
    void navigationCoordinator.prefetchDocument(tab.id, tab.path || tab.title);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(tabs, oldIndex, newIndex);
      useWorkspaceStore.getState().reorderTabs(
        rootPageId,
        reordered.map((t) => t.id),
      );
    },
    [tabs, rootPageId],
  );

  const handleTabListKeyDown = (e: React.KeyboardEvent) => {
    if (tabs.length === 0) return;
    const currentIndex = tabs.findIndex((t) => t.id === resolvedActiveTabId);

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % tabs.length;
      handleTabActivate(tabs[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      handleTabActivate(tabs[prevIndex].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleTabActivate(tabs[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      handleTabActivate(tabs[tabs.length - 1].id);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && tabListRef.current) {
      tabListRef.current.scrollLeft += e.deltaY;
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-end h-9 bg-sidebar select-none border-b border-border w-full px-0.5 pt-0.5 relative">
      {/* ── File tabs (Drag-and-drop sortable; root tab pinned first) ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          <div
            ref={tabListRef}
            role="tablist"
            aria-label="Open document tabs"
            onKeyDown={handleTabListKeyDown}
            onWheel={handleWheel}
            className="flex h-full overflow-x-auto shrink min-w-0 scrollbar-none items-end gap-1"
          >
            {tabs.map((tab, idx) => {
              const isRoot =
                Boolean(tab.isRoot) ||
                tab.id === rootPageId ||
                tab.id === `${rootPageId}-main`;
              const hasClosableTabsToRight = tabs.some(
                (candidate, candidateIdx) =>
                  candidateIdx > idx &&
                  !(
                    Boolean(candidate.isRoot) ||
                    candidate.id === rootPageId ||
                    candidate.id === `${rootPageId}-main`
                  ) &&
                  !lruDocumentCache.isDirty(candidate.id),
              );
              const displayLabel = displayLabels.get(tab.id) ?? {
                leafTitle: tab.title,
                disambiguationDir: null,
                fullPath: tab.path || tab.title,
              };
              return (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  displayLabel={displayLabel}
                  isActive={tab.id === resolvedActiveTabId}
                  isRoot={isRoot}
                  rootPageId={rootPageId}
                  canClose={tabs.length > 1 && !isRoot}
                  hasClosableTabsToRight={hasClosableTabsToRight}
                  onActivate={handleTabActivate}
                  onPinTab={handlePinTab}
                  onCloseTab={handleTabClose}
                  onCloseOtherTabs={handleCloseOtherTabs}
                  onCloseTabsToRight={handleCloseTabsToRight}
                  onCloseSavedTabs={handleCloseSavedTabs}
                  onOpenToSide={handleOpenToSide}
                  onOpenTabSettings={handleOpenTabSettings}
                  onPrefetchTab={handlePrefetchTab}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Right side: Pane Actions (Split, etc.) ── */}
      {rightSlot && (
        <div className="ml-auto flex items-center h-full shrink-0 px-1.5 gap-1 border-l border-border/40">
          {rightSlot}
        </div>
      )}
    </div>
  );
}

export default EditorTabs;
