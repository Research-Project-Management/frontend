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
  FolderTree,
  ChevronRight,
  Copy,
  Search,
  Plus,
  History,
  Inbox,
  Files,
  PanelLeft,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useCollections } from '@/features/workspaces/library/hooks/use-library';
import { useCatalogItems } from '@/features/workspaces/library/hooks/use-items';
import { useLibrarySidebarStore } from '@/features/workspaces/library/store/sidebar.store';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import CreateCollectionModal from './modals/CreateCollectionModal';
import TrashModal, { type MoveToTrashTarget } from './modals/TrashModal';
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

  const validMoveTargets = getValidMoveTargets(allCollections, node.id);
  const effectiveIsOpen = isSearching ? true : isOpen;

  // SaaS indentation: 24px for root collection, +14px per subcollection depth level
  const paddingLeft = depth * 14 + 24;

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="group/node relative flex items-center w-full">
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
            className="relative z-10 flex h-9.5 w-full items-center pr-2 min-w-0"
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
              className="h-8 w-full min-w-0 rounded-md border border-border/60 bg-background px-2 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-ring shadow-none"
            />
          </div>
        ) : (
          <div
            className="group/node relative z-10 flex h-8 w-full items-center gap-2 rounded-md pr-2 transition-colors cursor-pointer select-none text-dense font-medium text-foreground tracking-tight hover:bg-accent/60"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen((v) => !v);
                }}
                aria-label={effectiveIsOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                className="flex size-4 shrink-0 items-center justify-center rounded-sm text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <ChevronRight
                  className={cn('size-3.5 text-foreground transition-transform duration-150', effectiveIsOpen && 'rotate-90')}
                />
              </button>
            ) : depth > 0 ? (
              <span className="size-4 shrink-0" />
            ) : null}

            <Link
              href={to}
              className="flex flex-1 min-w-0 items-center gap-2 py-1 outline-none text-foreground"
            >
              {hasChildren && effectiveIsOpen ? (
                <FolderOpen className="size-4 shrink-0 text-foreground" />
              ) : (
                <Folder className="size-4 shrink-0 text-foreground" />
              )}

              <span className="flex-1 min-w-0 truncate text-dense font-medium text-foreground tracking-tight">
                {node.name}
              </span>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex size-7 shrink-0 items-center justify-center rounded-sm text-foreground opacity-0 group-hover/node:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 hover:bg-accent transition-opacity hover:transition-colors cursor-pointer outline-none"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Options for ${node.name}`}
                >
                  <MoreVertical className="size-4 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="end"
                sideOffset={4}
                collisionPadding={12}
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="w-52 p-1.5 rounded-md border border-border/60 bg-popover text-popover-foreground z-50 text-xs shadow-none space-y-0.5"
              >
                <DropdownMenuItem
                  onClick={() => onCreateSub(node.id, node.name)}
                  className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent"
                >
                  <FolderPlus className="size-4 text-foreground shrink-0" />
                  <span>New Subcollection</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onStartRename(node.id, node.name)}
                  className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent"
                >
                  <Pencil className="size-4 text-foreground shrink-0" />
                  <span>Rename</span>
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent">
                    <FolderInput className="size-4 text-foreground shrink-0" />
                    <span>Move to</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52 p-1.5 rounded-md border border-border/60 bg-popover text-popover-foreground text-xs shadow-none space-y-0.5">
                    <DropdownMenuItem
                      onClick={() => onMove(node.id, null)}
                      className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent"
                    >
                      <FolderTree className="size-4 text-foreground shrink-0" />
                      <span>My Library</span>
                    </DropdownMenuItem>
                    {validMoveTargets.map((target) => (
                      <DropdownMenuItem
                        key={target.id}
                        onClick={() => onMove(node.id, target.id)}
                        className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent"
                      >
                        <Folder className="size-4 text-foreground shrink-0" />
                        <span className="truncate">{target.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent">
                    <Copy className="size-4 text-foreground shrink-0" />
                    <span>Copy to</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52 p-1.5 rounded-md shadow-none border border-border/60 bg-popover text-popover-foreground text-xs space-y-0.5">
                    <DropdownMenuItem
                      onClick={() => onCopy(node.id, null)}
                      className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent"
                    >
                      <FolderTree className="size-4 text-foreground shrink-0" />
                      <span>My Library</span>
                    </DropdownMenuItem>
                    {validMoveTargets.map((target) => (
                      <DropdownMenuItem
                        key={target.id}
                        onClick={() => onCopy(node.id, target.id)}
                        className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent"
                      >
                        <Folder className="size-4 text-foreground shrink-0" />
                        <span className="truncate">{target.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem
                  className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent"
                  onClick={() => onDelete(node.id)}
                >
                  <FolderMinus className="size-4 text-foreground shrink-0" />
                  <span>Delete</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="gap-2.5 px-2.5 py-1.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent"
                  onClick={() => onDeleteWithItems(node.id)}
                >
                  <Trash2 className="size-4 text-foreground shrink-0" />
                  <span>Delete with items</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {hasChildren && effectiveIsOpen && (
        <div className="flex flex-col gap-1 w-full">
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
  const CatalogItemService = useCatalogItems({ workspaceId });

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

  const isLibraryActive = pathname === basePath && !currentFilter && !activeId;
  const isRecentReadActive = pathname === `${basePath}/recently-read` || (pathname === basePath && currentFilter === 'recent-read');
  const isUnfiledActive = pathname === `${basePath}/unfiled` || (pathname === basePath && currentFilter === 'unfiled');
  const isDuplicatesActive = pathname === `${basePath}/duplicates` || (pathname === basePath && currentFilter === 'duplicates');
  const isTrashActive = pathname === `${basePath}/trash` || (pathname === basePath && currentFilter === 'trash');

  const collections = useMemo(
    () => collectionService.state.collections ?? [],
    [collectionService.state.collections],
  );
  const papers = useMemo(
    () => CatalogItemService.state.allPapers ?? [],
    [CatalogItemService.state.allPapers],
  );

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
    const rawParent = data.parentId ?? data.parent ?? createParentId ?? null;
    const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
    collectionService.actions.create(
      {
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
        parent: cleanParentId,
      },
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

  const [trashTarget, setTrashTarget] = useState<MoveToTrashTarget | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  const startRename = (collectionId: string, name: string) => {
    setRenamingId(collectionId);
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
    const target = collections.find((c) => c.id === collectionId);
    setTrashTarget({
      type: 'collection',
      id: collectionId,
      title: target?.name || 'Untitled Collection',
    });
    setIsTrashOpen(true);
  };

  const handleDeleteWithItems = (collectionId: string) => {
    const target = collections.find((c) => c.id === collectionId);
    setTrashTarget({
      type: 'collection',
      id: collectionId,
      title: target?.name || 'Untitled Collection',
    });
    setIsTrashOpen(true);
  };

  const handleConfirmTrash = () => {
    if (!trashTarget?.id) return;
    collectionService.actions.delete(trashTarget.id);
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
        minWidth: '180px',
        maxWidth: '400px',
      }}
      className="relative h-full overflow-x-hidden border-r border-border/50 bg-transparent p-2 py-4 flex flex-col select-none shrink-0"
    >
      {/* Header: Matching Storage/Projects Sidebar with expandable search */}
      <div className="mb-4 px-2 flex items-center justify-between font-semibold text-lg text-foreground select-none">
        {isSearchExpanded || searchQuery ? (
          <div className="relative flex items-center transition-all duration-300 ease-in-out w-full h-8 rounded-md border border-border/60 bg-background/80 overflow-hidden group font-normal text-xs">
            <Search className="absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 left-2 translate-x-0 text-muted-foreground pointer-events-none" />
            <Input
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
              className="h-full text-xs font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/60 placeholder:font-normal transition-opacity duration-200 pl-7 pr-7 text-foreground"
            />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-muted transition-colors cursor-pointer p-0.5 rounded-sm"
              aria-label="Clear search"
            >
              <Plus className="size-3.5 rotate-45" />
            </button>
          </div>
        ) : (
          <>
            <span className="truncate min-w-0 font-semibold text-lg text-foreground">Library</span>

            <div className="flex items-center gap-0.5 shrink-0">
              {/* Search collections toggle button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={expandSearch}
                    className="rounded-md p-1.5 text-foreground hover:bg-accent cursor-pointer transition-colors outline-none"
                    aria-label="Search collections"
                  >
                    <Search className="size-4 text-foreground shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Search collections</TooltipContent>
              </Tooltip>

              {/* New collection button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={openCreateRoot}
                    className="rounded-md p-1.5 text-foreground hover:bg-accent cursor-pointer transition-colors outline-none"
                    aria-label="New collection"
                  >
                    <FolderPlus className="size-4 text-foreground shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New collection</TooltipContent>
              </Tooltip>

              {/* Toggle / Collapse Sidebar Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggle}
                    aria-label="Toggle sidebar"
                    className="rounded-md p-1.5 text-foreground hover:bg-accent cursor-pointer transition-colors outline-none"
                  >
                    <PanelLeft className="size-4 text-foreground shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </div>

      {/* Navigation Links: SaaS standard hierarchy with black text & icons */}
      <LayoutGroup id={`library-nav-${id}`}>
        <nav
          aria-label="Library Navigation"
          className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col gap-1 pr-1"
        >
          {/* 1. My Library */}
          <div className="relative group/root flex items-center w-full">
            <Link
              href={basePath}
              className="group/item relative flex h-8 w-full items-center gap-2 rounded-md px-2.5 type-dense font-medium text-foreground transition-colors hover:bg-accent/60 outline-none focus-visible:ring-1 focus-visible:ring-ring select-none pr-8"
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
              <span className="relative z-10 min-w-0 truncate flex-1 text-foreground">
                My Library
              </span>
            </Link>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsLibraryExpanded((v) => !v);
              }}
              aria-label={isLibraryExpanded ? 'Collapse My Library' : 'Expand My Library'}
              className="absolute right-2 z-20 flex size-5 shrink-0 items-center justify-center rounded-sm text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 text-foreground transition-transform duration-150',
                  isLibraryExpanded && 'rotate-90'
                )}
              />
            </button>
          </div>

          {/* Sub-items directly nested under My Library */}
          {isLibraryExpanded && (
            <div className="flex flex-col gap-1 w-full">
              {/* 1. Recently Read (First item in My Library) */}
              <Link
                href={`${basePath}/recently-read`}
                className="group/item relative flex h-8 items-center gap-2 rounded-md pr-2 type-dense font-medium text-foreground transition-colors hover:bg-accent/60 outline-none focus-visible:ring-1 focus-visible:ring-ring select-none pl-6"
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
                <span className="relative z-10 min-w-0 truncate flex-1 text-foreground">
                  Recently Read
                </span>
              </Link>

              {/* User Collections Tree */}
              {tree.map((node) => (
                <CollectionNode
                  key={node.id}
                  node={node}
                  depth={0}
                  {...sharedNodeProps}
                />
              ))}

              {/* Empty Search Result */}
              {searchQuery.trim().length > 0 && tree.length === 0 && (
                <div className="py-6 px-3 text-center text-xs text-muted-foreground select-none">
                  No collections matching &ldquo;{searchQuery}&rdquo;
                </div>
              )}

              {/* 2. Duplicate Items */}
              <Link
                href={`${basePath}/duplicates`}
                className="group/item relative flex h-8 items-center gap-2 rounded-md pr-2 type-dense font-medium text-foreground transition-colors hover:bg-accent/60 outline-none focus-visible:ring-1 focus-visible:ring-ring select-none pl-6"
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
                <span className="relative z-10 min-w-0 truncate flex-1 text-foreground">
                  Duplicate Items
                </span>
              </Link>

              {/* 3. Unfiled Items */}
              <Link
                href={`${basePath}/unfiled`}
                className="group/item relative flex h-8 items-center gap-2 rounded-md pr-2 type-dense font-medium text-foreground transition-colors hover:bg-accent/60 outline-none focus-visible:ring-1 focus-visible:ring-ring select-none pl-6"
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
                <span className="relative z-10 min-w-0 truncate flex-1 text-foreground">
                  Unfiled Items
                </span>
              </Link>

              {/* 4. Trash */}
              <Link
                href={`${basePath}/trash`}
                className="group/item relative flex h-8 items-center gap-2 rounded-md pr-2 type-dense font-medium text-foreground transition-colors hover:bg-accent/60 outline-none focus-visible:ring-1 focus-visible:ring-ring select-none pl-6"
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
                <span className="relative z-10 min-w-0 truncate flex-1 text-foreground">
                  Trash
                </span>
              </Link>
            </div>
          )}
        </nav>
      </LayoutGroup>

      {/* Drag Handle for Resizing */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={200}
        aria-valuemax={480}
        aria-label="Resize library sidebar (double-click to reset width)"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setWidth(240)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setWidth(Math.max(200, width - 10));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setWidth(Math.min(480, width + 10));
          }
        }}
        className={cn(
          "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 transition-colors z-30 select-none focus-visible:outline-none",
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

      <TrashModal
        open={isTrashOpen}
        onOpenChange={setIsTrashOpen}
        target={trashTarget}
        onConfirm={handleConfirmTrash}
        isPending={collectionService.state.isDeleting}
      />
    </aside>
  );
}

