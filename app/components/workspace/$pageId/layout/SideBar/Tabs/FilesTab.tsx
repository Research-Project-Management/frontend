import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useNavigate, useParams } from "react-router";
import { useEditorTabsStore } from "~/stores/editor-tabs";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Ellipsis,
  FileCode2,
  FilePlus,
  FileText,
  FolderPlus,
  FolderOpen,
  Folder,
  Image,
  Loader2,
  Paperclip,
  Pencil,
  Star,
  Trash2,
  Upload,
  X,
  FileType,
  BookText,
  Braces,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { usePageContext } from "../../PageContext";
import {
  usePageFiles,
  useCreatePageFile,
  useSetPageMainFile,
  useDeletePage,
  useUpdatePageTitle,
  usePage,
} from "~/query/page";
import {
  useProjectFilesEditor,
  useUploadFileForEditor,
  useDeleteFileForEditor,
  useRenameFileForEditor,
  useCreateFolderForEditor,
} from "~/query/storage";
import type { StorageItem } from "~/components/workspace/storage/types";

// ── File icon helper ─────────────────────────────────────────────────────────

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "tex":
    case "ltx":
    case "dtx":
      return { icon: FileCode2, color: "text-blue-500" };
    case "bib":
    case "bst":
      return { icon: BookText, color: "text-emerald-500" };
    case "cls":
    case "sty":
    case "ins":
      return { icon: Braces, color: "text-violet-500" };
    case "md":
    case "txt":
      return { icon: FileType, color: "text-muted-foreground" };
    default:
      return { icon: FileCode2, color: "text-muted-foreground" };
  }
}

function getStorageIcon(item: StorageItem) {
  const isImage = item.mimeType?.startsWith("image/");
  if (isImage) return { icon: Image, color: "text-amber-500" };
  return { icon: Paperclip, color: "text-muted-foreground" };
}

// ── Indent Guide ─────────────────────────────────────────────────────────────

function IndentGuides({ depth }: { depth: number }) {
  if (depth <= 0) return null;
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="shrink-0 w-4 flex justify-center self-stretch">
          <span className="w-px h-full bg-border/60" />
        </span>
      ))}
    </>
  );
}

// ── Inline Input Row (for new file / folder creation) ────────────────────────

function InlineInput({
  icon: Icon,
  iconColor,
  value,
  onChange,
  placeholder,
  onCommit,
  onCancel,
  isPending,
}: {
  icon: React.ElementType;
  iconColor?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onCommit: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  return (
    <div className="flex items-center h-[22px] pl-5 pr-2 bg-primary/5 border border-primary/30 mx-0.5 rounded-sm">
      <Icon
        className={cn(
          "size-3.5 shrink-0 mr-1.5",
          iconColor ?? "text-muted-foreground",
        )}
      />
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 text-[12px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40"
      />
      <button
        onClick={onCommit}
        disabled={isPending}
        className="p-0.5 text-primary hover:opacity-70 transition-opacity disabled:opacity-40 shrink-0"
      >
        {isPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Check className="size-3" />
        )}
      </button>
      <button
        onClick={onCancel}
        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

// ── Rename Input (inline) ────────────────────────────────────────────────────

function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  isPending,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  return (
    <>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
        className="flex-1 min-w-0 text-[12px] bg-primary/5 border border-primary/40 rounded-sm px-1 outline-none text-foreground"
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCommit();
        }}
        disabled={isPending}
        className="p-0.5 text-primary hover:opacity-70 transition-opacity disabled:opacity-40 shrink-0"
      >
        {isPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Check className="size-3" />
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <X className="size-3" />
      </button>
    </>
  );
}

// ── Row Actions Button ───────────────────────────────────────────────────────

function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-0.5 rounded-sm opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Ellipsis className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 text-[12px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Storage Folder Node (recursive, uses File model) ─────────────────────────

function StorageFolderNode({
  folder,
  projectId,
  depth,
  onInsertAsset,
  onPreview,
  onUploadToFolder,
}: {
  folder: StorageItem;
  projectId: string;
  depth: number;
  onInsertAsset: (name: string) => void;
  onPreview: (item: StorageItem) => void;
  onUploadToFolder?: (files: File[], folderId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: children, isLoading } = useProjectFilesEditor(
    projectId,
    expanded ? folder._id : undefined,
  );
  const deleteFileMutation = useDeleteFileForEditor();
  const renameFileMutation = useRenameFileForEditor();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOver, setDragOver] = useState(false);

  return (
    <>
      <div
        onClick={() => setExpanded(!expanded)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const dropped = Array.from(e.dataTransfer.files);
          if (dropped.length > 0 && onUploadToFolder)
            onUploadToFolder(dropped, folder._id);
        }}
        className={cn(
          "group/row flex items-center h-[22px] pr-2 cursor-pointer transition-colors",
          dragOver
            ? "bg-primary/10 outline outline-1 outline-primary/30"
            : "hover:bg-muted/50",
        )}
      >
        <IndentGuides depth={depth} />
        <ChevronRight
          className={cn(
            "size-3 shrink-0 text-foreground/60 transition-transform duration-150 mx-0.5",
            expanded && "rotate-90",
          )}
        />
        {expanded ? (
          <FolderOpen className="size-3.5 shrink-0 text-amber-500 mr-1.5" />
        ) : (
          <Folder className="size-3.5 shrink-0 text-amber-500 mr-1.5" />
        )}

        {renamingId === folder._id ? (
          <RenameInput
            value={renameValue}
            onChange={setRenameValue}
            onCommit={() => {
              const n = renameValue.trim();
              if (!n) { setRenamingId(null); return; }
              renameFileMutation.mutate(
                { fileId: folder._id, name: n },
                { onSuccess: () => setRenamingId(null) },
              );
            }}
            onCancel={() => setRenamingId(null)}
            isPending={renameFileMutation.isPending}
          />
        ) : (
          <>
            <span className="flex-1 min-w-0 truncate text-[12px] text-foreground/90">
              {folder.filename}
            </span>
            <RowActions>
              <DropdownMenuItem
                className="text-[12px]!"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingId(folder._id);
                  setRenameValue(folder.filename);
                }}
              >
                <Pencil className="size-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[12px]! text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFileMutation.mutate(folder._id);
                }}
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </RowActions>
          </>
        )}
      </div>

      {/* Children */}
      {expanded && (
        <>
          {isLoading && (
            <div
              className="flex items-center h-[22px]"
              style={{ paddingLeft: `${(depth + 1) * 16 + 20}px` }}
            >
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            </div>
          )}
          {children?.map((child) =>
            child.isFolder ? (
              <StorageFolderNode
                key={child._id}
                folder={child}
                projectId={projectId}
                depth={depth + 1}
                onInsertAsset={onInsertAsset}
                onPreview={onPreview}
                onUploadToFolder={onUploadToFolder}
              />
            ) : (
              <StorageFileRow
                key={child._id}
                item={child}
                depth={depth + 1}
                onInsertAsset={onInsertAsset}
                onPreview={onPreview}
              />
            ),
          )}
          {!isLoading && !children?.length && (
            <div
              className="flex items-center h-[22px] text-[11px] text-muted-foreground/50 italic"
              style={{ paddingLeft: `${(depth + 1) * 16 + 20}px` }}
            >
              Empty folder
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Storage File Row (File model, non-folder) ────────────────────────────────

function StorageFileRow({
  item,
  depth,
  onInsertAsset,
  onPreview,
}: {
  item: StorageItem;
  depth: number;
  onInsertAsset: (name: string) => void;
  onPreview: (item: StorageItem) => void;
}) {
  const isImage = item.mimeType?.startsWith("image/");
  const { icon: Icon, color } = getStorageIcon(item);
  const deleteFileMutation = useDeleteFileForEditor();
  const renameFileMutation = useRenameFileForEditor();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-asset-id", item._id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() =>
        isImage ? onPreview(item) : onInsertAsset(item.filename)
      }
      title={
        isImage
          ? `Click to preview ${item.filename}`
          : `Click to insert \\includegraphics{${item.filename}}`
      }
      className="group/row flex items-center h-[22px] pr-2 cursor-pointer transition-colors hover:bg-muted/50"
    >
      <IndentGuides depth={depth} />
      <span className="w-4 shrink-0" />
      <Icon className={cn("size-3.5 shrink-0 mr-1.5", color)} />

      {renamingId === item._id ? (
        <RenameInput
          value={renameValue}
          onChange={setRenameValue}
          onCommit={() => {
            const n = renameValue.trim();
            if (!n) { setRenamingId(null); return; }
            renameFileMutation.mutate(
              { fileId: item._id, name: n },
              { onSuccess: () => setRenamingId(null) },
            );
          }}
          onCancel={() => setRenamingId(null)}
          isPending={renameFileMutation.isPending}
        />
      ) : (
        <>
          <span className="flex-1 min-w-0 truncate text-[12px] text-foreground/90">
            {item.filename}
          </span>
          <RowActions>
            <DropdownMenuItem
              className="text-[12px]!"
              onClick={(e) => {
                e.stopPropagation();
                onInsertAsset(item.filename);
              }}
            >
              <FileCode2 className="size-3.5 mr-2" />
              Insert Command
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[12px]!"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(item._id);
                setRenameValue(item.filename);
              }}
            >
              <Pencil className="size-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[12px]! text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                deleteFileMutation.mutate(item._id);
              }}
            >
              <Trash2 className="size-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </RowActions>
        </>
      )}
    </div>
  );
}

// ── Extensions ──────────────────────────────────────────────────────────────

const TEX_EXTS = new Set([
  ".tex",
  ".bib",
  ".cls",
  ".sty",
  ".bst",
  ".txt",
  ".md",
  ".ltx",
  ".dtx",
  ".ins",
]);

// ── Main FilesTab ───────────────────────────────────────────────────────────

export default function FilesTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const { currentPage, editorRef, setTexFiles } = usePageContext();
  const navigate = useNavigate();
  const { openTab } = useEditorTabsStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const combinedUploadRef = useRef<HTMLInputElement>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  type PendingItem = {
    file: File;
    name: string;
    conflict: "none" | "duplicate";
  };
  const [pendingUploads, setPendingUploads] = useState<PendingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const parentPageId: string | null = currentPage
    ? currentPage.parentPage
      ? String(currentPage.parentPage)
      : currentPage._id
    : null;

  const { data: parentPage } = usePage(parentPageId ?? "");

  const mainFileId =
    parentPage?.mainFile && typeof parentPage.mainFile === "object"
      ? parentPage.mainFile._id
      : ((parentPage?.mainFile as string | null | undefined) ?? null);

  const projectId =
    currentPage?.project && typeof currentPage.project === "object"
      ? currentPage.project._id
      : ((currentPage?.project as string | null | undefined) ?? "");

  // Derive workspaceId from parentPage.project.workspace for uploads
  const workspaceId: string =
    (parentPage?.project as any)?.workspace?._id ?? "";

  const { data: files, isLoading } = usePageFiles(parentPageId);

  useEffect(() => {
    if (!files) return;
    const names = files.map((f) => f.title);
    setTexFiles(names);
  }, [files, setTexFiles]);

  const createFileMutation = useCreatePageFile();
  const setMainFileMutation = useSetPageMainFile();
  const deletePageMutation = useDeletePage();
  const updateTitleMutation = useUpdatePageTitle();

  // Project files (non-tex: images, pdfs, etc.) from the unified File model
  const { data: projectFiles, isLoading: projectFilesLoading } =
    useProjectFilesEditor(projectId || null);
  const uploadFileMutation = useUploadFileForEditor();
  const createFolderMutation = useCreateFolderForEditor();

  const [previewItem, setPreviewItem] = useState<StorageItem | null>(null);

  const handleOpenPreview = useCallback((item: StorageItem) => {
    setPreviewItem(item);
  }, []);

  const handleFileClick = (fileId: string, title: string) => {
    if (fileId === pageId) return;
    if (projectId) openTab(projectId, { id: fileId, title });
    navigate(`/editor/${fileId}`);
  };

  const handleStartCreate = () => {
    setIsCreatingFile(true);
    setNewFileName("");
    setTimeout(() => newFileInputRef.current?.focus(), 0);
  };

  const handleStartCreateFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName("");
    setTimeout(() => newFolderInputRef.current?.focus(), 0);
  };

  const handleCancelCreate = () => {
    setIsCreatingFile(false);
    setNewFileName("");
  };

  const handleCancelCreateFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const handleUpload = () => combinedUploadRef.current?.click();
  const handleFolderUpload = () => folderUploadRef.current?.click();

  // Build a set of existing file names for duplicate detection
  const existingNames = useMemo(() => {
    const names = new Set<string>();
    files?.forEach((f) => names.add(f.title.toLowerCase()));
    projectFiles?.forEach((f) => {
      if (!f.isFolder) names.add(f.filename.toLowerCase());
    });
    return names;
  }, [files, projectFiles]);

  const markConflicts = useCallback(
    (items: { file: File; name: string }[]): PendingItem[] => {
      const seen = new Set<string>();
      return items.map((item) => {
        const lower = item.name.toLowerCase();
        const isDup = existingNames.has(lower) || seen.has(lower);
        seen.add(lower);
        return { ...item, conflict: isDup ? "duplicate" : "none" };
      });
    },
    [existingNames],
  );

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    const items = picked.map((f) => ({ file: f, name: f.name }));
    setPendingUploads(markConflicts(items));
    setUploadDialogOpen(true);
  };

  const handleFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    const items = picked.map((f) => ({
      file: f,
      name: (f as any).webkitRelativePath || f.name,
    }));
    setPendingUploads(markConflicts(items));
    setUploadDialogOpen(true);
  };

  const sanitizeTitle = (raw: string) => {
    const trimmed = raw.trim();
    if (/\.[a-z]+$/i.test(trimmed)) return trimmed;
    return trimmed.replace(/\.$/, "");
  };

  const displayName = (title: string) =>
    /\.[a-z]+$/i.test(title) ? title : `${title}.tex`;

  const handleCreateFile = () => {
    const title = sanitizeTitle(newFileName);
    if (!parentPageId || !title) return;
    createFileMutation.mutate(
      { parentPageId, title },
      {
        onSuccess: (file) => {
          setIsCreatingFile(false);
          setNewFileName("");
          navigate(`/editor/${file._id}`);
        },
      },
    );
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!projectId || !name) return;
    createFolderMutation.mutate(
      { name, projectId, workspaceId },
      {
        onSuccess: () => {
          setIsCreatingFolder(false);
          setNewFolderName("");
        },
      },
    );
  };

  const handleStartRename = (file: { _id: string; title: string }) => {
    setRenamingId(file._id);
    setRenameValue(file.title);
  };

  const handleCommitRename = (fileId: string) => {
    const title = sanitizeTitle(renameValue);
    if (!title) {
      setRenamingId(null);
      return;
    }
    updateTitleMutation.mutate(
      { pageId: fileId, title },
      { onSuccess: () => setRenamingId(null) },
    );
  };

  const handleDelete = (fileId: string) => {
    if (!projectId) return;
    deletePageMutation.mutate(
      { pageId: fileId, projectId },
      {
        onSuccess: () => {
          if (fileId === pageId) navigate(-1);
        },
      },
    );
  };

  const handleSetMain = (fileId: string) => {
    if (!parentPageId) return;
    setMainFileMutation.mutate({ pageId: parentPageId, fileId });
  };

  const autoRename = useCallback(
    (name: string): string => {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 1;
      let candidate = `${base} (${n})${ext}`;
      while (existingNames.has(candidate.toLowerCase())) {
        n++;
        candidate = `${base} (${n})${ext}`;
      }
      return candidate;
    },
    [existingNames],
  );

  const handleAutoRenameAll = () => {
    setPendingUploads((prev) =>
      prev.map((item) =>
        item.conflict === "duplicate"
          ? { ...item, name: autoRename(item.name), conflict: "none" }
          : item,
      ),
    );
  };

  const handleConfirmUpload = async () => {
    if (!parentPageId || !pendingUploads.length) return;
    setUploadDialogOpen(false);

    const folderItems = pendingUploads.filter((p) => p.name.includes("/"));
    const flatItems = pendingUploads.filter((p) => !p.name.includes("/"));

    // --- Flat tex files ---
    const texFlat = flatItems.filter(({ name }) =>
      TEX_EXTS.has("." + (name.split(".").pop() ?? "").toLowerCase()),
    );
    // --- Flat non-tex files (go to File model) ---
    const assetFlat = flatItems.filter(
      ({ name }) =>
        !TEX_EXTS.has("." + (name.split(".").pop() ?? "").toLowerCase()),
    );

    if (texFlat.length) {
      setUploadingCount(texFlat.length);
      let lastId: string | null = null;
      let done = 0;
      texFlat.forEach(({ file, name }) => {
        const reader = new FileReader();
        reader.onload = () => {
          createFileMutation.mutate(
            {
              parentPageId,
              title: name.trim() || file.name,
              content: reader.result as string,
            },
            {
              onSuccess: (f) => {
                lastId = f._id;
              },
              onSettled: () => {
                done++;
                if (done === texFlat.length) {
                  setUploadingCount(0);
                  if (lastId) navigate(`/editor/${lastId}`);
                }
              },
            },
          );
        };
        reader.readAsText(file);
      });
    }

    if (assetFlat.length && projectId) {
      setUploadingAssets(true);
      let done = 0;
      const total = assetFlat.length;
      assetFlat.forEach(({ file, name }) => {
        const renamedFile =
          name !== file.name
            ? new File([file], name, { type: file.type })
            : file;
        uploadFileMutation.mutate(
          { file: renamedFile, projectId, workspaceId, parentPageId },
          {
            onSuccess: () => {
              done++;
              if (done >= total) setUploadingAssets(false);
            },
            onError: () => {
              done++;
              if (done >= total) setUploadingAssets(false);
            },
          },
        );
      });
    }

    // --- Folder items (have path like "folder/sub/file.png") ---
    if (folderItems.length && projectId) {
      setUploadingAssets(true);
      try {
        const folderPaths = new Set<string>();
        for (const { name } of folderItems) {
          const parts = name.split("/");
          for (let i = 1; i < parts.length; i++) {
            folderPaths.add(parts.slice(0, i).join("/"));
          }
        }
        const sortedPaths = Array.from(folderPaths).sort();
        const folderIdMap: Record<string, string> = {};

        for (const folderPath of sortedPaths) {
          const parts = folderPath.split("/");
          const folderName = parts[parts.length - 1];
          const parentPath = parts.slice(0, -1).join("/");
          const parentId = parentPath ? folderIdMap[parentPath] : undefined;

          const created = await new Promise<{ _id: string }>(
            (resolve, reject) => {
              createFolderMutation.mutate(
                { name: folderName, projectId, workspaceId, parentId },
                {
                  onSuccess: (data: any) => resolve(data),
                  onError: (err: any) => reject(err),
                },
              );
            },
          );
          folderIdMap[folderPath] = created._id;
        }

        let done = 0;
        const total = folderItems.length;
        for (const { file, name } of folderItems) {
          const parts = name.split("/");
          const fileName = parts[parts.length - 1];
          const folderPath = parts.slice(0, -1).join("/");
          const parentId = folderIdMap[folderPath];

          const renamedFile =
            fileName !== file.name
              ? new File([file], fileName, { type: file.type })
              : file;

          uploadFileMutation.mutate(
            { file: renamedFile, projectId, workspaceId, parentPageId, parentId },
            {
              onSuccess: () => {
                done++;
                if (done >= total) setUploadingAssets(false);
              },
              onError: () => {
                done++;
                if (done >= total) setUploadingAssets(false);
              },
            },
          );
        }
      } catch {
        setUploadingAssets(false);
      }
    }

    setPendingUploads([]);
  };

  const handleInsertAsset = (name: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const pos = editor.getPosition();
    if (!pos) return;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const snippet =
      ext === "svg"
        ? `\\includesvg[width=\\linewidth]{${name}}`
        : `\\includegraphics[width=\\linewidth]{${name}}`;

    const edits: {
      range: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      };
      text: string;
    }[] = [];

    if (ext !== "svg") {
      const model = editor.getModel();
      if (model) {
        const src = model.getValue();
        if (!/\\usepackage(?:\[.*?\])?\{graphicx\}/.test(src)) {
          const lines = src.split("\n");
          const beginDocIdx = lines.findIndex((l) =>
            /\\begin\{document\}/.test(l),
          );
          if (beginDocIdx >= 0) {
            edits.push({
              range: {
                startLineNumber: beginDocIdx + 1,
                startColumn: 1,
                endLineNumber: beginDocIdx + 1,
                endColumn: 1,
              },
              text: "\\usepackage{graphicx}\n",
            });
          }
        }
      }
    }

    edits.push({
      range: {
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      },
      text: snippet,
    });

    editor.executeEdits("insert-asset", edits);
    editor.focus();
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const readEntriesRecursively = useCallback(
    async (
      dirEntry: FileSystemDirectoryEntry,
      basePath: string,
    ): Promise<{ file: File; relativePath: string }[]> => {
      const results: { file: File; relativePath: string }[] = [];
      const reader = dirEntry.createReader();

      const readBatch = (): Promise<FileSystemEntry[]> =>
        new Promise((resolve, reject) => reader.readEntries(resolve, reject));

      let batch: FileSystemEntry[];
      do {
        batch = await readBatch();
        for (const entry of batch) {
          if (entry.isFile) {
            const file = await new Promise<File>((resolve, reject) =>
              (entry as FileSystemFileEntry).file(resolve, reject),
            );
            results.push({ file, relativePath: `${basePath}/${file.name}` });
          } else if (entry.isDirectory) {
            const subResults = await readEntriesRecursively(
              entry as FileSystemDirectoryEntry,
              `${basePath}/${entry.name}`,
            );
            results.push(...subResults);
          }
        }
      } while (batch.length > 0);

      return results;
    },
    [],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (!parentPageId) return;

      const dtItems = e.dataTransfer.items;
      const allItems: { file: File; name: string }[] = [];
      const folderEntries: FileSystemDirectoryEntry[] = [];
      const plainFiles: File[] = [];

      if (dtItems?.length) {
        for (let i = 0; i < dtItems.length; i++) {
          const entry = dtItems[i].webkitGetAsEntry?.();
          if (entry?.isDirectory) {
            folderEntries.push(entry as FileSystemDirectoryEntry);
          } else if (entry?.isFile) {
            const file = e.dataTransfer.files[i];
            if (file) plainFiles.push(file);
          }
        }
      } else {
        plainFiles.push(...Array.from(e.dataTransfer.files));
      }

      plainFiles.forEach((f) => allItems.push({ file: f, name: f.name }));

      for (const dir of folderEntries) {
        const folderFiles = await readEntriesRecursively(dir, dir.name);
        for (const { file, relativePath } of folderFiles) {
          allItems.push({ file, name: relativePath });
        }
      }

      if (allItems.length > 0) {
        setPendingUploads(markConflicts(allItems));
        setUploadDialogOpen(true);
      }
    },
    [parentPageId, readEntriesRecursively, markConflicts],
  );

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // ── Upload-to-folder callback ──────────────────────────────────────────────

  const handleUploadToFolder = useCallback(
    (files: File[], folderId: string) => {
      if (!parentPageId || !projectId) return;
      setUploadingAssets(true);
      let done = 0;
      files.forEach((file) => {
        uploadFileMutation.mutate(
          { file, projectId, workspaceId, parentPageId, parentId: folderId },
          {
            onSettled: () => {
              done++;
              if (done === files.length) setUploadingAssets(false);
            },
          },
        );
      });
    },
    [parentPageId, projectId, workspaceId, uploadFileMutation],
  );

  return (
    <>
      <div className="w-full h-full flex flex-col select-none text-[13px]">
        {/* Hidden upload inputs */}
        <input
          ref={combinedUploadRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilePicked}
        />
        <input
          ref={folderUploadRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFolderPicked}
          {...({ webkitdirectory: "", directory: "" } as any)}
        />

        {/* ── Header toolbar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 h-[30px] shrink-0 border-b border-border/60">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Explorer
          </span>
          <div className="flex gap-0.5">
            {[
              { icon: FilePlus, label: "New File", action: handleStartCreate },
              {
                icon: FolderPlus,
                label: "New Folder",
                action: handleStartCreateFolder,
              },
              { icon: Upload, label: "Upload Files", action: handleUpload },
            ].map(({ icon: Icon, label, action }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <button
                    onClick={action}
                    className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{label}</TooltipContent>
              </Tooltip>
            ))}
            {onClose && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Close</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* ── File tree ──────────────────────────────────────────────── */}
        <div
          className="relative flex-1 overflow-y-auto"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag-over overlay */}
          {isDragging && (
            <div className="absolute inset-1 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 pointer-events-none backdrop-blur-[1px]">
              <div className="p-2.5 rounded-full bg-primary/10">
                <Upload className="size-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-primary">
                Drop files to upload
              </span>
            </div>
          )}

          {/* ── Inline create inputs ────────────────────────────────── */}
          {isCreatingFile && (
            <InlineInput
              icon={FileCode2}
              iconColor="text-blue-500"
              value={newFileName}
              onChange={setNewFileName}
              placeholder="filename.tex"
              onCommit={handleCreateFile}
              onCancel={handleCancelCreate}
              isPending={createFileMutation.isPending}
            />
          )}
          {isCreatingFolder && (
            <InlineInput
              icon={Folder}
              iconColor="text-amber-500"
              value={newFolderName}
              onChange={setNewFolderName}
              placeholder="folder name"
              onCommit={handleCreateFolder}
              onCancel={handleCancelCreateFolder}
              isPending={createFolderMutation.isPending}
            />
          )}

          {/* Loading skeleton */}
          {(isLoading || projectFilesLoading) && (
            <div className="flex flex-col">
              {[60, 75, 45, 82, 55].map((w, i) => (
                <div key={i} className="flex items-center h-[22px] gap-2 px-5">
                  <div className="size-3 rounded-sm bg-muted animate-pulse shrink-0" />
                  <div
                    className="h-2.5 rounded bg-muted animate-pulse"
                    style={{ width: `${w}%` }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Uploading indicator */}
          {(uploadingCount > 0 || uploadingAssets) && (
            <div className="flex items-center gap-2 px-5 h-[22px]">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                Uploading
                {uploadingCount > 0
                  ? ` ${uploadingCount} file${uploadingCount > 1 ? "s" : ""}`
                  : ""}
                …
              </span>
            </div>
          )}

          {/* ── UNIFIED FILE TREE ───────────────────────────────────── */}
          {!isLoading &&
            !projectFilesLoading &&
            (() => {
              type UnifiedItem =
                | { kind: "folder"; data: StorageItem }
                | { kind: "asset"; data: StorageItem }
                | {
                    kind: "tex";
                    data: { _id: string; title: string; updatedAt: string };
                  };

              const items: UnifiedItem[] = [];

              // Folders first
              projectFiles?.forEach((f) => {
                if (f.isFolder) items.push({ kind: "folder", data: f });
              });

              // Then tex files and non-tex files, sorted alphabetically
              const fileItems: UnifiedItem[] = [];
              files?.forEach((f) => fileItems.push({ kind: "tex", data: f }));
              projectFiles?.forEach((f) => {
                if (!f.isFolder) fileItems.push({ kind: "asset", data: f });
              });
              fileItems.sort((a, b) => {
                const nameA =
                  a.kind === "tex" ? a.data.title : a.data.filename;
                const nameB =
                  b.kind === "tex" ? b.data.title : b.data.filename;
                return nameA.localeCompare(nameB);
              });

              items.push(...fileItems);

              if (items.length === 0 && !isCreatingFile && !isCreatingFolder) {
                return (
                  <div className="flex flex-col items-center gap-2 px-5 py-8 text-muted-foreground">
                    <FileText className="size-6 opacity-20" />
                    <span className="text-[11px] text-center">
                      No files yet.{" "}
                      <button
                        onClick={handleStartCreate}
                        className="text-primary hover:underline"
                      >
                        Create a file
                      </button>
                      {" or "}
                      <button
                        onClick={handleUpload}
                        className="text-primary hover:underline"
                      >
                        upload
                      </button>
                    </span>
                  </div>
                );
              }

              return items.map((item) => {
                if (item.kind === "folder") {
                  return (
                    <StorageFolderNode
                      key={item.data._id}
                      folder={item.data}
                      projectId={projectId}
                      depth={0}
                      onInsertAsset={handleInsertAsset}
                      onPreview={handleOpenPreview}
                      onUploadToFolder={handleUploadToFolder}
                    />
                  );
                }

                if (item.kind === "asset") {
                  return (
                    <StorageFileRow
                      key={item.data._id}
                      item={item.data}
                      depth={0}
                      onInsertAsset={handleInsertAsset}
                      onPreview={handleOpenPreview}
                    />
                  );
                }

                // kind === "tex"
                const file = item.data;
                const isActive = file._id === pageId;
                const isMain = file._id === mainFileId;
                const { icon: FileIcon, color: fileColor } = getFileIcon(
                  file.title,
                );
                return (
                  <div
                    key={file._id}
                    onClick={() => handleFileClick(file._id, file.title)}
                    className={cn(
                      "group/row mt-1 flex items-center h-[22px] pr-2 cursor-pointer transition-colors",
                      isActive
                        ? "bg-primary/8 border-l-2 border-l-primary"
                        : "border-l-2 border-l-transparent hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn("shrink-0", isActive ? "w-[18px]" : "w-5")}
                    />
                    <FileIcon
                      className={cn(
                        "size-4 shrink-0 mr-1.5",
                        isActive ? "text-primary" : fileColor,
                      )}
                    />

                    {renamingId === file._id ? (
                      <RenameInput
                        value={renameValue}
                        onChange={setRenameValue}
                        onCommit={() => handleCommitRename(file._id)}
                        onCancel={() => setRenamingId(null)}
                        isPending={updateTitleMutation.isPending}
                      />
                    ) : (
                      <>
                        <span
                          className={cn(
                            "flex-1 min-w-0 truncate text-[14px]",
                            isActive
                              ? "text-primary font-medium"
                              : "text-foreground/90",
                          )}
                        >
                          {displayName(file.title)}
                        </span>
                        {isMain && !renamingId && (
                          <span className="shrink-0 text-[10px] px-1.5 py-px rounded-full border border-primary/30 bg-primary/8 text-primary/80 font-medium mr-1">
                            main
                          </span>
                        )}
                        {renamingId !== file._id && (
                          <RowActions>
                            {!isMain && (
                              <DropdownMenuItem
                                className="text-[12px]!"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetMain(file._id);
                                }}
                              >
                                <Star className="size-3.5 mr-2" />
                                Set as Main File
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-[12px]!"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(file);
                              }}
                            >
                              <Pencil className="size-3.5 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-[12px]! text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(file._id);
                              }}
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </RowActions>
                        )}
                      </>
                    )}
                  </div>
                );
              });
            })()}
        </div>
      </div>

      {/* Upload naming dialog */}
      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUploadDialogOpen(false);
            setPendingUploads([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Upload Files</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto py-1">
            {pendingUploads.map((item, i) => {
              const ext =
                "." + (item.file.name.split(".").pop() ?? "").toLowerCase();
              const isTex = TEX_EXTS.has(ext);
              const isImg = item.file.type.startsWith("image/");
              const hasPath = item.name.includes("/");
              const folderPath = hasPath
                ? item.name.substring(0, item.name.lastIndexOf("/"))
                : null;
              const Icon = isTex ? FileCode2 : isImg ? Image : Paperclip;
              const isDuplicate = item.conflict === "duplicate";
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 px-1 py-1 rounded",
                    isDuplicate && "bg-amber-500/5 ring-1 ring-amber-500/30",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      isDuplicate ? "text-amber-500" : "text-muted-foreground",
                    )}
                  />
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    {folderPath && (
                      <div className="flex items-center gap-1">
                        <Folder className="size-3 text-amber-500 shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">
                          {folderPath}
                        </span>
                      </div>
                    )}
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setPendingUploads((prev) =>
                          prev.map((p, j) => {
                            if (j !== i) return p;
                            const lower = newName.toLowerCase();
                            const conflict = existingNames.has(lower)
                              ? "duplicate"
                              : "none";
                            return { ...p, name: newName, conflict };
                          }),
                        );
                      }}
                      className={cn(
                        "w-full text-xs bg-muted/40 border rounded px-2 py-1 outline-none focus:border-primary",
                        isDuplicate ? "border-amber-500/50" : "border-border",
                      )}
                    />
                    {isDuplicate && (
                      <span className="text-[10px] text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="size-2.5" />
                        File already exists
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setPendingUploads((prev) =>
                        prev.filter((_, j) => j !== i),
                      )
                    }
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
            {pendingUploads.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No files selected.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div>
              {pendingUploads.some((p) => p.conflict === "duplicate") && (
                <button
                  onClick={handleAutoRenameAll}
                  className="h-7 px-3 rounded text-xs text-amber-600 hover:bg-amber-500/10 transition-colors flex items-center gap-1"
                >
                  <AlertTriangle className="size-3" />
                  Auto rename duplicates
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setUploadDialogOpen(false);
                  setPendingUploads([]);
                }}
                className="h-7 px-3 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={pendingUploads.length === 0}
                className="h-7 px-3 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Upload
                {pendingUploads.length > 0
                  ? ` ${pendingUploads.length} file${pendingUploads.length > 1 ? "s" : ""}`
                  : ""}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview dialog */}
      <Dialog
        open={!!previewItem}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">
              {previewItem?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-32">
            {previewItem?.url ? (
              <img
                src={previewItem.url}
                alt={previewItem.filename}
                className="max-w-full max-h-[70vh] object-contain rounded"
                crossOrigin="use-credentials"
              />
            ) : (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
