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
import {
  useUploadFile,
  useMoveFile,
  checkDuplicate,
  deleteFile,
} from "~/query/storage";
import { generateUniqueName } from "~/lib/utils";
import { Upload } from "lucide-react";

type SourceFilter =
  | { kind: "all" }
  | { kind: "workspace" }
  | { kind: "shared" }
  | { kind: "project"; projectId: string; projectName: string };

type FileExplorerProps = {
  items: StorageItem[];
  storageScope?: "project" | "workspace";
  projectId?: string;
  currentFolder?: string | null;
  breadcrumbs?: Array<{ id: string | null; name: string }>;
  workspaceId?: string;
  // Separate workspaceId for workspace-level uploads
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
  storageScope = "project",
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
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>({
    kind: "all",
  });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [previewItem, setPreviewItem] = useState<StorageItem | null>(null);
  const [previewModalItem, setPreviewModalItem] = useState<StorageItem | null>(
    null,
  );

  // Drag-drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Duplicate handling state
  const [duplicateFile, setDuplicateFile] = useState<File | null>(null);
  const [duplicateTargetFolder, setDuplicateTargetFolder] = useState<
    string | null
  >(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  const uploadMutation = useUploadFile();

  const effectiveWorkspaceId = wsId || workspaceId;

  function toggleViewMode() {
    setViewMode((prev) => (prev === "list" ? "grid" : "list"));
  }

  const projectOptions = Array.from(
    new Map(
      items
        .filter((item) => item.project?.name)
        .map((item) => [
          item.project!._id,
          { value: item.project!._id, label: item.project!.name },
        ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const classifySource = (item: StorageItem): SourceFilter => {
    if (item.sharedWith?.length) return { kind: "shared" };
    if (item.project?._id) {
      return {
        kind: "project",
        projectId: item.project._id,
        projectName: item.project.name,
      };
    }
    return { kind: "workspace" };
  };

  const filteredFiles = items.filter((file) => {
    const matchesSearch = file.filename
      .toLowerCase()
      .includes(searchText.toLowerCase());
      
    const fileSource = classifySource(file);
    
    const matchesSource =
      sourceFilter.kind === "all" ||
      (sourceFilter.kind === "workspace" && fileSource.kind === "workspace") ||
      (sourceFilter.kind === "shared" && fileSource.kind === "shared") ||
      (sourceFilter.kind === "project" &&
        fileSource.kind === "project" &&
        fileSource.projectId === sourceFilter.projectId);
        
    return matchesSearch && matchesSource;
  });

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

  const uploadWithDuplicateCheck = useCallback(
    async (file: File, targetFolder: string | null) => {
      try {
        const { exists } = await checkDuplicate(file.name, targetFolder, {
          scope: storageScope,
          projectId,
          workspaceId: effectiveWorkspaceId,
        });

        if (exists) {
          setDuplicateFile(file);
          setDuplicateTargetFolder(targetFolder);
          setDuplicateDialogOpen(true);
          return;
        }

        // No duplicate — upload directly
        await uploadMutation.mutateAsync({
          file,
          scope: storageScope,
          projectId,
          workspaceId: effectiveWorkspaceId,
          parentId: targetFolder,
        });
        toast.success(`Uploaded "${file.name}"`);
      } catch (error) {
        toast.error(`Failed to upload "${file.name}"`);
      }
    },
    [storageScope, projectId, effectiveWorkspaceId, uploadMutation],
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
            scope: storageScope,
            projectId,
            workspaceId: effectiveWorkspaceId,
            parentId: targetFolder,
          });
          toast.success(`Replaced "${file.name}"`);
        } else if (action === "keep-both") {
          const existingFileNames = new Set(items.map((i) => i.filename));
          const newName = generateUniqueName(file.name, existingFileNames);
          const renamed = new File([file], newName, { type: file.type });
          await uploadMutation.mutateAsync({
            file: renamed,
            scope: storageScope,
            projectId,
            workspaceId: effectiveWorkspaceId,
            parentId: targetFolder,
          });
          toast.success(`Uploaded as "${newName}"`);
        }
      } catch {
        toast.error(`Failed to upload "${file.name}"`);
      }
    },
    [
      duplicateFile,
      duplicateTargetFolder,
      items,
      storageScope,
      projectId,
      effectiveWorkspaceId,
      uploadMutation,
    ],
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

  const handleAreaDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only count as leave if actually leaving the container
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      setIsDraggingOver(false);
    }
  }, []);

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
      }
    },
    [uploadWithDuplicateCheck],
  );

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
          sourceFilter={sourceFilter}
          projectOptions={projectOptions}
          onSourceChange={setSourceFilter}
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
              onDragStartFile={undefined}
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
              onDragStartFile={undefined}
            />
          )}
        </div>

        {enableUpload && (
          <>
            <UploadDialog
              open={uploadDialogOpen}
              onOpenChange={setUploadDialogOpen}
              scope={storageScope}
              projectId={projectId}
              parentId={currentFolder}
              workspaceId={effectiveWorkspaceId}
            />

            <CreateFolderDialog
              open={createFolderDialogOpen}
              onOpenChange={setCreateFolderDialogOpen}
              scope={storageScope}
              projectId={projectId}
              parentId={currentFolder}
              workspaceId={effectiveWorkspaceId}
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
