import { useState } from "react";
import Toolbar from "./Toolbar";
import { StorageListView, StorageGridView } from "../pages/SharedComponents";
import UploadDialog from "./UploadDialog";
import CreateFolderDialog from "./CreateFolderDialog";
import RenameDialog from "./RenameDialog";
import Breadcrumb from "./Breadcrumb";
import FilePreviewSidebar from "./FilePreviewSidebar";
import FilePreviewModal from "./FilePreviewModal";
import type { StorageItem } from "../types";
import { downloadFileAsBlob } from "~/hooks/useBlobUrl";

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

  function toggleViewMode() {
    setViewMode((prev) => (prev === "list" ? "grid" : "list"));
  }

  const filteredFiles = items.filter((file) =>
    file.filename.toLowerCase().includes(searchText.toLowerCase()),
  );

  const handleFileClick = (item: StorageItem) => {
    // Toggle: click same file closes, click different file opens
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

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Main file list area */}
      <div className="flex-1 flex flex-col px-6 py-4 min-w-0 overflow-hidden">
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
