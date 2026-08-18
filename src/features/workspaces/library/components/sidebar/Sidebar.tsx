'use client';

import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import {
  FolderOpen,
  Folder,
  FolderPlus,
  FolderInput,
  FolderMinus,
  MoreVertical,
  Pencil,
  Trash2,
  Library,
  ChevronRight,
  Copy,
  Search,
  Plus,
  Star,
  History,
  Inbox,
  Files,
  PanelLeft,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useCollections } from '@/features/workspaces/library/hooks/data/use-collections';
import { usePapers } from '@/features/workspaces/library/hooks/data/use-papers';
import { useLibrarySidebarStore } from '@/features/workspaces/library/store/sidebar.store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui';
import CreateCollectionModal from '../system/CreateCollectionModal';
import TagSelector from '../topbar/TagSelector';
import type { Collection, CollectionInput } from '@/features/workspaces/library/types/library.types';

// ── Tree Builder ──────────────────────────────────────────────────────────────

type TreeNode = Collection & { children: TreeNode[] };

function buildTree(collections: Collection[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const c of collections) {
    if (!c.id) continue;
    map.set(c.id, { ...c, children: [] });
  }

  for (const node of map.values()) {
    const parentId = node.parentId || node.parent;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function getValidMoveTargets(allCollections: Collection[], currentId: string): Collection[] {
  const descendantIds = new Set<string>([currentId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of allCollections) {
      const parentId = c.parentId || c.parent;
      if (parentId && descendantIds.has(parentId) && !descendantIds.has(c.id)) {
        descendantIds.add(c.id);
        added = true;
      }
    }
  }
  return allCollections.filter((c) => !descendantIds.has(c.id));
}

// ── Collection Node Component (Clean storage-matching style) ──────────────────

interface NodeProps {
  node: TreeNode;
  depth: number;
  basePath: string;
  activeId: string | string[] | null;
  navId: string;
  renamingId: string | null;
  renameValue: string;
  allCollections: Collection[];
  isSearching: boolean;
  onStartRename: (id: string, name: string) => void;
  onSubmitRename: (id: string) => void;
  onRenameValueChange: (v: string) => void;
  onDelete: (id: string) => void;
  onDeleteWithItems: (id: string) => void;
  onMove: (collectionId: string, newParentId: string | null) => void;
  onCopy: (collectionId: string, targetParentId: string | null) => void;
  onCreateSub: (parentId: string, parentName: string) => void;
}

function CollectionNode({
  node,
  depth,
  basePath,
  activeId,
  navId,
  renamingId,
  renameValue,
  allCollections,
  isSearching,
  onStartRename,
  onSubmitRename,
  onRenameValueChange,
  onDelete,
  onDeleteWithItems,
  onMove,
  onCopy,
  onCreateSub,
}: NodeProps) {
  const to = `${basePath}/${node.id}`;
  const isActive = activeId === node.id;
  const hasChildren = node.children.length > 0;
  const [isOpen, setIsOpen] = useState(true);

  // Indentation: 12px per depth level
  const paddingLeft = depth * 12 + 8;
  const validMoveTargets = getValidMoveTargets(allCollections, node.id);
  const effectiveIsOpen = isSearching ? true : isOpen;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="group/node relative flex items-center w-full my-0.5">
        {isActive && (
          <motion.div
            layoutId={`col-active-${navId}`}
            className="absolute inset-0 rounded-md bg-accent"
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}

        {renamingId === node.id ? (
          <div
            className="relative z-10 flex h-8.5 w-full items-center pr-2 min-w-0"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onBlur={() => onSubmitRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmitRename(node.id);
                if (e.key === 'Escape') onSubmitRename('__cancel__');
              }}
              className="h-7 w-full min-w-0 rounded border border-primary bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>
        ) : (
          <div
            className={cn(
              'relative z-10 flex h-8.5 w-full items-center gap-1.5 rounded-md pr-1.5 transition-colors cursor-pointer select-none',
              isActive
                ? 'text-foreground font-semibold'
                : 'text-foreground hover:bg-accent font-medium'
            )}
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen((v) => !v);
                }}
                aria-label={effectiveIsOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                className="flex size-4 shrink-0 items-center justify-center rounded text-foreground hover:bg-muted transition-colors"
              >
                <ChevronRight
                  className={cn('size-3 text-foreground transition-transform duration-150', effectiveIsOpen && 'rotate-90')}
                />
              </button>
            ) : (
              <div className="size-4 shrink-0" />
            )}

            <Link
              href={to}
              className="flex flex-1 min-w-0 items-center gap-2 py-0.5 outline-none"
            >
              {hasChildren && effectiveIsOpen ? (
                <FolderOpen className="size-3.5 shrink-0 text-foreground transition-colors" />
              ) : (
                <Folder className="size-3.5 shrink-0 text-foreground transition-colors" />
              )}

              <span
                className={cn(
                  'flex-1 min-w-0 truncate text-xs text-foreground',
                  isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {node.name}
              </span>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-foreground opacity-0 group-hover/node:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 hover:bg-muted hover:text-foreground transition-opacity hover:transition-colors cursor-pointer outline-none"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Options for ${node.name}`}
                >
                  <MoreVertical className="size-3.5 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="end"
                sideOffset={4}
                collisionPadding={12}
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="w-56 p-1 rounded-lg shadow-xl z-50 text-xs"
              >
                <DropdownMenuItem
                  onClick={() => onCreateSub(node.id, node.name)}
                  className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                >
                  <FolderPlus className="size-3.5 text-foreground" />
                  <span>New Subcollection...</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onStartRename(node.id, node.name)}
                  className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                >
                  <Pencil className="size-3.5 text-foreground" />
                  <span>Rename Collection</span>
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer">
                    <FolderInput className="size-3.5 text-foreground" />
                    <span>Move To</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52 p-1 rounded-lg shadow-lg text-xs">
                    <DropdownMenuItem
                      onClick={() => onMove(node.id, null)}
                      className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                    >
                      <Library className="size-3.5 text-foreground" />
                      <span>My Library (Root)</span>
                    </DropdownMenuItem>
                    {validMoveTargets.map((target) => (
                      <DropdownMenuItem
                        key={target.id}
                        onClick={() => onMove(node.id, target.id)}
                        className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                      >
                        <Folder className="size-3.5 text-foreground" />
                        <span className="truncate">{target.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer">
                    <Copy className="size-3.5 text-foreground" />
                    <span>Copy To</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52 p-1 rounded-lg shadow-lg text-xs">
                    <DropdownMenuItem
                      onClick={() => onCopy(node.id, null)}
                      className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                    >
                      <Library className="size-3.5 text-foreground" />
                      <span>My Library</span>
                    </DropdownMenuItem>
                    {validMoveTargets.map((target) => (
                      <DropdownMenuItem
                        key={target.id}
                        onClick={() => onCopy(node.id, target.id)}
                        className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                      >
                        <Folder className="size-3.5 text-foreground" />
                        <span className="truncate">{target.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem
                  className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                  onClick={() => onDelete(node.id)}
                >
                  <FolderMinus className="size-3.5 text-foreground" />
                  <span>Delete Collection...</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer text-foreground"
                  onClick={() => onDeleteWithItems(node.id)}
                >
                  <Trash2 className="size-3.5 text-foreground" />
                  <span>Delete Collection & Items</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {hasChildren && effectiveIsOpen && (
        <div className="flex flex-col gap-0.5 my-0.5">
          {node.children.map((child) => (
            <CollectionNode
              key={child.id}
              node={child}
              depth={depth + 1}
              basePath={basePath}
              activeId={activeId}
              navId={navId}
              renamingId={renamingId}
              renameValue={renameValue}
              allCollections={allCollections}
              isSearching={isSearching}
              onStartRename={onStartRename}
              onSubmitRename={onSubmitRename}
              onRenameValueChange={onRenameValueChange}
              onDelete={onDelete}
              onDeleteWithItems={onDeleteWithItems}
              onMove={onMove}
              onCopy={onCopy}
              onCreateSub={onCreateSub}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Library Sidebar (Directly matching Storage Sidebar specs) ────────────

export default function LibrarySideBar() {
  const { workspaceId: workspaceUrl, collectionId: activeId } = useParams() as {
    workspaceId: string;
    collectionId: string;
  };
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = useId();

  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?.id || workspaceUrl || '';

  const collectionService = useCollections(workspaceId);
  const paperService = usePapers({ workspaceId });

  const { width, setWidth, toggle } = useLibrarySidebarStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);

  // Resizable drag handle state
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      setWidth(startWidthRef.current + deltaX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, setWidth]);

  // Expandable search state matching topbar
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const expandSearch = () => {
    if (!isSearchExpanded) {
      setIsSearchExpanded(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const collapseSearch = () => {
    if (!searchQuery) {
      setIsSearchExpanded(false);
    }
  };

  const handleClearSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchQuery('');
    setIsSearchExpanded(false);
  };

  const basePath = `/${workspaceUrl}/library`;
  const currentFilter = searchParams.get('filter');
  const currentTag = searchParams.get('tag');

  const isLibraryActive = pathname === basePath && !currentFilter && !currentTag && !activeId;
  const isStarredActive = pathname === `${basePath}/favorites` || (pathname === basePath && currentFilter === 'starred');
  const isRecentReadActive = pathname === `${basePath}/recently-read` || (pathname === basePath && currentFilter === 'recent-read');
  const isUnfiledActive = pathname === `${basePath}/unfiled` || (pathname === basePath && currentFilter === 'unfiled');
  const isDuplicatesActive = pathname === `${basePath}/duplicates` || (pathname === basePath && currentFilter === 'duplicates');
  const isTrashActive = pathname === `${basePath}/trash` || (pathname === basePath && currentFilter === 'trash');

  const collections = collectionService.state.collections ?? [];
  const papers = paperService.state.allPapers ?? [];

  // Extract tags from papers
  const { allTags, tagCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of papers) {
      if (p.deletedAt) continue;
      if (p.labels) {
        for (const l of p.labels) {
          counts[l] = (counts[l] || 0) + 1;
        }
      }
    }
    return {
      allTags: Object.keys(counts).sort(),
      tagCounts: counts,
    };
  }, [papers]);

  // Filter collections by search query
  const filteredCollections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return collections;

    const matchingIds = new Set<string>();
    for (const c of collections) {
      if (c.name.toLowerCase().includes(q)) {
        matchingIds.add(c.id);
        let curr = c;
        const currParentId = curr.parentId || curr.parent;
        while (currParentId) {
          matchingIds.add(currParentId);
          const parentObj = collections.find((p) => p.id === currParentId);
          if (!parentObj) break;
          curr = parentObj;
        }
      }
    }
    return collections.filter((c) => matchingIds.has(c.id));
  }, [collections, searchQuery]);

  const tree = buildTree(filteredCollections);

  const handleCreate = (data: CollectionInput) => {
    collectionService.actions.create(
      { ...data, parent: data.parent ?? createParentId },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setCreateParentId(null);
        },
      },
    );
  };

  const openCreateSub = (parentId: string, _parentName: string) => {
    setCreateParentId(parentId);
    setCreateOpen(true);
  };

  const openCreateRoot = () => {
    setCreateParentId(null);
    setCreateOpen(true);
  };

  const startRename = (colId: string, name: string) => {
    setRenamingId(colId);
    setRenameValue(name);
  };

  const submitRename = (collectionId: string) => {
    if (collectionId !== '__cancel__') {
      const trimmed = renameValue.trim();
      if (trimmed) collectionService.actions.update({ collectionId, name: trimmed });
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDelete = (collectionId: string) => {
    if (!confirm('Delete this collection? (Papers will remain in My Library)')) return;
    collectionService.actions.delete(collectionId);
  };

  const handleDeleteWithItems = (collectionId: string) => {
    if (!confirm('Delete this collection and all papers contained in it?')) return;
    collectionService.actions.delete(collectionId);
  };

  const handleMove = (collectionId: string, newParentId: string | null) => {
    collectionService.actions.update({ collectionId, parent: newParentId });
  };

  const handleCopy = (collectionId: string, targetParentId: string | null) => {
    const target = collections.find((c) => c.id === collectionId);
    if (!target) return;
    collectionService.actions.create({
      name: `${target.name} (Copy)`,
      description: target.description,
      color: target.color,
      icon: target.icon,
      parent: targetParentId,
    });
  };

  const handleSelectTag = (tag: string | null) => {
    if (tag) {
      router.push(`${basePath}?tag=${encodeURIComponent(tag)}`);
    } else {
      router.push(basePath);
    }
  };

  const sharedNodeProps = {
    basePath,
    activeId: activeId ?? null,
    navId: id,
    renamingId,
    renameValue,
    allCollections: collections,
    isSearching: searchQuery.trim().length > 0,
    onStartRename: startRename,
    onSubmitRename: submitRename,
    onRenameValueChange: setRenameValue,
    onDelete: handleDelete,
    onDeleteWithItems: handleDeleteWithItems,
    onMove: handleMove,
    onCopy: handleCopy,
    onCreateSub: openCreateSub,
  };

  return (
    <aside
      aria-label="Library navigation and collections"
      style={{
        width: `${width}px`,
        minWidth: '210px',
        maxWidth: '500px',
      }}
      className="relative h-full overflow-x-hidden border-r border-border/50 bg-transparent p-2 py-4 flex flex-col select-none shrink-0"
    >
      {/* Header: Matching Projects Sidebar with expandable search */}
      <div className="mb-3 px-2 h-8 flex items-center justify-between font-semibold text-base tracking-tight text-foreground select-none">
        {isSearchExpanded || searchQuery ? (
          <div className="flex items-center w-full h-8 rounded-md border border-border/60 bg-background/80 focus-within:bg-background focus-within:border-primary/50 transition-colors px-2">
            <Search className="size-3.5 text-muted-foreground shrink-0 pointer-events-none mr-2" />
            <input
              ref={searchInputRef}
              autoFocus
              placeholder="Search collections..."
              aria-label="Search collections"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setIsSearchExpanded(false);
                }
              }}
              onBlur={() => {
                if (!searchQuery) {
                  setIsSearchExpanded(false);
                }
              }}
              className="h-full flex-1 min-w-0 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground/60 border-none p-0"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearSearch}
              className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer rounded shrink-0 ml-1 transition-colors"
              aria-label="Close search"
              title="Close search"
            >
              <Plus className="size-3.5 rotate-45" />
            </button>
          </div>
        ) : (
          <>
            <span className="truncate min-w-0">Library</span>

            <div className="flex items-center gap-0.5 shrink-0">
              <TooltipProvider delayDuration={150}>
                {/* Search collections toggle button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={expandSearch}
                      className="rounded-md p-1.5 text-foreground hover:bg-muted/80 cursor-pointer transition-colors outline-none"
                      aria-label="Search collections"
                    >
                      <Search className="size-4 text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    Search collections
                  </TooltipContent>
                </Tooltip>

                {/* New collection button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={openCreateRoot}
                      className="rounded-md p-1.5 text-foreground hover:bg-muted/80 cursor-pointer transition-colors outline-none"
                      aria-label="New collection"
                    >
                      <FolderPlus className="size-4.5 text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    New collection
                  </TooltipContent>
                </Tooltip>

                {/* Toggle / Collapse Sidebar Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggle}
                      aria-label="Toggle sidebar"
                      className="rounded-md p-1.5 text-foreground hover:bg-muted/80 cursor-pointer transition-colors outline-none"
                    >
                      <PanelLeft className="size-4.5 text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={6}>
                    Toggle sidebar
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        )}
      </div>

      {/* Navigation Links: Exactly matching Storage items h-10 gap-2.5 px-2.5 text-sm */}
      <LayoutGroup id={`library-nav-${id}`}>
        <nav
          aria-label="Library Navigation"
          className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col gap-1 pr-1"
        >
          {/* 1. My Library */}
          <div className="relative group/root flex items-center w-full">
            <Link
              href={basePath}
              className={cn(
                'group/item relative flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground select-none',
                isLibraryActive ? 'font-semibold' : 'font-medium',
                tree.length > 0 && 'pr-8'
              )}
            >
              {isLibraryActive && (
                <motion.div
                  layoutId={`library-nav-active-${id}`}
                  className="absolute inset-0 rounded-md bg-accent"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Library className="relative z-10 size-4 shrink-0 text-foreground" />
              <span className="relative z-10 min-w-0 truncate text-foreground flex-1">
                My Library
              </span>
            </Link>

            {tree.length > 0 && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsLibraryExpanded((v) => !v);
                }}
                aria-label={isLibraryExpanded ? 'Collapse collections' : 'Expand collections'}
                className="absolute right-2 z-20 flex size-5 shrink-0 items-center justify-center rounded text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 text-foreground transition-transform duration-150',
                    isLibraryExpanded && 'rotate-90'
                  )}
                />
              </button>
            )}
          </div>

          {/* Collections Tree (Nested directly under My Library) */}
          {tree.length > 0 && isLibraryExpanded && (
            <div className="flex flex-col gap-0.5 my-0.5">
              {tree.map((node) => (
                <CollectionNode
                  key={node.id}
                  node={node}
                  depth={0}
                  {...sharedNodeProps}
                />
              ))}
            </div>
          )}

          {/* Empty Search Result */}
          {searchQuery.trim().length > 0 && tree.length === 0 && (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No matching collections
            </div>
          )}

          {/* 2. Recently Read */}
          <Link
            href={`${basePath}/recently-read`}
            className={cn(
              'group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground select-none',
              isRecentReadActive ? 'font-semibold' : 'font-medium'
            )}
          >
            {isRecentReadActive && (
              <motion.div
                layoutId={`library-nav-active-${id}`}
                className="absolute inset-0 rounded-md bg-accent"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <History className="relative z-10 size-4 shrink-0 text-foreground" />
            <span className="relative z-10 min-w-0 truncate text-foreground flex-1">
              Recently Read
            </span>
          </Link>

          {/* 3. Favorites */}
          <Link
            href={`${basePath}/favorites`}
            className={cn(
              'group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground select-none',
              isStarredActive ? 'font-semibold' : 'font-medium'
            )}
          >
            {isStarredActive && (
              <motion.div
                layoutId={`library-nav-active-${id}`}
                className="absolute inset-0 rounded-md bg-accent"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Star className="relative z-10 size-4 shrink-0 text-foreground" />
            <span className="relative z-10 min-w-0 truncate text-foreground flex-1">
              Favorites
            </span>
          </Link>

          {/* 4. Duplicate Items */}
          <Link
            href={`${basePath}/duplicates`}
            className={cn(
              'group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground select-none',
              isDuplicatesActive ? 'font-semibold' : 'font-medium'
            )}
          >
            {isDuplicatesActive && (
              <motion.div
                layoutId={`library-nav-active-${id}`}
                className="absolute inset-0 rounded-md bg-accent"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Files className="relative z-10 size-4 shrink-0 text-foreground" />
            <span className="relative z-10 min-w-0 truncate text-foreground flex-1">
              Duplicate Items
            </span>
          </Link>

          {/* 5. Unfiled Items */}
          <Link
            href={`${basePath}/unfiled`}
            className={cn(
              'group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground select-none',
              isUnfiledActive ? 'font-semibold' : 'font-medium'
            )}
          >
            {isUnfiledActive && (
              <motion.div
                layoutId={`library-nav-active-${id}`}
                className="absolute inset-0 rounded-md bg-accent"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Inbox className="relative z-10 size-4 shrink-0 text-foreground" />
            <span className="relative z-10 min-w-0 truncate text-foreground flex-1">
              Unfiled Items
            </span>
          </Link>

          {/* 6. Trash */}
          <Link
            href={`${basePath}/trash`}
            className={cn(
              'group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground select-none',
              isTrashActive ? 'font-semibold' : 'font-medium'
            )}
          >
            {isTrashActive && (
              <motion.div
                layoutId={`library-nav-active-${id}`}
                className="absolute inset-0 rounded-md bg-accent"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Trash2 className="relative z-10 size-4 shrink-0 text-foreground" />
            <span className="relative z-10 min-w-0 truncate text-foreground flex-1">
              Trash
            </span>
          </Link>
        </nav>
      </LayoutGroup>

      {/* Tag Selector at Bottom */}
      <TagSelector
        tags={allTags}
        selectedTag={currentTag}
        onSelectTag={handleSelectTag}
        tagCounts={tagCounts}
      />

      {/* Drag Handle for Resizing */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 transition-colors z-30 select-none",
          isDragging && "bg-primary/50"
        )}
      />

      <CreateCollectionModal
        open={createOpen}
        onOpenChange={(v: boolean) => {
          setCreateOpen(v);
          if (!v) {
            setCreateParentId(null);
          }
        }}
        onSubmit={handleCreate}
        isPending={collectionService.state.isCreating}
        collections={collections}
        defaultParentId={createParentId}
      />
    </aside>
  );
}
