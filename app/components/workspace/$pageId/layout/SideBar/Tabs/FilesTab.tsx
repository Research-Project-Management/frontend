import React, { useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
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
  usePageAssets,
  useUploadPageAsset,
  useDeletePageAsset,
  useCreatePageFolder,
  useRenamePageAsset,
  useMovePageAsset,
} from "~/query/page";
import type { PageFileAsset } from "~/types/page";

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

function getAssetIcon(asset: PageFileAsset) {
  const isImage = asset.mimeType?.startsWith("image/");
  if (isImage) return { icon: Image, color: "text-amber-500" };
  return { icon: Paperclip, color: "text-muted-foreground" };
}

// ── Indent Guide ─────────────────────────────────────────────────────────────

function IndentGuides({ depth }: { depth: number }) {
  if (depth <= 0) return null;
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <span
          key={i}
          className="shrink-0 w-4 flex justify-center self-stretch"
        >
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
      <Icon className={cn("size-3.5 shrink-0 mr-1.5", iconColor ?? "text-muted-foreground")} />
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
        onClick={(e) => { e.stopPropagation(); onCommit(); }}
        disabled={isPending}
        className="p-0.5 text-primary hover:opacity-70 transition-opacity disabled:opacity-40 shrink-0"
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
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

// ── Folder Node (recursive, collapsible) ─────────────────────────────────────

function FolderNode({
  folder,
  pageId,
  depth,
  onInsertAsset,
  onPreview,
  onUploadToFolder,
  onMoveAssetToFolder,
}: {
  folder: PageFileAsset;
  pageId: string;
  depth: number;
  onInsertAsset: (name: string) => void;
  onPreview: (asset: PageFileAsset) => void;
  onUploadToFolder?: (files: File[], folderId: string) => void;
  onMoveAssetToFolder?: (assetId: string, folderId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: children, isLoading } = usePageAssets(pageId, expanded ? folder._id : undefined);
  const deleteAssetMutation = useDeletePageAsset();
  const renameAssetMutation = useRenamePageAsset();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleDelete = (assetId: string) => {
    deleteAssetMutation.mutate({ pageId, assetId });
  };

  const handleStartRename = (asset: PageFileAsset) => {
    setRenamingId(asset._id);
    setRenameValue(asset.filename);
  };

  const handleCommitRename = (assetId: string) => {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    renameAssetMutation.mutate(
      { pageId, assetId, name },
      { onSuccess: () => setRenamingId(null) },
    );
  };

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
          const droppedFiles = Array.from(e.dataTransfer.files);
          if (droppedFiles.length > 0 && onUploadToFolder) {
            onUploadToFolder(droppedFiles, folder._id);
            return;
          }
          const assetId = e.dataTransfer.getData("application/x-asset-id");
          if (assetId && assetId !== folder._id && onMoveAssetToFolder) {
            onMoveAssetToFolder(assetId, folder._id);
          }
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
            onCommit={() => handleCommitRename(folder._id)}
            onCancel={() => setRenamingId(null)}
          />
        ) : (
          <>
            <span className="flex-1 min-w-0 truncate text-[12px] text-foreground/90">
              {folder.filename}
            </span>
            <RowActions>
              <DropdownMenuItem
                className="text-[12px]!"
                onClick={(e) => { e.stopPropagation(); handleStartRename(folder); }}
              >
                <Pencil className="size-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[12px]! text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); handleDelete(folder._id); }}
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
              <FolderNode
                key={child._id}
                folder={child}
                pageId={pageId}
                depth={depth + 1}
                onInsertAsset={onInsertAsset}
                onPreview={onPreview}
                onUploadToFolder={onUploadToFolder}
                onMoveAssetToFolder={onMoveAssetToFolder}
              />
            ) : (
              <AssetFileRow
                key={child._id}
                asset={child}
                pageId={pageId}
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

// ── Asset File Row ──────────────────────────────────────────────────────────

function AssetFileRow({
  asset,
  pageId,
  depth,
  onInsertAsset,
  onPreview,
}: {
  asset: PageFileAsset;
  pageId: string;
  depth: number;
  onInsertAsset: (name: string) => void;
  onPreview: (asset: PageFileAsset) => void;
}) {
  const isImage = asset.mimeType?.startsWith("image/");
  const { icon: Icon, color } = getAssetIcon(asset);
  const deleteAssetMutation = useDeletePageAsset();
  const renameAssetMutation = useRenamePageAsset();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleDelete = () => deleteAssetMutation.mutate({ pageId, assetId: asset._id });

  const handleStartRename = () => {
    setRenamingId(asset._id);
    setRenameValue(asset.filename);
  };

  const handleCommitRename = () => {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    renameAssetMutation.mutate(
      { pageId, assetId: asset._id, name },
      { onSuccess: () => setRenamingId(null) },
    );
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-asset-id", asset._id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() =>
        isImage ? onPreview(asset) : onInsertAsset(asset.filename)
      }
      title={
        isImage
          ? `Click to preview ${asset.filename}`
          : `Click to insert \\includegraphics{${asset.filename}}`
      }
      className="group/row flex items-center h-[22px] pr-2 cursor-pointer transition-colors hover:bg-muted/50"
    >
      <IndentGuides depth={depth} />
      {/* Spacer to align with folder chevrons */}
      <span className="w-4 shrink-0" />
      <Icon className={cn("size-3.5 shrink-0 mr-1.5", color)} />

      {renamingId === asset._id ? (
        <RenameInput
          value={renameValue}
          onChange={setRenameValue}
          onCommit={handleCommitRename}
          onCancel={() => setRenamingId(null)}
        />
      ) : (
        <>
          <span className="flex-1 min-w-0 truncate text-[12px] text-foreground/90">
            {asset.filename}
          </span>
          <RowActions>
            <DropdownMenuItem
              className="text-[12px]!"
              onClick={(e) => { e.stopPropagation(); onInsertAsset(asset.filename); }}
            >
              <FileCode2 className="size-3.5 mr-2" />
              Insert Command
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[12px]!"
              onClick={(e) => { e.stopPropagation(); handleStartRename(); }}
            >
              <Pencil className="size-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[12px]! text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
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
  ".tex", ".bib", ".cls", ".sty", ".bst", ".txt", ".md", ".ltx", ".dtx", ".ins",
]);

// ── Main FilesTab ───────────────────────────────────────────────────────────

export default function FilesTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const { currentPage, editorRef } = usePageContext();
  const navigate = useNavigate();

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
  const [pendingUploads, setPendingUploads] = useState<
    { file: File; name: string }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Collapsible section state — no longer needed for separate sections

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

  const { data: files, isLoading } = usePageFiles(parentPageId);

  const createFileMutation = useCreatePageFile();
  const setMainFileMutation = useSetPageMainFile();
  const deletePageMutation = useDeletePage();
  const updateTitleMutation = useUpdatePageTitle();

  const { data: assets, isLoading: assetsLoading } = usePageAssets(parentPageId);
  const uploadAssetMutation = useUploadPageAsset();
  const deleteAssetMutation = useDeletePageAsset();
  const createFolderMutation = useCreatePageFolder();
  const moveAssetMutation = useMovePageAsset();

  const [previewAsset, setPreviewAsset] = useState<PageFileAsset | null>(null);

  const handleOpenPreview = useCallback((asset: PageFileAsset) => {
    setPreviewAsset(asset);
  }, []);

  const projectId =
    currentPage?.project && typeof currentPage.project === "object"
      ? currentPage.project._id
      : ((currentPage?.project as string | null | undefined) ?? "");

  const handleFileClick = (fileId: string) => {
    if (fileId !== pageId) navigate(`/editor/${fileId}`);
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

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    setPendingUploads(picked.map((f) => ({ file: f, name: f.name })));
    setUploadDialogOpen(true);
  };

  const handleFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    setPendingUploads(
      picked.map((f) => ({
        file: f,
        name: (f as any).webkitRelativePath || f.name,
      })),
    );
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
    if (!parentPageId || !name) return;
    createFolderMutation.mutate(
      { pageId: parentPageId, name },
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

  const handleConfirmUpload = () => {
    if (!parentPageId || !pendingUploads.length) return;
    setUploadDialogOpen(false);
    const texItems = pendingUploads.filter(({ file }) =>
      TEX_EXTS.has("." + (file.name.split(".").pop() ?? "").toLowerCase()),
    );
    const assetItems = pendingUploads.filter(
      ({ file }) =>
        !TEX_EXTS.has("." + (file.name.split(".").pop() ?? "").toLowerCase()),
    );
    if (texItems.length) {
      setUploadingCount(texItems.length);
      let lastId: string | null = null;
      let done = 0;
      texItems.forEach(({ file, name }) => {
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
                if (done === texItems.length) {
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
    if (assetItems.length) {
      setUploadingAssets(true);
      let done = 0;
      assetItems.forEach(({ file, name }) => {
        const renamedFile =
          name !== file.name
            ? new File([file], name, { type: file.type })
            : file;
        uploadAssetMutation.mutate(
          { pageId: parentPageId, file: renamedFile },
          {
            onSettled: () => {
              done++;
              if (done === assetItems.length) setUploadingAssets(false);
            },
          },
        );
      });
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

  const handleDeleteAsset = (assetId: string) => {
    if (!parentPageId) return;
    deleteAssetMutation.mutate({ pageId: parentPageId, assetId });
  };

  // ── Drag & drop ──────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (!parentPageId) return;
      const dropped = Array.from(e.dataTransfer.files);
      if (!dropped.length) return;
      setPendingUploads(dropped.map((f) => ({ file: f, name: f.name })));
      setUploadDialogOpen(true);
    },
    [parentPageId],
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

  // ── Upload-to-folder callback ──────────────────────────────────────────

  const handleUploadToFolder = useCallback(
    (files: File[], folderId: string) => {
      if (!parentPageId) return;
      const items = files.map((f) => ({ file: f, name: f.name }));
      let done = 0;
      setUploadingAssets(true);
      items.forEach(({ file, name }) => {
        const renamedFile =
          name !== file.name
            ? new File([file], name, { type: file.type })
            : file;
        uploadAssetMutation.mutate(
          { pageId: parentPageId, file: renamedFile, parentId: folderId },
          {
            onSettled: () => {
              done++;
              if (done === items.length) setUploadingAssets(false);
            },
          },
        );
      });
    },
    [parentPageId, uploadAssetMutation],
  );

  // ── Move asset to folder ──────────────────────────────────────────────

  const handleMoveAssetToFolder = useCallback(
    (assetId: string, folderId: string) => {
      if (!parentPageId) return;
      moveAssetMutation.mutate({ pageId: parentPageId, assetId, parentId: folderId });
    },
    [parentPageId, moveAssetMutation],
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
              { icon: FolderPlus, label: "New Folder", action: handleStartCreateFolder },
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
          {(isLoading || assetsLoading) && (
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
                Uploading{uploadingCount > 0 ? ` ${uploadingCount} file${uploadingCount > 1 ? "s" : ""}` : ""}…
              </span>
            </div>
          )}

          {/* ── UNIFIED FILE TREE ──────────────────────────────────── */}
          {!isLoading && !assetsLoading && (() => {
            // Merge tex files and assets into one sorted list
            // Order: folders first, then files alphabetically
            type UnifiedItem =
              | { kind: "folder"; data: PageFileAsset }
              | { kind: "asset"; data: PageFileAsset }
              | { kind: "tex"; data: { _id: string; title: string; updatedAt: string } };

            const items: UnifiedItem[] = [];

            // Add asset folders first
            assets?.forEach((a) => {
              if (a.isFolder) items.push({ kind: "folder", data: a });
            });

            // Then all files: tex files + asset files, sorted alphabetically
            const fileItems: UnifiedItem[] = [];
            files?.forEach((f) => fileItems.push({ kind: "tex", data: f }));
            assets?.forEach((a) => {
              if (!a.isFolder) fileItems.push({ kind: "asset", data: a });
            });
            fileItems.sort((a, b) => {
              const nameA = a.kind === "tex" ? a.data.title : (a.data as PageFileAsset).filename;
              const nameB = b.kind === "tex" ? b.data.title : (b.data as PageFileAsset).filename;
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
                  <FolderNode
                    key={item.data._id}
                    folder={item.data}
                    pageId={parentPageId!}
                    depth={0}
                    onInsertAsset={handleInsertAsset}
                    onPreview={handleOpenPreview}
                    onUploadToFolder={handleUploadToFolder}
                    onMoveAssetToFolder={handleMoveAssetToFolder}
                  />
                );
              }

              if (item.kind === "asset") {
                return (
                  <AssetFileRow
                    key={item.data._id}
                    asset={item.data as PageFileAsset}
                    pageId={parentPageId!}
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
              const { icon: FileIcon, color: fileColor } = getFileIcon(file.title);
              return (
                <div
                  key={file._id}
                  onClick={() => handleFileClick(file._id)}
                  className={cn(
                    "group/row flex items-center h-[22px] pr-2 cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary/8 border-l-2 border-l-primary"
                      : "border-l-2 border-l-transparent hover:bg-muted/50",
                  )}
                >
                  {/* Spacer for chevron alignment */}
                  <span className={cn("shrink-0", isActive ? "w-[18px]" : "w-5")} />
                  <FileIcon
                    className={cn(
                      "size-3.5 shrink-0 mr-1.5",
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
                          "flex-1 min-w-0 truncate text-[12px]",
                          isActive ? "text-primary font-medium" : "text-foreground/90",
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
              const Icon = isTex ? FileCode2 : isImg ? Image : Paperclip;
              return (
                <div key={i} className="flex items-center gap-2 px-1 py-1">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      setPendingUploads((prev) =>
                        prev.map((p, j) =>
                          j === i ? { ...p, name: e.target.value } : p,
                        ),
                      )
                    }
                    className="flex-1 min-w-0 text-xs bg-muted/40 border border-border rounded px-2 py-1 outline-none focus:border-primary"
                  />
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
          <div className="flex justify-end gap-2 pt-1">
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
        </DialogContent>
      </Dialog>

      {/* Image preview dialog */}
      <Dialog
        open={!!previewAsset}
        onOpenChange={(open) => {
          if (!open) setPreviewAsset(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">
              {previewAsset?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-32">
            {previewAsset?.url ? (
              <img
                src={previewAsset.url}
                alt={previewAsset.filename}
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
