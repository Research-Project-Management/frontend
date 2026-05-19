import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router";
import { cn } from "~/lib/utils";
import { useWorkspace } from "~/query/workspace";
import {
  useCollections,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
} from "~/query/library";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import CollectionCreateDialog from "../components/CollectionCreateDialog";
import type { Collection } from "~/types/library";

// ── Tree builder ──────────────────────────────────────────────────────────────

type TreeNode = Collection & { children: TreeNode[] };

function buildTree(collections: Collection[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // First pass — wrap every collection as a node
  for (const c of collections) {
    map.set(c._id, { ...c, children: [] });
  }

  // Second pass — wire parent → children
  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) {
      map.get(node.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Collection tree node ──────────────────────────────────────────────────────

interface NodeProps {
  node: TreeNode;
  depth: number;
  basePath: string;
  activeId: string | string[] | null;
  navId: string;
  renamingId: string | null;
  renameValue: string;
  onStartRename: (id: string, name: string) => void;
  onSubmitRename: (id: string) => void;
  onRenameValueChange: (v: string) => void;
  onDelete: (id: string) => void;
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
  onStartRename,
  onSubmitRename,
  onRenameValueChange,
  onDelete,
  onCreateSub,
}: NodeProps) {
  const to = `${basePath}/${node._id}`;
  const isActive = activeId === node._id;
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(true);

  const indent = depth * 12;

  return (
    <div>
      <div className="group/col relative">
        {isActive && (
          <motion.div
            layoutId={`col-active-${navId}`}
            className="absolute inset-0 rounded-md bg-accent"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}

        {renamingId === node._id ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onBlur={() => onSubmitRename(node._id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitRename(node._id);
              if (e.key === "Escape") onSubmitRename("__cancel__");
            }}
            style={{ paddingLeft: `${indent + 8}px` }}
            className="relative z-10 w-full rounded-md border border-primary/40 bg-background pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <Link
            to={to}
            className="relative z-10 flex h-10 items-center gap-2.5 rounded-md px-2.5 pr-2 transition-colors hover:bg-accent/50"
            style={{ paddingLeft: `${indent + 8}px` }}
          >
            {/* Caret for expand/collapse */}
            <button
              onClick={(e) => {
                e.preventDefault();
                if (hasChildren) setOpen((v) => !v);
              }}
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded transition-colors",
                hasChildren
                  ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                  : "text-transparent cursor-default",
              )}
            >
              <motion.div
                animate={{ rotate: hasChildren && open ? 90 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronRight className="size-3" />
              </motion.div>
            </button>

            {/* Folder icon */}
            {hasChildren && open ? (
              <FolderOpen className="size-4 shrink-0" style={{ color: node.color || "#3370ff" }} />
            ) : (
              <Folder className="size-4 shrink-0" style={{ color: node.color || "#3370ff" }} />
            )}

            {/* Name */}
            <span
              className={cn(
                "flex-1 min-w-0 truncate text-sm font-medium",
                isActive
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground group-hover/col:text-foreground",
              )}
            >
              {node.name}
            </span>

            {/* Paper count */}
            {node.paperCount != null && node.paperCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums opacity-60 shrink-0">
                {node.paperCount}
              </span>
            )}

            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 group-hover/col:opacity-100 hover:bg-accent transition-all"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    onCreateSub(node._id, node.name);
                  }}
                >
                  <Plus className="mr-2 size-3.5" />
                  New subcollection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    onStartRename(node._id, node.name);
                  }}
                >
                  <Pencil className="mr-2 size-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(node._id);
                  }}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Link>
        )}
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {hasChildren && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
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
                onStartRename={onStartRename}
                onSubmitRename={onSubmitRename}
                onRenameValueChange={onRenameValueChange}
                onDelete={onDelete}
                onCreateSub={onCreateSub}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export default function LibrarySideBar() {
  const { workspaceId: workspaceUrl, collectionId: activeId } = useParams();
  const location = useLocation();
  const id = useId();

  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? "";

  const { data: collections } = useCollections(workspaceId);
  const createMutation = useCreateCollection(workspaceId);
  const updateMutation = useUpdateCollection(workspaceId);
  const deleteMutation = useDeleteCollection(workspaceId);

  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createParentName, setCreateParentName] = useState<string | undefined>(undefined);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const basePath = `/${workspaceUrl}/library`;
  const isAllActive = location.pathname === basePath;

  const tree = buildTree(collections ?? []);
  const totalPapers = (collections ?? []).reduce((acc, c) => acc + (c.paperCount ?? 0), 0);

  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem("flux_library_sidebar_width");
    return saved ? parseInt(saved, 10) : 240;
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      const clamped = Math.max(180, Math.min(newWidth, 600));
      setWidth(clamped);
    };

    const onMouseUp = () => {
      localStorage.setItem("flux_library_sidebar_width", width.toString());
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
  };

  const handleCreate = (data: { name: string; description: string; color: string }) => {
    createMutation.mutate(
      { ...data, parent: createParentId },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setCreateParentId(null);
        },
      },
    );
  };

  const openCreateSub = (parentId: string, parentName: string) => {
    setCreateParentId(parentId);
    setCreateParentName(parentName);
    setCreateOpen(true);
  };

  const openCreateRoot = () => {
    setCreateParentId(null);
    setCreateParentName(undefined);
    setCreateOpen(true);
  };

  const startRename = (colId: string, name: string) => {
    setRenamingId(colId);
    setRenameValue(name);
  };

  const submitRename = (collectionId: string) => {
    if (collectionId !== "__cancel__") {
      const trimmed = renameValue.trim();
      if (trimmed) updateMutation.mutate({ collectionId, name: trimmed });
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDelete = (collectionId: string) => {
    if (!confirm("Delete this collection and all its papers and subcollections?")) return;
    deleteMutation.mutate(collectionId);
  };

  const sharedNodeProps = {
    basePath,
    activeId: activeId ?? null,
    navId: id,
    renamingId,
    renameValue,
    onStartRename: startRename,
    onSubmitRename: submitRename,
    onRenameValueChange: setRenameValue,
    onDelete: handleDelete,
    onCreateSub: openCreateSub,
  };

  return (
    <aside
      className="relative h-full border-r border-border bg-card flex flex-col select-none shrink-0"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border shrink-0">
        <span className="font-semibold text-lg text-foreground">Library</span>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto p-2 flex flex-col gap-0.5">
        {/* All Papers */}
        <Link
          to={basePath}
          className="group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 pr-2 transition-colors hover:bg-accent/50"
          style={{ paddingLeft: "8px" }}
        >
          {isAllActive && (
            <motion.div
              layoutId={`all-active-${id}`}
              className="absolute inset-0 rounded-md bg-accent"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <div className="relative z-10 size-4 shrink-0" />
          <BookOpen
            className={cn(
              "relative z-10 size-4 shrink-0",
              isAllActive ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span
            className={cn(
              "relative z-10 flex-1 min-w-0 truncate text-sm font-medium",
              isAllActive
                ? "font-semibold text-foreground"
                : "text-muted-foreground group-hover/item:text-foreground",
            )}
          >
            All Papers
          </span>
          {totalPapers > 0 && (
            <span className="relative z-10 text-xs text-muted-foreground tabular-nums opacity-60 shrink-0">
              {totalPapers}
            </span>
          )}
        </Link>

        {/* Divider */}
        <div className="my-1.5 border-t border-border/60" />

        {/* Collections header */}
        <div className="flex items-center justify-between px-2 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Collections
          </span>
          <button
            onClick={openCreateRoot}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="New collection"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {/* Tree */}
        <div className="flex flex-col gap-0.5">
          {!collections || collections.length === 0 ? (
            <div className="px-2.5 py-2 text-[11px] text-muted-foreground italic">
              No collections yet
            </div>
          ) : (
            tree.map((node) => (
              <CollectionNode key={node._id} node={node} depth={0} {...sharedNodeProps} />
            ))
          )}
        </div>
      </div>

      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/40 transition-colors z-20"
        onMouseDown={handleMouseDown}
      />

      <CollectionCreateDialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) { setCreateParentId(null); setCreateParentName(undefined); }
        }}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
        parentName={createParentName}
      />
    </aside>
  );
}
