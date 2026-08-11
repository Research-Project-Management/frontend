'use client';

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { toast } from "sonner";
import Toolbar from "./Toolbar";
import { StorageListView, StorageGridView } from './storage-views';
import UploadDialog from "./UploadDialog";
import CreateFolderDialog from "./CreateFolderDialog";
import RenameDialog from "./RenameDialog";
import Breadcrumb from "./Breadcrumb";
import FilePreviewSidebar from "./FilePreviewSidebar";
import FilePreviewModal from "./FilePreviewModal";
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileAsBlob } from '@/features/workspaces/storage/hooks/use-blob-url';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  moveFile as workspaceMoveFile, 
} from "@/features/workspaces/storage/services/file.services";
import { Upload } from "lucide-react";
// Removed generateUniqueName as it's now handled by useStorage hook

type SourceFilter =
  | { kind: "all" }
  | { kind: "workspace" }
  | { kind: "shared" }
  | { kind: "project"; projectId: string; projectName: string };

type FileExplorerProps = {
  items: StorageItem[];
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
  const [dropFiles, setDropFiles] = useState<File[]>([]);
  const [fileToRename, setFileToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [previewItem, setPreviewItem] = useState<StorageItem | null>(null);
  const [previewModalItem, setPreviewModalItem] = useState<StorageItem | null>(
    null,
  );

  const [uploadTargetFolder, setUploadTargetFolder] = useState<string | null>(null);

  // Drag-drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const queryClient = useQueryClient();
  
  const moveFileMutation = useMutation({
    mutationFn: (args: any) => {
      return workspaceMoveFile(args.fileId, args.parentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-home-files'] });
      queryClient.invalidateQueries({ queryKey: ['my-files'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-my-files'] });
      queryClient.invalidateQueries({ queryKey: ['project-files'] });
      queryClient.invalidateQueries({ queryKey: ['project-my-files'] });
    }
  });

  const params = useParams() as { workspaceId: string };
  const { workspace } = useWorkspace(params.workspaceId);
  const effectiveWorkspaceId = wsId || workspaceId || workspace?._id || params.workspaceId;

  function toggleViewMode() {
    setViewMode((prev: any) => (prev === "list" ? "grid" : "list"));
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
    setPreviewItem((prev: any) => (prev?._id === item._id ? null : item));
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

  // Upload logic delegated entirely to UploadDialog

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
    (e: React.DragEvent) => {
      if (!enableUpload) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      // Handle desktop file drops only
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;

      // Open dialog with dropped files instead of uploading immediately
      setUploadTargetFolder(currentFolder ?? null);
      setDropFiles(droppedFiles);
      setUploadDialogOpen(true);
    },
    [enableUpload, currentFolder],
  );

  // ── Drop file onto a folder ───────────────────────────────────────────────

  const handleDropOnFolder = useCallback(
    async (folder: StorageItem, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Desktop files dropped onto a folder
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        setUploadTargetFolder(folder._id);
        setDropFiles(droppedFiles);
        setUploadDialogOpen(true);
      }
    },
    [],
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
          onUpload={enableUpload ? () => {
            setUploadTargetFolder(currentFolder ?? null);
            setUploadDialogOpen(true);
          } : undefined}
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
              onOpenChange={(open) => {
                setUploadDialogOpen(open);
                if (!open) {
                  setDropFiles([]);
                  setUploadTargetFolder(null);
                }
              }}
              parentId={uploadTargetFolder}
              workspaceId={effectiveWorkspaceId}
              initialFiles={dropFiles.length > 0 ? dropFiles : undefined}
            />

            <CreateFolderDialog
              open={createFolderDialogOpen}
              onOpenChange={setCreateFolderDialogOpen}
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

      </div>

      {/* Right preview sidebar */}
      {previewItem && (
        <FilePreviewSidebar
          item={previewItem}
          workspaceId={effectiveWorkspaceId}
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

