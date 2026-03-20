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
} from "~/query/page";
import type { PageFileAsset } from "~/types/page";

// ── Folder Node (recursive, collapsible) ─────────────────────────────────────

function FolderNode({
  folder,
  pageId,
  depth,
  onInsertAsset,
  onPreview,
}: {
  folder: PageFileAsset;
  pageId: string;
  depth: number;
  onInsertAsset: (name: string) => void;
  onPreview: (asset: PageFileAsset) => void;
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

  return (
    <>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className="group flex items-center gap-1.5 py-1.5 pr-2 cursor-pointer transition-colors text-foreground hover:bg-primary/5"
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
        {expanded ? (
          <FolderOpen className="size-3.5 shrink-0 text-amber-500" />
        ) : (
          <Folder className="size-3.5 shrink-0 text-amber-500" />
        )}

        {renamingId === folder._id ? (
          <>
            <input
              autoFocus
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleCommitRename(folder._id);
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="flex-1 min-w-0 text-xs bg-transparent border-b border-primary outline-none"
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleCommitRename(folder._id); }}
              className="text-primary hover:opacity-70 transition-opacity shrink-0"
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setRenamingId(null); }}
              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 min-w-0 truncate text-xs">{folder.filename}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  <Ellipsis className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  className="text-xs!"
                  onClick={(e) => { e.stopPropagation(); handleStartRename(folder); }}
                >
                  <Pencil className="size-3.5 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-xs!"
                  onClick={(e) => { e.stopPropagation(); handleDelete(folder._id); }}
                >
                  <Trash2 className="size-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Children (loaded on expand) */}
      {expanded && (
        <>
          {isLoading && (
            <div style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }} className="py-1">
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
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
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              className="text-[10px] text-muted-foreground/60 italic py-1"
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
      onClick={() =>
        isImage ? onPreview(asset) : onInsertAsset(asset.filename)
      }
      title={
        isImage
          ? `Click to preview ${asset.filename}`
          : `Click to insert \\includegraphics{${asset.filename}}`
      }
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      className="group flex items-center gap-2 py-1.5 pr-2 cursor-pointer transition-colors text-foreground hover:bg-primary/5"
    >
      {isImage ? (
        <Image className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
      )}

      {renamingId === asset._id ? (
        <>
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleCommitRename();
              if (e.key === "Escape") setRenamingId(null);
            }}
            className="flex-1 min-w-0 text-xs bg-transparent border-b border-primary outline-none"
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleCommitRename(); }}
            className="text-primary hover:opacity-70 transition-opacity shrink-0"
          >
            <Check className="size-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setRenamingId(null); }}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 min-w-0 truncate text-xs">{asset.filename}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <Ellipsis className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="text-xs!"
                onClick={(e) => { e.stopPropagation(); onInsertAsset(asset.filename); }}
              >
                <FileCode2 className="size-3.5 mr-2" />
                Insert Command
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs!"
                onClick={(e) => { e.stopPropagation(); handleStartRename(); }}
              >
                <Pencil className="size-3.5 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs!"
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

  // The parent page-project ID
  const parentPageId: string | null = currentPage
    ? currentPage.parentPage
      ? String(currentPage.parentPage)
      : currentPage._id
    : null;

  // Fetch the parent page to know which file is mainFile
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

  // Assets (R2-backed files & folders) — root level only
  const { data: assets, isLoading: assetsLoading } = usePageAssets(parentPageId);
  const uploadAssetMutation = useUploadPageAsset();
  const deleteAssetMutation = useDeletePageAsset();
  const createFolderMutation = useCreatePageFolder();

  // Image preview
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
    // For folder uploads, flatten all files with their webkitRelativePath
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

    // Auto-inject \usepackage{graphicx} before \begin{document} if it's missing.
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

  return (
    <>
      <div className="w-full h-full flex flex-col select-none">
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

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3 h-8 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Files
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
                    className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
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
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Close</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* File list */}
        <div
          className="relative flex-1 overflow-y-auto py-1"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag-over overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
              <Upload className="size-6 text-primary" />
              <span className="text-xs font-medium text-primary">
                Drop to upload
              </span>
            </div>
          )}

          {/* Inline new-file input */}
          {isCreatingFile && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <FileCode2 className="size-3.5 text-muted-foreground shrink-0" />
              <input
                ref={newFileInputRef}
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFile();
                  if (e.key === "Escape") handleCancelCreate();
                }}
                placeholder="filename.tex"
                className="flex-1 min-w-0 text-xs bg-transparent border-b border-primary outline-none text-primary placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleCreateFile}
                disabled={createFileMutation.isPending}
                className="text-primary hover:opacity-70 transition-opacity disabled:opacity-40"
              >
                {createFileMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
              </button>
              <button
                onClick={handleCancelCreate}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Inline new-folder input */}
          {isCreatingFolder && (
            <div className="flex items-center gap-1.5 px-2 py-1">
              <Folder className="size-3.5 text-amber-500 shrink-0" />
              <input
                ref={newFolderInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") handleCancelCreateFolder();
                }}
                placeholder="folder name"
                className="flex-1 min-w-0 text-xs bg-transparent border-b border-primary outline-none text-primary placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleCreateFolder}
                disabled={createFolderMutation.isPending}
                className="text-primary hover:opacity-70 transition-opacity disabled:opacity-40"
              >
                {createFolderMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
              </button>
              <button
                onClick={handleCancelCreateFolder}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Loading — skeleton rows */}
          {(isLoading || assetsLoading) && (
            <div className="flex flex-col">
              {[65, 82, 50, 90, 72, 58].map((w, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                  <div className="size-3.5 rounded-sm bg-muted animate-pulse shrink-0" />
                  <div
                    className="h-2 rounded bg-muted animate-pulse"
                    style={{ width: `${w}%` }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Uploading indicator — tex files */}
          {uploadingCount > 0 && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Uploading {uploadingCount} file{uploadingCount > 1 ? "s" : ""}…
              </span>
            </div>
          )}

          {/* TeX file rows */}
          {!isLoading &&
            !assetsLoading &&
            files?.map((file) => {
              const isActive = file._id === pageId;
              const isMain = file._id === mainFileId;
              return (
                <div
                  key={file._id}
                  onClick={() => handleFileClick(file._id)}
                  className={cn(
                    "group flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:bg-primary/5",
                  )}
                >
                  <FileCode2
                    className={cn(
                      "size-3.5 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />

                  {renamingId === file._id ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") handleCommitRename(file._id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="flex-1 min-w-0 text-xs bg-transparent border-b border-primary outline-none"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCommitRename(file._id);
                        }}
                        disabled={updateTitleMutation.isPending}
                        className="text-primary hover:opacity-70 transition-opacity disabled:opacity-40 shrink-0"
                      >
                        {updateTitleMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(null);
                        }}
                        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <span className="flex-1 flex items-center min-w-0 truncate text-xs">
                      {displayName(file.title)}
                      {isMain && !renamingId && (
                        <span className="ml-2 text-xs text-primary/80 p-0.5 px-1 rounded bg-primary/20">
                          main
                        </span>
                      )}
                    </span>
                  )}

                  {/* Context menu */}
                  {renamingId !== file._id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity",
                            "text-muted-foreground hover:text-primary hover:bg-primary/10",
                          )}
                        >
                          <Ellipsis className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {!isMain && (
                          <DropdownMenuItem
                            className="text-xs!"
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
                          className="text-xs!"
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
                          className="text-xs!"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file._id);
                          }}
                        >
                          <Trash2 className="size-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}

          {/* Uploading indicator — assets */}
          {uploadingAssets && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Uploading…</span>
            </div>
          )}

          {/* Asset rows — unified with files (folders first, then files) */}
          {!isLoading &&
            !assetsLoading &&
            assets?.map((asset) =>
              asset.isFolder ? (
                <FolderNode
                  key={asset._id}
                  folder={asset}
                  pageId={parentPageId!}
                  depth={0}
                  onInsertAsset={handleInsertAsset}
                  onPreview={handleOpenPreview}
                />
              ) : (
                <AssetFileRow
                  key={asset._id}
                  asset={asset}
                  pageId={parentPageId!}
                  depth={0}
                  onInsertAsset={handleInsertAsset}
                  onPreview={handleOpenPreview}
                />
              ),
            )}

          {/* Empty state */}
          {!isLoading &&
            !assetsLoading &&
            !files?.length &&
            !assets?.length &&
            !isCreatingFile &&
            !isCreatingFolder && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <FileText className="size-8 opacity-25" />
                <p className="text-xs text-center leading-relaxed">
                  No files yet.
                  <br />
                  <button
                    onClick={handleStartCreate}
                    className="text-primary hover:underline"
                  >
                    Create your first file
                  </button>
                </p>
              </div>
            )}
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

      {/* Image preview dialog — now using R2 URL directly */}
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
