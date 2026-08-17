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
  PanelLeftClose,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';
import { useWorkspace } from '@/features/workspaces/shell';
import { useCollections } from '@/features/workspaces/library/hooks/data/use-collections';
import { usePapers } from '@/features/workspaces/library/hooks/data/use-papers';
import { useLibrarySidebarStore } from '@/features/workspaces/library/store/sidebar.store';
import { getLibraryEntityId } from '@/features/workspaces/library/utils/library.util';
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
  collectionPaperCounts: Record<string, number>;
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
  collectionPaperCounts,
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

  // Indentation: 12px per depth level
  const paddingLeft = depth * 12 + 8;
  const validMoveTargets = getValidMoveTargets(allCollections, node._id);
  const effectiveIsOpen = isSearching ? true : isOpen;
  const count = collectionPaperCounts[node._id] ?? node.paperCount ?? 0;

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
            className="relative z-10 flex h-8.5 w-full items-center pr-2"
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

              {count > 0 && (
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground mr-0.5">
                  {count}
                </span>
              )}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-foreground opacity-0 group-hover/node:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 hover:bg-muted hover:text-foreground transition-all cursor-pointer outline-none"
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
                  onClick={() => onCreateSub(node._id, node.name)}
                  className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                >
                  <FolderPlus className="size-3.5 text-foreground" />
                  <span>New Subcollection...</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onStartRename(node._id, node.name)}
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
                      onClick={() => onMove(node._id, null)}
                      className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                    >
                      <Library className="size-3.5 text-foreground" />
                      <span>My Library (Root)</span>
                    </DropdownMenuItem>
                    {validMoveTargets.map((target) => (
                      <DropdownMenuItem
                        key={target._id}
                        onClick={() => onMove(node._id, target._id)}
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
                      onClick={() => onCopy(node._id, null)}
                      className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer"
                    >
                      <Library className="size-3.5 text-foreground" />
                      <span>My Library</span>
                    </DropdownMenuItem>
                    {validMoveTargets.map((target) => (
                      <DropdownMenuItem
                        key={target._id}
                        onClick={() => onCopy(node._id, target._id)}
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
                  onClick={() => onDelete(node._id)}
                >
                  <FolderMinus className="size-3.5 text-foreground" />
                  <span>Delete Collection...</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="gap-2 px-2 py-1.5 text-xs whitespace-nowrap cursor-pointer text-foreground"
                  onClick={() => onDeleteWithItems(node._id)}
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
              key={child._id}
              node={child}
              depth={depth + 1}
              basePath={basePath}
              activeId={activeId}
              navId={navId}
              renamingId={renamingId}
              renameValue={renameValue}
              allCollections={allCollections}
              collectionPaperCounts={collectionPaperCounts}
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
  const workspaceId = getLibraryEntityId(workspace) || workspaceUrl || '';

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

  // Computed counts
  const {
    allTags,
    tagCounts,
    totalPapersCount,
    starredCount,
    recentReadCount,
    unfiledCount,
    duplicatesCount,
    trashCount,
    collectionPaperCounts,
  } = useMemo(() => {
    const counts: Record<string, number> = {};
    const colCounts: Record<string, number> = {};
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
      if (!p.collectionId) {
        unfiled++;
      } else {
        colCounts[p.collectionId] = (colCounts[p.collectionId] || 0) + 1;
      }

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
      collectionPaperCounts: colCounts,
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
    collectionPaperCounts,
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
      {/* Header: Exactly matching Storage Sidebar */}
      <div className="mb-4 px-2 flex items-center justify-between font-semibold text-base tracking-tight text-foreground select-none">
        <span>Library</span>

        <div className="flex items-center gap-1 shrink-0">
          {/* Search collections input */}
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
                isLibraryActive ? 'font-semibold' : 'font-medium'
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

              {totalPapersCount > 0 && (
                <span className="relative z-10 text-xs font-mono tabular-nums text-muted-foreground">
                  {totalPapersCount}
                </span>
              )}
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
                  key={node._id}
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
            {recentReadCount > 0 && (
              <span className="relative z-10 text-xs font-mono tabular-nums text-muted-foreground">
                {recentReadCount}
              </span>
            )}
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
            {starredCount > 0 && (
              <span className="relative z-10 text-xs font-mono tabular-nums text-muted-foreground">
                {starredCount}
              </span>
            )}
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
            {duplicatesCount > 0 && (
              <span className="relative z-10 text-xs font-mono tabular-nums text-muted-foreground">
                {duplicatesCount}
              </span>
            )}
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
            {unfiledCount > 0 && (
              <span className="relative z-10 text-xs font-mono tabular-nums text-muted-foreground">
                {unfiledCount}
              </span>
            )}
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
            {trashCount > 0 && (
              <span className="relative z-10 text-xs font-mono tabular-nums text-muted-foreground">
                {trashCount}
              </span>
            )}
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
