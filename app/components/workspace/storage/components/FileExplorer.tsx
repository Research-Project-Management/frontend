import { useState, useCallback } from "react";
import { toast } from "sonner";
import Toolbar from "./Toolbar";
import { StorageListView, StorageGridView } from "../pages/SharedComponents";
import UploadDialog from "./UploadDialog";
import CreateFolderDialog from "./CreateFolderDialog";
import RenameDialog from "./RenameDialog";
import Breadcrumb from "./Breadcrumb";
import FilePreviewSidebar from "./FilePreviewSidebar";
import FilePreviewModal from "./FilePreviewModal";
import DuplicateFileDialog from "./DuplicateFileDialog";
import type { DuplicateAction } from "./DuplicateFileDialog";
import type { StorageItem } from "../types";
import { downloadFileAsBlob } from "~/hooks/useBlobUrl";
import { useUploadFile, useMoveFile, checkDuplicate, deleteFile } from "~/query/storage";
import { Upload } from "lucide-react";

type FileExplorerProps = {
  items: StorageItem[];
  projectId?: string;
  currentFolder?: string | null;
  breadcrumbs?: Array<{ id: string | null; name: string }>;
  workspaceId?: string;
  // Thêm workspaceId riêng cho workspace-level uploads
  wsId?: string;

  // Actions
  onNavigate?: (folderId: string | null) => void;
  onFolderClick?: (folder: StorageItem) => void;
  onToggleStar: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onDownload: (item: StorageItem) => void;
  onRename?: (item: StorageItem) => void;

  // Feature flags
  enableUpload?: boolean;
  enableBreadcrumbs?: boolean;
  isTrash?: boolean;
  defaultView?: "grid" | "list";

  // Header content (Title, icon, etc.)
  header?: React.ReactNode;
};

export default function FileExplorer({
  items,
  projectId,
  currentFolder,
  breadcrumbs = [],
  workspaceId,
  wsId,
  onNavigate,
  onFolderClick,
  onToggleStar,
  onDelete,
  onDownload,
  onRename: onRenameProp,
  enableUpload = false,
  enableBreadcrumbs = false,
  isTrash = false,
  defaultView = "list",
  header,
}: FileExplorerProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">(defaultView);
  const [searchText, setSearchText] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [previewItem, setPreviewItem] = useState<StorageItem | null>(null);
  const [previewModalItem, setPreviewModalItem] = useState<StorageItem | null>(null);

  // Drag-drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Duplicate handling state
  const [duplicateFile, setDuplicateFile] = useState<File | null>(null);
  const [duplicateTargetFolder, setDuplicateTargetFolder] = useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  const uploadMutation = useUploadFile();
  const moveMutation = useMoveFile();

  const effectiveWorkspaceId = wsId || workspaceId;

  function toggleViewMode() {
    setViewMode((prev) => (prev === "list" ? "grid" : "list"));
  }

  const filteredFiles = items.filter((file) =>
    file.filename.toLowerCase().includes(searchText.toLowerCase()),
  );

  const handleFileClick = (item: StorageItem) => {
    setPreviewItem((prev) => (prev?._id === item._id ? null : item));
  };

  const handleFilePreview = (item: StorageItem) => {
    setPreviewModalItem(item);
  };

  const handleBlobDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileAsBlob(item.url, item.filename);
    } catch {
      onDownload(item);
    }
  };

  const handleRenameRequest = (item: StorageItem) => {
    if (onRenameProp) {
      setFileToRename({ id: item._id, name: item.filename });
      setRenameDialogOpen(true);
    }
  };

  const onRenameHandler = onRenameProp ? handleRenameRequest : undefined;

  // ── File upload with duplicate check ──────────────────────────────────────

  const generateUniqueName = (name: string): string => {
    const dot = name.lastIndexOf(".");
    const baseName = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";

    // Check against current items for a unique suffix
    let counter = 1;
    let candidate = `${baseName} (${counter})${ext}`;
    const existingNames = new Set(items.map((i) => i.filename));
    while (existingNames.has(candidate)) {
      counter++;
      candidate = `${baseName} (${counter})${ext}`;
    }
    return candidate;
  };

  const uploadWithDuplicateCheck = useCallback(
    async (file: File, targetFolder: string | null) => {
      try {
        const { exists } = await checkDuplicate(
          file.name,
          targetFolder,
          projectId,
          effectiveWorkspaceId,
        );

        if (exists) {
          setDuplicateFile(file);
          setDuplicateTargetFolder(targetFolder);
          setDuplicateDialogOpen(true);
          return;
        }

        // No duplicate — upload directly
        await uploadMutation.mutateAsync({
          file,
          projectId: projectId || "",
          workspaceId: effectiveWorkspaceId!,
          parentId: targetFolder,
        });
        toast.success(`Uploaded "${file.name}"`);
      } catch (error) {
        toast.error(`Failed to upload "${file.name}"`);
      }
    },
    [projectId, effectiveWorkspaceId, uploadMutation, items],
  );

  const handleDuplicateAction = useCallback(
    async (action: DuplicateAction) => {
      setDuplicateDialogOpen(false);
      if (!duplicateFile) return;

      const file = duplicateFile;
      const targetFolder = duplicateTargetFolder;
      setDuplicateFile(null);

      if (action === "cancel") return;

      try {
        if (action === "overwrite") {
          // Find and delete the existing file first
          const existing = items.find(
            (i) => i.filename === file.name && !i.isFolder,
          );
          if (existing) {
            await deleteFile(existing._id);
          }
          await uploadMutation.mutateAsync({
            file,
            projectId: projectId || "",
            workspaceId: effectiveWorkspaceId!,
            parentId: targetFolder,
          });
          toast.success(`Replaced "${file.name}"`);
        } else if (action === "keep-both") {
          const newName = generateUniqueName(file.name);
          const renamed = new File([file], newName, { type: file.type });
          await uploadMutation.mutateAsync({
            file: renamed,
            projectId: projectId || "",
            workspaceId: effectiveWorkspaceId!,
            parentId: targetFolder,
          });
          toast.success(`Uploaded as "${newName}"`);
        }
      } catch {
        toast.error(`Failed to upload "${file.name}"`);
      }
    },
    [duplicateFile, duplicateTargetFolder, items, projectId, effectiveWorkspaceId, uploadMutation],
  );

  // ── Drag-and-drop on main area ────────────────────────────────────────────

  const handleAreaDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enableUpload) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    },
    [enableUpload],
  );

  const handleAreaDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only count as leave if actually leaving the container
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const { clientX: x, clientY: y } = e;
      if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
        setIsDraggingOver(false);
      }
    },
    [],
  );

  const handleAreaDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!enableUpload) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      // Handle desktop file drops only
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;

      for (const file of droppedFiles) {
        await uploadWithDuplicateCheck(file, currentFolder || null);
      }
    },
    [enableUpload, currentFolder, uploadWithDuplicateCheck],
  );

  // ── Drop file onto a folder ───────────────────────────────────────────────

  const handleDropOnFolder = useCallback(
    async (folder: StorageItem, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Desktop files dropped onto a folder
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        for (const file of droppedFiles) {
          await uploadWithDuplicateCheck(file, folder._id);
        }
        return;
      }

      // Internal file move (drag existing file onto folder)
      const fileId = e.dataTransfer.getData("application/x-file-id");
      if (fileId && fileId !== folder._id) {
        try {
          await moveMutation.mutateAsync({ fileId, parentId: folder._id });
          toast.success("File moved to folder");
        } catch {
          toast.error("Failed to move file");
        }
      }
    },
    [uploadWithDuplicateCheck, moveMutation],
  );

  // ── Internal drag start (for moving files between folders) ────────────────

  const handleDragStartFile = useCallback((item: StorageItem, e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-file-id", item._id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Main file list area */}
      <div
        className={`flex-1 flex flex-col px-6 py-4 min-w-0 overflow-hidden relative transition-colors ${
          isDraggingOver ? "bg-primary/5" : ""
        }`}
        onDragOver={handleAreaDragOver}
        onDragLeave={handleAreaDragLeave}
        onDrop={handleAreaDrop}
      >
        {/* Drag overlay indicator */}
        {isDraggingOver && (
          <div className="absolute inset-4 border-2 border-dashed border-primary/40 rounded-xl flex items-center justify-center bg-primary/5 z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="size-10" />
              <p className="text-sm font-medium">Drop files here to upload</p>
            </div>
          </div>
        )}

        {header && <div className="mb-3">{header}</div>}

        {enableBreadcrumbs && breadcrumbs.length > 0 && onNavigate && (
          <Breadcrumb
            items={breadcrumbs}
            workspaceId={workspaceId || ""}
            onNavigate={onNavigate}
          />
        )}

        <Toolbar
          searchValue={searchText}
          onSearchChange={setSearchText}
          viewMode={viewMode}
          onToggleView={toggleViewMode}
          onUpload={enableUpload ? () => setUploadDialogOpen(true) : undefined}
          onCreateFolder={
            enableUpload ? () => setCreateFolderDialogOpen(true) : undefined
          }
        />

        <div className="flex-1 overflow-auto">
          {viewMode === "list" ? (
            <StorageListView
              items={filteredFiles}
              onFolderClick={onFolderClick}
              onFileClick={handleFileClick}
              onToggleStar={onToggleStar}
              onDelete={onDelete}
              onDownload={onDownload}
              onRename={onRenameHandler}
              isTrash={isTrash}
              selectedItemId={previewItem?._id}
              onDropOnFolder={enableUpload ? handleDropOnFolder : undefined}
              onDragStartFile={enableUpload ? handleDragStartFile : undefined}
            />
          ) : (
            <StorageGridView
              items={filteredFiles}
              onFolderClick={onFolderClick}
              onFileClick={handleFileClick}
              onToggleStar={onToggleStar}
              onDelete={onDelete}
              onDownload={onDownload}
              onRename={onRenameHandler}
              isTrash={isTrash}
              selectedItemId={previewItem?._id}
              onDropOnFolder={enableUpload ? handleDropOnFolder : undefined}
              onDragStartFile={enableUpload ? handleDragStartFile : undefined}
            />
          )}
        </div>

        {enableUpload && (
          <>
            <UploadDialog
              open={uploadDialogOpen}
              onOpenChange={setUploadDialogOpen}
              projectId={projectId}
              parentId={currentFolder}
              workspaceId={wsId}
            />

            <CreateFolderDialog
              open={createFolderDialogOpen}
              onOpenChange={setCreateFolderDialogOpen}
              projectId={projectId}
              parentId={currentFolder}
              workspaceId={wsId}
            />
          </>
        )}

        <RenameDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          fileId={fileToRename?.id || null}
          currentName={fileToRename?.name || ""}
        />

        <DuplicateFileDialog
          open={duplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
          filename={duplicateFile?.name || ""}
          onAction={handleDuplicateAction}
        />
      </div>

      {/* Right preview sidebar */}
      {previewItem && (
        <FilePreviewSidebar
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDownload={handleBlobDownload}
          onPreview={handleFilePreview}
        />
      )}

      {/* Full-screen preview modal */}
      <FilePreviewModal
        item={previewModalItem}
        open={!!previewModalItem}
        onOpenChange={(open) => !open && setPreviewModalItem(null)}
      />
    </div>
  );
}
