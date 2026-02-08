// Shared components for storage pages to avoid code duplication
import {
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Folder,
  MoreVertical,
  Download,
  Trash2,
  Star,
  FolderOpen,
  RotateCcw,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import type { StorageItem, FileType } from "../types";

export function getFileType(item: StorageItem): FileType {
  if (item.isFolder) return "folder";

  const mimeType = item.mimeType || "";
  if (mimeType.startsWith("image/")) return "image";

  // Fallback to extension check
  const ext = item.filename.split(".").pop()?.toLowerCase();
  if (
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "bmp",
      "ico",
      "tif",
      "tiff",
    ].includes(ext || "")
  ) {
    return "image";
  }

  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  )
    return "document";
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar")
  )
    return "archive";
  return "other";
}

export function getFileIcon(type: FileType, size: number = 20) {
  const className = `size-${size}`;
  switch (type) {
    case "folder":
      return <Folder className={className} />;
    case "document":
      return <FileText className={className} />;
    case "image":
      return <Image className={className} />;
    case "video":
      return <Video className={className} />;
    case "audio":
      return <Music className={className} />;
    case "archive":
      return <Archive className={className} />;
    default:
      return <File className={className} />;
  }
}

export function getFileColor(type: FileType): string {
  switch (type) {
    case "folder":
      return "text-blue-500";
    case "document":
      return "text-red-500";
    case "image":
      return "text-green-500";
    case "video":
      return "text-purple-500";
    case "audio":
      return "text-pink-500";
    case "archive":
      return "text-orange-500";
    default:
      return "text-gray-500";
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString();
}

type ItemActionsProps = {
  item: StorageItem;
  onToggleStar: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onDownload: (item: StorageItem) => void;
  onRename?: (item: StorageItem) => void;
  isTrash?: boolean;
};

function ItemActions({
  item,
  onToggleStar,
  onDelete,
  onDownload,
  onRename,
  isTrash,
}: ItemActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!item.isFolder && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDownload(item);
            }}
          >
            <Download className="size-4 mr-2" />
            Download
          </DropdownMenuItem>
        )}
        {isTrash ? (
          <>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(item._id);
              }}
            >
              <RotateCcw className="size-4 mr-2" />
              Restore
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item._id);
              }}
              variant="destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Delete Permanently
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRename?.(item);
              }}
            >
              <Pencil className="size-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(item._id);
              }}
            >
              <Star className="size-4 mr-2" />
              {item.starred ? "Unstar" : "Star"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item._id);
              }}
              variant="destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type StorageViewProps = {
  items: StorageItem[];
  onToggleStar: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onDownload: (item: StorageItem) => void;
  onFolderClick?: (folder: StorageItem) => void;
  onFileClick?: (file: StorageItem) => void;
  onRename?: (item: StorageItem) => void;
  isTrash?: boolean;
};

export function StorageListView({
  items,
  onToggleStar,
  onDelete,
  onDownload,
  onFolderClick,
  onFileClick,
  onRename,
  isTrash,
}: StorageViewProps) {
  return (
    <div className="rounded-lg overflow-hidden">
      {/* Header - Google Drive style */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
        <div className="col-span-5">Name</div>
        <div className="col-span-3">Last modified</div>
        <div className="col-span-2">File size</div>
        <div className="col-span-2"></div>
      </div>

      {items.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <Folder className="size-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No files or folders</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {items.map((item) => {
            const fileType = getFileType(item);
            return (
              <div
                key={item._id}
                className="grid grid-cols-12 gap-4 items-center px-4 py-2.5 hover:bg-muted/50 cursor-pointer group transition-colors"
                onClick={() => {
                  if (item.isFolder) {
                    onFolderClick?.(item);
                  } else {
                    onFileClick?.(item);
                  }
                }}
              >
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div
                    className={`flex items-center justify-center shrink-0 ${!(item.thumbnail || (fileType === "image" && item.url)) ? getFileColor(fileType) : ""}`}
                  >
                    {item.thumbnail || (fileType === "image" && item.url) ? (
                      <img
                        src={item.thumbnail || item.url}
                        alt={item.filename}
                        className="size-5 rounded object-cover"
                      />
                    ) : (
                      getFileIcon(fileType, 5)
                    )}
                  </div>
                  <span className="text-sm truncate">{item.filename}</span>
                  {item.starred && (
                    <Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0" />
                  )}
                </div>

                <div className="col-span-3 text-xs text-muted-foreground">
                  {formatDate(item.updatedAt)}
                </div>

                <div className="col-span-2 text-xs text-muted-foreground">
                  {item.isFolder ? "—" : formatFileSize(item.size)}
                </div>

                <div className="col-span-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <ItemActions
                    item={item}
                    onToggleStar={onToggleStar}
                    onDelete={onDelete}
                    onDownload={onDownload}
                    onRename={onRename}
                    isTrash={isTrash}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StorageGridView({
  items,
  onToggleStar,
  onDelete,
  onDownload,
  onFolderClick,
  onFileClick,
  onRename,
  isTrash,
}: StorageViewProps) {
  if (items.length === 0) {
    return (
      <div className="p-16 text-center text-muted-foreground">
        <Folder className="size-16 mx-auto mb-4 opacity-20" />
        <p className="text-sm">No files or folders</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {items.map((item) => {
        const fileType = getFileType(item);
        return (
          <div
            key={item._id}
            className="group bg-card border border-border/50 rounded-lg overflow-hidden hover:border-border hover:bg-muted/30 transition-all cursor-pointer"
            onClick={() => {
              if (item.isFolder) {
                onFolderClick?.(item);
              } else {
                onFileClick?.(item);
              }
            }}
          >
            <div
              className={`h-32 flex items-center justify-center ${item.isFolder ? "bg-blue-50 dark:bg-blue-950/20" : "bg-muted/30"} overflow-hidden relative`}
            >
              {item.thumbnail || (fileType === "image" && item.url) ? (
                <img
                  src={item.thumbnail || item.url}
                  alt={item.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={getFileColor(fileType)}>
                  {item.isFolder ? (
                    <Folder className="size-12" />
                  ) : (
                    getFileIcon(fileType, 12)
                  )}
                </div>
              )}

              {/* Overlay actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-background/80 backdrop-blur-sm rounded-md">
                  <ItemActions
                    item={item}
                    onToggleStar={onToggleStar}
                    onDelete={onDelete}
                    onDownload={onDownload}
                    onRename={onRename}
                    isTrash={isTrash}
                  />
                </div>
              </div>
            </div>

            <div className="px-3 py-2.5">
              <div className="flex items-start gap-2 mb-1">
                <h3 className="text-sm truncate flex-1" title={item.filename}>
                  {item.filename}
                </h3>
                {item.starred && (
                  <Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0 mt-0.5" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.isFolder ? "Folder" : formatFileSize(item.size)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
