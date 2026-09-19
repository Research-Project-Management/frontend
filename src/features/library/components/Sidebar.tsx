'use client';

import { useId, useState, useMemo, useEffect } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import { Library, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { useCollections } from '../hooks/use-collections';
import { useItems } from '../hooks/use-items';
import { useDuplicateGroups } from '../hooks/use-curation';
import { useRetraction } from '../hooks/use-retraction';
import { useSavedSearches } from '../hooks/use-saved-searches';
import { useLibrarySidebarStore } from '../store/sidebar.store';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { useAuth } from '@/features/auth/hooks/use-auth';

import CreateCollectionModal from './modals/CreateCollectionModal';
import { CreateSavedSearchModal } from './modals/CreateSavedSearchModal';
import TrashModal from './modals/TrashModal';

import { buildTree, filterCollections } from './sidebar/utils/tree-helpers';
import { useSidebarResize } from './sidebar/hooks/use-sidebar-resize';
import { useCollectionActions } from './sidebar/hooks/use-collection-actions';
import { SidebarHeader } from './sidebar/components/SidebarHeader';
import { SidebarResizer } from './sidebar/components/SidebarResizer';
import { CollectionTree } from './sidebar/components/CollectionTree';
import { SidebarSystemNav } from './sidebar/components/SidebarSystemNav';
import { ProjectLibrariesSection, resolveProjectRole } from './sidebar/components/ProjectLibrariesSection';

export default function LibrarySideBar() {
  const { collectionId: activeId } = useParams() as {
    collectionId?: string;
  };
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = useId();

  const { activeScope, setActiveScope, isOpen, setIsOpen, width, setWidth, toggle } =
    useLibrarySidebarStore();
  const effectiveScopeId = activeScope.type === 'project' ? activeScope.id : 'user';

  const personalCollectionService = useCollections('user');
  const projectCollectionService = useCollections(
    activeScope.type === 'project' ? activeScope.id : undefined,
  );
  const collectionService =
    activeScope.type === 'project' ? projectCollectionService : personalCollectionService;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
  }, [setIsOpen]);

  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateSavedSearchOpen, setIsCreateSavedSearchOpen] = useState(false);

  const { isDragging, handleMouseDown } = useSidebarResize(width, setWidth);

  const basePath = '/library';
  const currentFilter = searchParams.get('filter');
  const currentSavedSearchId = searchParams.get('savedSearchId');

  const { projects } = useProjects();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const isPersonalScope = activeScope.type === 'personal';
  const isLibraryActive = isPersonalScope && pathname === basePath && !currentFilter && !activeId;

  const canManageCollections =
    activeScope.type === 'personal' ||
    activeScope.role === 'owner' ||
    activeScope.role === 'contributor';

  // Synchronize active project role with server-provided project list
  useEffect(() => {
    if (activeScope.type === 'project' && currentUserId && projects && projects.length > 0) {
      const currentProject = projects.find((p: any) => p.id === activeScope.id);
      if (currentProject) {
        const accurateRole = resolveProjectRole(currentProject, currentUserId);
        if (accurateRole !== activeScope.role) {
          setActiveScope({
            ...activeScope,
            role: accurateRole,
          });
        }
      }
    }
  }, [activeScope, currentUserId, projects, setActiveScope]);

  const { stats: retractionStats } = useRetraction(effectiveScopeId);
  const {
    savedSearches,
    createSavedSearch,
    deleteSavedSearch,
    isCreating: isCreatingSavedSearch,
  } = useSavedSearches(effectiveScopeId);
  const { data: allItems, actions: itemActions } = useItems(effectiveScopeId);
  const { data: duplicateData } = useDuplicateGroups(effectiveScopeId);

  const unfiledCount = useMemo(
    () => (allItems ?? []).filter((item) => !item.collectionId && !item.deletedAt).length,
    [allItems],
  );
  const starredCount = useMemo(
    () =>
      (allItems ?? []).filter(
        (item) =>
          !item.deletedAt &&
          ((typeof item.rating === 'number' && item.rating > 0) ||
            Boolean((item as any).isStarred) ||
            Boolean((item as any).states?.[0]?.rating > 0)),
      ).length,
    [allItems],
  );
  const duplicateCount = useMemo(() => {
    const data = duplicateData as any;
    return data?.groups?.length || data?.duplicateGroups?.length || 0;
  }, [duplicateData]);

  const systemStats = useMemo(
    () => ({
      unfiledCount,
      starredCount,
      duplicateCount,
      retractedCount: retractionStats?.retractedCount,
    }),
    [unfiledCount, starredCount, duplicateCount, retractionStats?.retractedCount],
  );

  const personalCollections = useMemo(
    () => personalCollectionService.state.collections ?? [],
    [personalCollectionService.state.collections],
  );

  const projectCollections = useMemo(
    () => (activeScope.type === 'project' ? projectCollectionService.state.collections ?? [] : []),
    [activeScope.type, projectCollectionService.state.collections],
  );

  const collections = useMemo(
    () => (activeScope.type === 'project' ? projectCollections : personalCollections),
    [activeScope.type, projectCollections, personalCollections],
  );

  const personalTree = useMemo(
    () => buildTree(filterCollections(personalCollections, searchQuery)),
    [personalCollections, searchQuery],
  );

  const projectTree = useMemo(
    () => buildTree(filterCollections(projectCollections, searchQuery)),
    [projectCollections, searchQuery],
  );

  const { modals, rename, handlers } = useCollectionActions({
    collectionService,
    effectiveScopeId,
    collections,
  });

  const handleMobileLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <aside
        aria-label="Library navigation and collections"
        style={{
          width: `${width}px`,
          minWidth: '220px',
          maxWidth: '400px',
        }}
        className="fixed inset-y-0 left-0 z-50 md:static md:z-auto h-full overflow-hidden border-r border-border bg-background flex flex-col select-none shrink-0 shadow-raised-200 md:shadow-none"
      >
        {/* Upper Area: Header, Collections Tree, Views */}
        <div className="flex-1 min-h-0 flex flex-col p-2.5 pt-4 pb-1 overflow-hidden">
          {/* Header with expandable search & controls */}
          <SidebarHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            canManageCollections={canManageCollections}
            onOpenCreateRoot={handlers.openCreateRoot}
            onOpenCreateSavedSearch={() => setIsCreateSavedSearchOpen(true)}
            onToggleCollapse={toggle}
          />

          {/* Navigation Links */}
          <LayoutGroup id={`library-nav-${id}`}>
            <nav
              aria-label="Library Navigation"
              className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col gap-1 pr-1"
            >
              {/* 1. My Library */}
              <div className="relative group/root flex items-center w-full">
                <Link
                  href={basePath}
                  onClick={() => {
                    setActiveScope({
                      type: 'personal',
                      id: 'user',
                      name: 'My Library',
                      role: 'owner',
                    });
                    handleMobileLinkClick();
                  }}
                  className={cn(
                    "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-8",
                    isLibraryActive
                      ? "bg-muted text-foreground font-medium"
                      : "text-foreground hover:bg-muted group-hover/root:bg-muted font-normal"
                  )}
                >
                  {isLibraryActive && (
                    <motion.div
                      layoutId={`library-nav-active-${id}`}
                      className="absolute inset-0 rounded-md bg-muted"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Library className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                  <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
                    My Library
                  </span>
                </Link>

                <Tooltip delayDuration={700}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsLibraryExpanded((v) => !v);
                      }}
                      aria-label={isLibraryExpanded ? 'Collapse My Library' : 'Expand My Library'}
                      className="absolute right-2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 text-foreground transition-transform duration-150 shrink-0',
                          isLibraryExpanded && 'rotate-90'
                        )}
                        strokeWidth={1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    alignOffset={2}
                    className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
                  >
                    {isLibraryExpanded ? 'Collapse' : 'Expand'}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Sub-items directly nested under My Library */}
              {isLibraryExpanded && (
                <div className="flex flex-col gap-1 w-full">
                  <SidebarSystemNav
                    basePath={basePath}
                    pathname={pathname}
                    currentFilter={currentFilter}
                    isPersonalScope={isPersonalScope}
                    navId={id}
                    savedSearches={savedSearches}
                    currentSavedSearchId={currentSavedSearchId}
                    stats={systemStats}
                    retractedCount={retractionStats?.retractedCount}
                    onDropItems={(ids, targetColId) => itemActions.batchMoveItems(ids, targetColId)}
                    onSelectPersonalScope={() => {
                      setActiveScope({
                        type: 'personal',
                        id: 'user',
                        name: 'My Library',
                        role: 'owner',
                      });
                      handleMobileLinkClick();
                    }}
                    onDeleteSavedSearch={(id) => deleteSavedSearch(id)}
                  >
                    {/* User Collections Tree */}
                    <CollectionTree
                      tree={personalTree}
                      allCollections={personalCollections}
                      basePath={basePath}
                      activeId={activeId ?? null}
                      navId={id}
                      renamingId={rename.renamingId}
                      renameValue={rename.renameValue}
                      isSearching={searchQuery.trim().length > 0}
                      searchQuery={searchQuery}
                      canManageCollections={canManageCollections}
                      onStartRename={handlers.startRename}
                      onSubmitRename={handlers.submitRename}
                      onRenameValueChange={rename.setRenameValue}
                      onDelete={handlers.handleDelete}
                      onDeleteWithItems={handlers.handleDeleteWithItems}
                      onMove={handlers.handleMove}
                      onCopy={handlers.handleCopy}
                      onCreateSub={handlers.openCreateSub}
                      onExportBibtex={handlers.handleExportBibtex}
                      onExportBundle={handlers.handleExportBundle}
                      onLinkClick={handleMobileLinkClick}
                      onDropItems={(ids, targetColId) => itemActions.batchMoveItems(ids, targetColId)}
                    />
                  </SidebarSystemNav>
                </div>
              )}

              {/* 2. Project Libraries (Collaborative Research Groups) */}
              <ProjectLibrariesSection
                projects={projects}
                activeScope={activeScope}
                currentUserId={currentUserId}
                basePath={basePath}
                navId={id}
                projectTree={projectTree}
                projectCollections={projectCollections}
                savedSearches={savedSearches}
                currentSavedSearchId={currentSavedSearchId}
                currentFilter={currentFilter}
                activeId={activeId ?? null}
                isSearching={searchQuery.trim().length > 0}
                searchQuery={searchQuery}
                renamingId={rename.renamingId}
                renameValue={rename.renameValue}
                canManageCollections={canManageCollections}
                onSelectProject={(scope) => {
                  setActiveScope(scope);
                  router.push(basePath);
                  handleMobileLinkClick();
                }}
                onStartRename={handlers.startRename}
                onSubmitRename={handlers.submitRename}
                onRenameValueChange={rename.setRenameValue}
                onDelete={handlers.handleDelete}
                onDeleteWithItems={handlers.handleDeleteWithItems}
                onMove={handlers.handleMove}
                onCopy={handlers.handleCopy}
                onCreateSub={handlers.openCreateSub}
                onExportBibtex={handlers.handleExportBibtex}
                onExportBundle={handlers.handleExportBundle}
                onLinkClick={handleMobileLinkClick}
                onDropItems={(ids, targetColId) => itemActions.batchMoveItems(ids, targetColId)}
              />
            </nav>
          </LayoutGroup>
        </div>

        {/* Drag Handle for Resizing */}
        <SidebarResizer
          width={width}
          setWidth={setWidth}
          isDragging={isDragging}
          onMouseDown={handleMouseDown}
        />

        {/* Modals */}
        <CreateCollectionModal
          open={modals.createOpen}
          onOpenChange={(v: boolean) => {
            modals.setCreateOpen(v);
            if (!v) {
              modals.setCreateParentId(null);
            }
          }}
          onSubmit={handlers.handleCreate}
          isPending={collectionService.state.isCreating}
          collections={collections}
          defaultParentId={modals.createParentId}
        />

        <TrashModal
          open={modals.isTrashOpen}
          onOpenChange={modals.setIsTrashOpen}
          target={modals.trashTarget}
          onConfirm={handlers.handleConfirmTrash}
          isPending={collectionService.state.isDeleting}
        />

        <CreateSavedSearchModal
          open={isCreateSavedSearchOpen}
          onOpenChange={setIsCreateSavedSearchOpen}
          onSubmit={async (data: any) => {
            await createSavedSearch(data);
          }}
          isPending={isCreatingSavedSearch}
        />
      </aside>
    </>
  );
}
