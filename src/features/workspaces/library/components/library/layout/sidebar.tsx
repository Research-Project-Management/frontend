'use client';

import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  PanelLeftClose,
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
import CreateCollectionModal from '../modals/create-collection-modal';
import TagSelector from './tag-selector';
import type { Collection } from '@/features/workspaces/library/types/library.types';

// ── Tree Builder ──────────────────────────────────────────────────────────────

type TreeNode = Collection & { children: TreeNode[] };

function buildTree(collections: Collection[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const c of collections) {
    map.set(c._id, { ...c, children: [] });
  }

  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) {
      map.get(node.parent)!.children.push(node);
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
      if (c.parent && descendantIds.has(c.parent) && !descendantIds.has(c._id)) {
        descendantIds.add(c._id);
        added = true;
      }
    }
  }
  return allCollections.filter((c) => !descendantIds.has(c._id));
}

// ── Collection Node Component (Zotero-style) ───────────────────────────────────

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
  const to = `${basePath}/${node._id}`;
  const isActive = activeId === node._id;
  const hasChildren = node.children.length > 0;
  const [isOpen, setIsOpen] = useState(true);

  // Clean compact indentation: 10px per depth + 6px base
  const paddingLeft = depth * 10 + 6;
  const validMoveTargets = getValidMoveTargets(allCollections, node._id);
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

        {renamingId === node._id ? (
          <div
            className="relative z-10 flex h-8 w-full items-center pr-2"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onBlur={() => onSubmitRename(node._id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmitRename(node._id);
                if (e.key === 'Escape') onSubmitRename('__cancel__');
              }}
              className="h-7 w-full rounded border border-primary bg-background px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>
        ) : (
          <div
            className={cn(
              'relative z-10 flex h-8 w-full items-center gap-1 rounded-md pr-1.5 transition-colors cursor-pointer select-none',
              isActive
                ? 'text-foreground font-semibold'
                : 'text-foreground/80 hover:text-foreground hover:bg-accent/60 font-normal'
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
                className="flex size-3.5 shrink-0 items-center justify-center rounded text-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <ChevronRight
                  className={cn('size-3 text-foreground transition-transform duration-150', effectiveIsOpen && 'rotate-90')}
                />
              </button>
            ) : (
              <div className="size-3.5 shrink-0" />
            )}

            <Link
              href={to}
              className="flex flex-1 min-w-0 items-center gap-1.5 py-0.5 outline-none"
            >
              {hasChildren && effectiveIsOpen ? (
                <FolderOpen className="size-3.5 shrink-0 text-foreground transition-colors" />
              ) : (
                <Folder className="size-3.5 shrink-0 text-foreground transition-colors" />
              )}

              <span
                className={cn(
                  'flex-1 min-w-0 truncate text-xs',
                  isActive ? 'font-medium text-foreground' : 'text-foreground/90 group-hover/node:text-foreground'
                )}
              >
                {node.name}
              </span>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-foreground opacity-0 group-hover/node:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 hover:bg-muted/80 hover:text-foreground transition-all cursor-pointer outline-none"
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
                className="w-64 min-w-[250px] p-1.5 rounded-lg shadow-xl z-50"
              >
                <DropdownMenuItem
                  onClick={() => onCreateSub(node._id, node.name)}
                  className="gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap"
                >
                  <FolderPlus className="size-4 text-muted-foreground" />
                  New Subcollection...
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onStartRename(node._id, node.name)}
                  className="gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap"
                >
                  <Pencil className="size-4 text-muted-foreground" />
                  Rename Collection
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap">
                    <FolderInput className="size-4 text-muted-foreground" />
                    Move To
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56 min-w-[220px] p-1.5 rounded-lg shadow-lg">
                    <DropdownMenuItem
                      onClick={() => onMove(node._id, null)}
                      className="gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap"
                    >
                      <Library className="size-4 text-foreground" />
                      My Library (Root)
                    </DropdownMenuItem>
                    {validMoveTargets.map((target) => (
                      <DropdownMenuItem
                        key={target._id}
                        onClick={() => onMove(node._id, target._id)}
                        className="gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap"
                      >
                        <Folder className="size-4 text-muted-foreground" />
                        <span className="truncate">{target.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap">
                    <Copy className="size-4 text-muted-foreground" />
                    Copy To
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56 min-w-[220px] p-1.5 rounded-lg shadow-lg">
                    <DropdownMenuItem
                      onClick={() => onCopy(node._id, null)}
                      className="gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap"
                    >
                      <Library className="size-4 text-foreground" />
                      My Library
                    </DropdownMenuItem>
                    {validMoveTargets.map((target) => (
                      <DropdownMenuItem
                        key={target._id}
                        onClick={() => onCopy(node._id, target._id)}
                        className="gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap"
                      >
                        <Folder className="size-4 text-muted-foreground" />
                        <span className="truncate">{target.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem
                  className="gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap"
                  onClick={() => onDelete(node._id)}
                >
                  <FolderMinus className="size-4 text-muted-foreground" />
                  Delete Collection...
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="text-destructive focus:text-destructive gap-2.5 px-2.5 py-2 text-sm whitespace-nowrap"
                  onClick={() => onDeleteWithItems(node._id)}
                >
                  <Trash2 className="size-4" />
                  Delete Collection and Items...
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
              key={child._id}
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

// ── Main Zotero-style Sidebar Component ───────────────────────────────────────

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
  const workspaceId = workspace?._id ?? '';

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
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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

  // Computed counts for Zotero smart views
  const {
    allTags,
    tagCounts,
    totalPapersCount,
    starredCount,
    recentReadCount,
    unfiledCount,
    duplicatesCount,
    trashCount,
  } = useMemo(() => {
    const counts: Record<string, number> = {};
    let starred = 0;
    let recentRead = 0;
    let unfiled = 0;
    let trash = 0;
    let total = 0;

    const doiMap = new Map<string, string[]>();
    const titleMap = new Map<string, string[]>();

    for (const p of papers) {
      if (p.deletedAt) {
        trash++;
        continue;
      }

      total++;
      if (p.labels?.includes('starred') || p.labels?.includes('favorite')) starred++;
      if (p.accessedAt) recentRead++;
      if (!p.collectionId) unfiled++;

      if (p.doi && p.doi.trim()) {
        const d = p.doi.trim().toLowerCase();
        doiMap.set(d, [...(doiMap.get(d) || []), p._id]);
      }
      if (p.title && p.title.trim()) {
        const t = p.title.trim().toLowerCase();
        titleMap.set(t, [...(titleMap.get(t) || []), p._id]);
      }

      if (p.labels) {
        for (const l of p.labels) {
          counts[l] = (counts[l] || 0) + 1;
        }
      }
    }

    const dupIds = new Set<string>();
    for (const ids of doiMap.values()) {
      if (ids.length > 1) ids.forEach((id) => dupIds.add(id));
    }
    for (const ids of titleMap.values()) {
      if (ids.length > 1) ids.forEach((id) => dupIds.add(id));
    }

    return {
      allTags: Object.keys(counts).sort(),
      tagCounts: counts,
      totalPapersCount: total,
      starredCount: starred,
      recentReadCount: recentRead,
      unfiledCount: unfiled,
      duplicatesCount: dupIds.size,
      trashCount: trash,
    };
  }, [papers]);

  // Filter collections by search query
  const filteredCollections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return collections;

    const matchingIds = new Set<string>();
    for (const c of collections) {
      if (c.name.toLowerCase().includes(q)) {
        matchingIds.add(c._id);
        let curr = c;
        while (curr.parent) {
          matchingIds.add(curr.parent);
          const parentObj = collections.find((p) => p._id === curr.parent);
          if (!parentObj) break;
          curr = parentObj;
        }
      }
    }
    return collections.filter((c) => matchingIds.has(c._id));
  }, [collections, searchQuery]);

  const tree = buildTree(filteredCollections);

  const handleCreate = (data: any) => {
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
    const target = collections.find((c) => c._id === collectionId);
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
        width: `${Math.min(Math.max(width, 240), 700)}px`,
        minWidth: '240px',
        maxWidth: '700px',
      }}
      className="relative h-full overflow-x-hidden border-r border-border/50 bg-background/50 flex flex-col select-none shrink-0"
    >
      {/* Header bar without dividing line */}
      <div className="h-14 px-3 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-base tracking-tight text-foreground truncate pl-1">
            Library
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Expandable Search Input */}
          <div
            className={cn(
              "relative flex items-center transition-all duration-300 ease-in-out h-7 rounded-lg overflow-hidden group",
              isSearchExpanded || searchQuery
                ? "w-32 border border-border/50 bg-background"
                : "w-7 hover:bg-secondary/80 cursor-pointer"
            )}
            onClick={expandSearch}
          >
            <Search
              className={cn(
                "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 text-foreground",
                isSearchExpanded || searchQuery ? "left-2 translate-x-0" : "left-1/2 -translate-x-1/2"
              )}
            />
            <input
              ref={searchInputRef}
              placeholder="Search..."
              aria-label="Search collections"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={collapseSearch}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  setIsSearchExpanded(false);
                }
              }}
              className={cn(
                "h-full text-xs py-0 leading-none border-none bg-transparent focus:outline-none focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-opacity duration-200 pl-6 pr-6",
                isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              autoFocus={isSearchExpanded}
            />
            {/* Clear Button */}
            {searchQuery && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearSearch}
                className="absolute right-1.5 text-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <Plus className="size-3 rotate-45 text-foreground" />
              </button>
            )}
          </div>

          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={openCreateRoot}
                  className="flex size-7 items-center justify-center rounded-md text-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0 cursor-pointer outline-none"
                  aria-label="New Collection"
                >
                  <FolderPlus className="size-4 text-foreground" />
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
                  className="flex size-7 items-center justify-center rounded-md text-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0 cursor-pointer outline-none"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="size-4 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Navigation Links & Collections Tree */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto p-2 flex flex-col gap-0.5">
        {/* 1. Root Node: "My Library" */}
        <div className="relative group/root flex items-center w-full">
          {isLibraryActive && (
            <motion.div
              layoutId={`library-active-${id}`}
              className="absolute inset-0 rounded-md bg-accent"
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}

          <div
            className={cn(
              'relative z-10 flex h-9 w-full items-center gap-2 rounded-md px-2.5 transition-colors cursor-pointer select-none text-foreground hover:bg-accent/60',
              isLibraryActive
                ? 'font-semibold'
                : 'font-medium'
            )}
          >
            <Link
              href={basePath}
              className="flex flex-1 min-w-0 items-center gap-2.5 py-1 outline-none"
            >
              <Library
                className="size-4 shrink-0 transition-colors text-foreground"
              />
              <span className="flex-1 truncate text-sm font-medium text-foreground">My Library</span>
            </Link>

            {tree.length > 0 && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsLibraryExpanded((v) => !v);
                }}
                aria-label={isLibraryExpanded ? 'Collapse collections' : 'Expand collections'}
                className="flex size-5 shrink-0 items-center justify-center rounded text-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 transition-transform duration-150 text-foreground',
                    isLibraryExpanded && 'rotate-90'
                  )}
                />
              </button>
            )}
          </div>
        </div>

        {/* Collections Tree (Nested directly under My Library) */}
        {tree.length > 0 && isLibraryExpanded && (
          <div className="flex flex-col gap-0.5 my-0.5">
            {tree.map((node) => (
              <CollectionNode
                key={node._id}
                node={node}
                depth={1}
                {...sharedNodeProps}
              />
            ))}
          </div>
        )}

        {/* Empty Search Result (only when searching collections) */}
        {searchQuery.trim().length > 0 && tree.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No matching collections
          </div>
        )}

        {/* 2. Recently Read */}
        <div className="relative group/recent-read flex items-center w-full">
          {isRecentReadActive && (
            <motion.div
              layoutId={`recent-read-active-${id}`}
              className="absolute inset-0 rounded-md bg-accent"
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}

          <div
            className={cn(
              'relative z-10 flex h-9 w-full items-center gap-2 rounded-md px-2.5 transition-colors cursor-pointer select-none text-foreground hover:bg-accent/60',
              isRecentReadActive
                ? 'font-semibold'
                : 'font-medium'
            )}
          >
            <Link
              href={`${basePath}/recently-read`}
              className="flex flex-1 min-w-0 items-center gap-2.5 py-1 outline-none"
            >
              <History
                className="size-4 shrink-0 transition-colors text-foreground"
              />
              <span className="flex-1 truncate text-sm font-medium text-foreground">Recently Read</span>
            </Link>
          </div>
        </div>

        {/* 3. Favorites (Outline Only, No Black Fill) */}
        <div className="relative group/starred flex items-center w-full">
          {isStarredActive && (
            <motion.div
              layoutId={`starred-active-${id}`}
              className="absolute inset-0 rounded-md bg-accent"
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}

          <div
            className={cn(
              'relative z-10 flex h-9 w-full items-center gap-2 rounded-md px-2.5 transition-colors cursor-pointer select-none text-foreground hover:bg-accent/60',
              isStarredActive
                ? 'font-semibold'
                : 'font-medium'
            )}
          >
            <Link
              href={`${basePath}/favorites`}
              className="flex flex-1 min-w-0 items-center gap-2.5 py-1 outline-none"
            >
              <Star
                className="size-4 shrink-0 transition-colors fill-none text-foreground stroke-foreground"
              />
              <span className="flex-1 truncate text-sm font-medium text-foreground">Favorites</span>
            </Link>
          </div>
        </div>

        {/* 4. Duplicate Items */}
        <div className="relative group/duplicates flex items-center w-full">
          {isDuplicatesActive && (
            <motion.div
              layoutId={`duplicates-active-${id}`}
              className="absolute inset-0 rounded-md bg-accent"
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}

          <div
            className={cn(
              'relative z-10 flex h-9 w-full items-center gap-2 rounded-md px-2.5 transition-colors cursor-pointer select-none text-foreground hover:bg-accent/60',
              isDuplicatesActive
                ? 'font-semibold'
                : 'font-medium'
            )}
          >
            <Link
              href={`${basePath}/duplicates`}
              className="flex flex-1 min-w-0 items-center gap-2.5 py-1 outline-none"
            >
              <Files
                className="size-4 shrink-0 transition-colors text-foreground"
              />
              <span className="flex-1 truncate text-sm font-medium text-foreground">Duplicate Items</span>
            </Link>
          </div>
        </div>

        {/* 5. Unfiled Items */}
        <div className="relative group/unfiled flex items-center w-full">
          {isUnfiledActive && (
            <motion.div
              layoutId={`unfiled-active-${id}`}
              className="absolute inset-0 rounded-md bg-accent"
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}

          <div
            className={cn(
              'relative z-10 flex h-9 w-full items-center gap-2 rounded-md px-2.5 transition-colors cursor-pointer select-none text-foreground hover:bg-accent/60',
              isUnfiledActive
                ? 'font-semibold'
                : 'font-medium'
            )}
          >
            <Link
              href={`${basePath}/unfiled`}
              className="flex flex-1 min-w-0 items-center gap-2.5 py-1 outline-none"
            >
              <Inbox
                className="size-4 shrink-0 transition-colors text-foreground"
              />
              <span className="flex-1 truncate text-sm font-medium text-foreground">Unfiled Items</span>
            </Link>
          </div>
        </div>

        {/* 6. Trash (without dividing line) */}
        <div className="relative group/trash flex items-center w-full">
          {isTrashActive && (
            <motion.div
              layoutId={`trash-active-${id}`}
              className="absolute inset-0 rounded-md bg-accent"
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}

          <div
            className={cn(
              'relative z-10 flex h-9 w-full items-center gap-2 rounded-md px-2.5 transition-colors cursor-pointer select-none text-foreground hover:bg-accent/60',
              isTrashActive
                ? 'font-semibold'
                : 'font-medium'
            )}
          >
            <Link
              href={`${basePath}/trash`}
              className="flex flex-1 min-w-0 items-center gap-2.5 py-1 outline-none"
            >
              <Trash2
                className="size-4 shrink-0 transition-colors text-foreground"
              />
              <span className="flex-1 truncate text-sm font-medium text-foreground">Trash</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tag Selector at Bottom */}
      <TagSelector
        tags={allTags}
        selectedTag={currentTag}
        onSelectTag={handleSelectTag}
        tagCounts={tagCounts}
      />

      {/* Drag Handle for Resizing (Single Border) */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 -right-1 w-2 h-full cursor-col-resize hover:bg-primary/20 transition-colors z-30 select-none",
          isDragging && "bg-primary/30"
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
