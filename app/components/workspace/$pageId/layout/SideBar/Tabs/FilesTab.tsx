import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useParams, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
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
  ListTree,
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
import { usePageContext, type AssetInfo } from "../../PageContext";
import {
  usePageFiles,
  useCreatePageFile,
  useSetPageMainFile,
  useDeletePage,
  useUpdatePageTitle,
  useUpdatePageContent,
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
  const mime = item.mimeType ?? "";
  const ext = item.filename.split(".").pop()?.toLowerCase() ?? "";
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "svg", "webp", "eps"].includes(ext)
  )
    return { icon: Image, color: "text-amber-500" };
  if (ext === "pdf" || mime === "application/pdf")
    return { icon: FileText, color: "text-rose-500" };
  if (["bib", "bst"].includes(ext))
    return { icon: BookText, color: "text-emerald-500" };
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext))
    return { icon: Paperclip, color: "text-violet-400" };
  return { icon: Paperclip, color: "text-sky-500" };
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
    <div className="mx-2 flex h-8 items-center rounded-md border border-primary/30 bg-primary/5 pl-3 pr-2">
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
        className="min-w-0 flex-1 rounded-md border border-primary/40 bg-primary/5 px-1 text-[12px] text-foreground outline-none"
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
          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus:opacity-100 group-hover/row:opacity-100"
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

  // IMPORTANT: Log when folder is clicked and children are fetched
  // NOTE: projectId here is actually the parentPageId (root page ID)
  const { data: children, isLoading } = useProjectFilesEditor(
    projectId,
    expanded ? folder._id : undefined,
  );

  useEffect(() => {
    if (expanded && children !== undefined) {
      console.log("[StorageFolderNode] Folder expanded:", {
        folderId: folder._id,
        folderName: folder.filename,
        parentPageId: projectId,
        childrenCount: children?.length || 0,
      });
    }
  }, [expanded, children, folder._id, folder.filename, projectId]);

  const deleteFileMutation = useDeleteFileForEditor();
  const renameFileMutation = useRenameFileForEditor();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleClick = () => {
    console.log("[StorageFolderNode] Folder clicked:", {
      folderId: folder._id,
      folderName: folder.filename,
      parentPageId: projectId,
    });
    setExpanded(!expanded);
  };

  return (
    <>
      <div
        onClick={handleClick}
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
          "group/row flex h-8 cursor-pointer items-center border-l-2 border-l-transparent pr-2 transition-colors",
          dragOver
            ? "bg-primary/10 outline outline-1 outline-primary/30"
            : "hover:bg-accent/70",
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
              if (!n) {
                setRenamingId(null);
                return;
              }
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
            <span className="flex-1 min-w-0 truncate text-[13px] text-foreground/90">
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
              className="flex h-8 items-center"
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
              className="flex h-8 items-center text-[11px] italic text-muted-foreground/50"
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
      onClick={() => (isImage ? onPreview(item) : onInsertAsset(item.filename))}
      title={
        isImage
          ? `Click to preview ${item.filename}`
          : `Click to insert \\includegraphics{${item.filename}}`
      }
      className="group/row flex h-8 cursor-pointer items-center border-l-2 border-l-transparent pr-2 transition-colors hover:bg-accent/70"
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
            if (!n) {
              setRenamingId(null);
              return;
            }
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
          <span className="flex-1 min-w-0 truncate text-[13px] text-foreground/90">
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

type OutlineEntry = {
  level: number;
  title: string;
  line: number;
};

const SECTION_PATTERNS: { regex: RegExp; level: number }[] = [
  { regex: /^\\chapter\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 0 },
  { regex: /^\\section\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 0 },
  { regex: /^\\subsection\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 1 },
  { regex: /^\\subsubsection\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 2 },
  { regex: /^\\paragraph\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 3 },
];

const OUTLINE_INDENT = [0, 12, 24, 32];
const OUTLINE_COLORS = [
  "text-foreground font-medium",
  "text-foreground/80",
  "text-muted-foreground",
  "text-muted-foreground/70 italic",
];

function parseOutline(content: string): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  content.split("\n").forEach((rawLine, idx) => {
    const line = rawLine.trimStart();
    for (const { regex, level } of SECTION_PATTERNS) {
      const match = line.match(regex);
      if (match) {
        entries.push({ level, title: match[1].trim(), line: idx + 1 });
        break;
      }
    }
  });
  return entries;
}

function flattenPdfOutline(items: any[]): any[] {
  const result: any[] = [];
  for (const item of items) {
    result.push(item);
    if (item.items?.length) result.push(...flattenPdfOutline(item.items));
  }
  return result;
}

async function findPdfPageForTitle(
  doc: any,
  title: string,
): Promise<number | null> {
  const needle = title.toLowerCase().trim();

  try {
    const outline = await doc.getOutline();
    if (outline?.length) {
      for (const item of flattenPdfOutline(outline)) {
        if (item.title && item.title.toLowerCase().includes(needle)) {
          const dest = Array.isArray(item.dest)
            ? item.dest
            : await doc.getDestination(item.dest);
          if (dest) {
            const pageIndex = await doc.getPageIndex(dest[0]);
            return pageIndex + 1;
          }
        }
      }
    }
  } catch {}

  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = (content.items as any[]).map((it) => it.str).join(" ");
      if (text.toLowerCase().includes(needle)) return i;
    } catch {}
  }

  return null;
}

// ── Main FilesTab ───────────────────────────────────────────────────────────

export default function FilesTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentPage,
    activeFilePage,
    editorRef,
    getEditorContent,
    pdfDocRef,
    gotoPageRef,
    setTexFiles,
    setSelectedAsset,
  } = usePageContext();
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
  // Unified counter tracking total files still in flight.
  // Incremented for each file before upload starts; decremented via onSettled.
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  type PendingItem = {
    file: File;
    name: string; // effective upload name (may be suffix-renamed)
    conflict: "none" | "duplicate";
    resolution?: "suffix" | "overwrite"; // required when conflict === "duplicate"
  };
  const [pendingUploads, setPendingUploads] = useState<PendingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const dragCounterRef = useRef(0);

  // pageId from URL is always the project root page after the routing refactor.
  const parentPageId: string | null = pageId ?? null;

  const { data: parentPage, isLoading: parentPageLoading } = usePage(
    parentPageId ?? "",
  );

  // IMPORTANT: Use parentPageId (root page) as the key for fetching files
  // Each root page has its own independent file system
  // projectId is derived from parentPage for tab management
  const projectId = (parentPage?.project as any)?._id ?? "";
  const mainFileId =
    parentPage?.mainFile && typeof parentPage.mainFile === "object"
      ? parentPage.mainFile._id
      : ((parentPage?.mainFile as string | null | undefined) ?? null);

  console.log("[FilesTab] Current state:", {
    parentPageId,
    projectId,
    mainFileId,
    parentPageTitle: parentPage?.title,
    currentPageTitle: currentPage?.title,
  });

  // Derive workspaceId from parentPage.project.workspace for uploads
  const workspaceId: string =
    (parentPage?.project as any)?.workspace?._id ?? "";

  const { data: files, isLoading } = usePageFiles(parentPageId);

  useEffect(() => {
    if (!files) return;
    const names = files.map((f) => f.title);
    setTexFiles(names);
    console.log("[FilesTab] Page files updated:", names);
  }, [files, setTexFiles]);

  useEffect(() => {
    let disposed = false;
    let subscription: { dispose: () => void } | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const readInitialContent = () =>
      getEditorContent.current?.() ||
      editorRef.current?.getValue() ||
      activeFilePage?.content ||
      currentPage?.content ||
      "";

    const refreshOutline = () => {
      if (!disposed) setOutline(parseOutline(readInitialContent()));
    };

    const attachEditorListener = () => {
      refreshOutline();
      const editor = editorRef.current;
      if (!editor) return false;

      subscription?.dispose();
      subscription = editor.onDidChangeModelContent(() => {
        if (!disposed) setOutline(parseOutline(editor.getValue()));
      });
      return true;
    };

    if (!attachEditorListener()) {
      retryTimer = setInterval(() => {
        if (attachEditorListener() && retryTimer) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 250);
    }

    return () => {
      disposed = true;
      subscription?.dispose();
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [
    activeFilePage?._id,
    activeFilePage?.content,
    currentPage?.content,
    editorRef,
    getEditorContent,
  ]);

  const createFileMutation = useCreatePageFile();
  const setMainFileMutation = useSetPageMainFile();
  const deletePageMutation = useDeletePage();
  const updateTitleMutation = useUpdatePageTitle();
  const updateContentMutation = useUpdatePageContent();

  // Storage files (images, pdfs, etc.) - FETCH BY PARENT PAGE ID, NOT PROJECT ID
  // Each root page has its own independent file system
  const {
    data: projectFiles,
    isLoading: projectFilesLoading,
    refetch: refetchProjectFiles,
  } = useProjectFilesEditor(parentPageId || null, undefined);

  // Refetch project files when parentPageId changes
  useEffect(() => {
    if (parentPageId) {
      console.log("[FilesTab] Refetching files for page:", parentPageId);
      refetchProjectFiles();
    }
  }, [parentPageId, refetchProjectFiles]);

  // Log project files when loaded
  useEffect(() => {
    console.log(
      "[FilesTab] Storage files loaded:",
      projectFiles?.length || 0,
      "files for page:",
      parentPageId,
    );
  }, [projectFiles, parentPageId]);
  const uploadFileMutation = useUploadFileForEditor();
  const createFolderMutation = useCreateFolderForEditor();
  const queryClient = useQueryClient();

  const handleOpenPreview = useCallback(
    (item: StorageItem) => {
      const asset: AssetInfo = {
        _id: item._id,
        filename: item.filename,
        url: item.url,
        mimeType: item.mimeType,
        size: item.size,
      };
      setSelectedAsset(asset);
      // Register the image as a tab and navigate to it via ?file=
      if (parentPageId)
        openTab(parentPageId, { id: item._id, title: item.filename });
      setSearchParams({ file: item._id });
    },
    [parentPageId, openTab, setSearchParams, setSelectedAsset],
  );

  const handleOutlineClick = useCallback(
    async (line: number, title: string) => {
      const editor = editorRef.current;
      if (editor) {
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
      }

      const doc = pdfDocRef.current;
      const scrollToPage = gotoPageRef.current;
      if (!doc || !scrollToPage) return;

      const page = await findPdfPageForTitle(doc, title);
      if (page !== null) scrollToPage(page);
    },
    [editorRef, gotoPageRef, pdfDocRef],
  );

  const handleFileClick = (fileId: string, title: string) => {
    // Don't re-open the already-active file
    const activeFileId = searchParams.get("file") ?? pageId;
    if (fileId === activeFileId) return;
    // Use parentPageId as the tab key (matches EditorLayout's rootPageId)
    if (parentPageId) openTab(parentPageId, { id: fileId, title });
    // Update only the ?file= query param — pageId (project root) stays stable
    setSearchParams({ file: fileId });
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

  // Build a set of existing file names for duplicate detection (case-insensitive)
  const existingNames = useMemo(() => {
    const names = new Set<string>();
    files?.forEach((f) => names.add(f.title.toLowerCase()));
    projectFiles?.forEach((f) => {
      if (!f.isFolder) names.add(f.filename.toLowerCase());
    });
    return names;
  }, [files, projectFiles]);

  /** Mark each item as duplicate or not; within-batch duplicates also flagged. */
  const markDuplicates = useCallback(
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

  /** Auto-generate a unique suffix name: file.tex → file_2.tex, file_3.tex … */
  const autoSuffix = useCallback(
    (name: string): string => {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 2;
      let candidate = `${base}_${n}${ext}`;
      while (existingNames.has(candidate.toLowerCase())) {
        n++;
        candidate = `${base}_${n}${ext}`;
      }
      return candidate;
    },
    [existingNames],
  );

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    setPendingUploads(markDuplicates(picked.map((f) => ({ file: f, name: f.name }))));
    setUploadDialogOpen(true);
  };

  const handleFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    setPendingUploads(
      markDuplicates(
        picked.map((f) => ({ file: f, name: (f as any).webkitRelativePath || f.name })),
      ),
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
          setSearchParams({ file: file._id });
        },
      },
    );
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!parentPageId || !projectId || !name) return;
    createFolderMutation.mutate(
      { name, projectId, workspaceId, parentPageId },
      {
        onSuccess: () => {
          setIsCreatingFolder(false);
          setNewFolderName("");
          // Refetch files after creating folder
          refetchProjectFiles();
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
    // Look up the current title so backend can rename the file in the compiler.
    const oldTitle = files?.find((f) => f._id === fileId)?.title ?? "";
    updateTitleMutation.mutate(
      { pageId: fileId, title, oldTitle },
      { onSuccess: () => setRenamingId(null) },
    );
  };

  const handleDelete = (fileId: string) => {
    if (!parentPageId) return;
    deletePageMutation.mutate(
      { pageId: fileId, projectId: projectId },
      {
        onSuccess: () => {
          // If the deleted file was the active one, fall back to root page
          const activeFileId = searchParams.get("file") ?? pageId;
          if (fileId === activeFileId) setSearchParams({});
        },
      },
    );
  };

  const handleSetMain = (fileId: string) => {
    if (!parentPageId) return;
    setMainFileMutation.mutate({ pageId: parentPageId, fileId });
  };



  const handleConfirmUpload = async () => {
    if (!parentPageId || !pendingUploads.length) return;
    // Block if any conflict still unresolved
    if (pendingUploads.some((p) => p.conflict === "duplicate" && !p.resolution)) return;
    setUploadDialogOpen(false);

    // Resolve effective names: suffix → renamed, overwrite → original name
    const resolved = pendingUploads.map((p) => {
      if (p.conflict === "duplicate" && p.resolution === "suffix") {
        return { ...p, name: autoSuffix(p.name) };
      }
      return p; // "overwrite" or "none" keep original name
    });

    const uploads = resolved;
    setPendingUploads([]);

    const folderItems = uploads.filter((p) => p.name.includes("/"));
    const flatItems = uploads.filter((p) => !p.name.includes("/"));
    const texFlat = flatItems.filter(({ name }) =>
      TEX_EXTS.has("." + (name.split(".").pop() ?? "").toLowerCase()),
    );
    const assetFlat = flatItems.filter(
      ({ name }) =>
        !TEX_EXTS.has("." + (name.split(".").pop() ?? "").toLowerCase()),
    );

    const totalFiles = texFlat.length + assetFlat.length + folderItems.length;
    if (totalFiles === 0) return;

    let remaining = totalFiles;
    setUploadingCount(totalFiles);

    const onFileSettled = () => {
      remaining = Math.max(0, remaining - 1);
      setUploadingCount(remaining);
      if (remaining === 0) {
        refetchProjectFiles();
        // Invalidate ALL sub-folder queries so expanded folder nodes refresh
        if (parentPageId) {
          queryClient.invalidateQueries({
            queryKey: ["project-files-editor", parentPageId],
            exact: false,
          });
        }
      }
    };

    // ── Tex files ────────────────────────────────────────────────────────────
    let lastTexId: string | null = null;
    let texDone = 0;
    if (texFlat.length) {
      texFlat.forEach(({ file, name, conflict, resolution }) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (conflict === "duplicate" && resolution === "overwrite") {
            // Find the existing page and overwrite its content via PUT
            const existingPage = files?.find(
              (f) => f.title.toLowerCase() === file.name.toLowerCase(),
            );
            if (existingPage) {
              updateContentMutation.mutate(
                { pageId: existingPage._id, content: reader.result as string },
                {
                  onSuccess: () => { lastTexId = existingPage._id; },
                  onSettled: () => {
                    texDone++;
                    if (texDone === texFlat.length && lastTexId) setSearchParams({ file: lastTexId });
                    onFileSettled();
                  },
                },
              );
              return;
            }
          }
          // Default: create new (suffix or no-conflict)
          createFileMutation.mutate(
            { parentPageId, title: name.trim() || file.name, content: reader.result as string },
            {
              onSuccess: (f) => { lastTexId = f._id; },
              onSettled: () => {
                texDone++;
                if (texDone === texFlat.length && lastTexId) setSearchParams({ file: lastTexId });
                onFileSettled();
              },
            },
          );
        };
        reader.readAsText(file);
      });
    }

    // ── Flat non-tex assets ──────────────────────────────────────────────────
    // Overwrite is handled transparently by the backend upsert.
    if (assetFlat.length && projectId) {
      assetFlat.forEach(({ file, name }) => {
        const renamedFile =
          name !== file.name
            ? new File([file], name, { type: file.type })
            : file;
        uploadFileMutation.mutate(
          { file: renamedFile, projectId, workspaceId, parentPageId },
          { onSettled: onFileSettled },
        );
      });
    }

    // ── Folder items (path like "folder/sub/file.png" or "folder/main.tex") ──
    // Must run AFTER flat uploads since they share the same onFileSettled counter.
    if (folderItems.length && projectId) {
      void (async () => {
        try {
          // 1. Collect all unique folder paths we need to pre-create
          const folderPaths = new Set<string>();
          for (const { name } of folderItems) {
            const parts = name.split("/");
            // parts[0..n-2] are folder segments; the last part is the filename
            for (let i = 1; i < parts.length; i++) {
              folderPaths.add(parts.slice(0, i).join("/"));
            }
          }

          // 2. Create folders serially (parent before child, ensured by sort)
          const sortedPaths = Array.from(folderPaths).sort();
          const folderIdMap: Record<string, string> = {};

          for (const folderPath of sortedPaths) {
            const parts = folderPath.split("/");
            const folderName = parts[parts.length - 1];
            const parentPath = parts.slice(0, -1).join("/"); // "" for root folders
            const parentId = parentPath ? folderIdMap[parentPath] : null;

            const created = await createFolderMutation.mutateAsync({
              name: folderName,
              projectId,
              workspaceId,
              parentId: parentId ?? undefined,
              parentPageId,
            });
            // Backend returns { folder: { _id, ... } }
            const folderId = (created as any).folder?._id ?? (created as any)._id;
            folderIdMap[folderPath] = folderId;
            console.log(`[folder-upload] created folder "${folderPath}" → id=${folderId}`);
          }
          console.log("[folder-upload] folderIdMap:", folderIdMap);

          // 3. Upload each file under its correct folder
          for (const { file, name, conflict, resolution } of folderItems) {
            const parts = name.split("/");
            const rawFileName = parts[parts.length - 1];
            const folderPath = parts.slice(0, -1).join("/");
            const parentId = folderPath ? folderIdMap[folderPath] : null;
            console.log(`[folder-upload] file "${rawFileName}" → folderPath="${folderPath}" parentId=${parentId}`);

            // Effective filename after suffix resolution
            const effectiveFileName =
              conflict === "duplicate" && resolution === "suffix"
                ? autoSuffix(rawFileName)
                : rawFileName;

            const ext = "." + (rawFileName.split(".").pop() ?? "").toLowerCase();
            const isTex = TEX_EXTS.has(ext);

            if (isTex) {
              // Read as text and create a PageModel child file
              await new Promise<void>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                  if (conflict === "duplicate" && resolution === "overwrite") {
                    const existingPage = files?.find(
                      (f) => f.title.toLowerCase() === rawFileName.toLowerCase(),
                    );
                    if (existingPage) {
                      updateContentMutation.mutate(
                        { pageId: existingPage._id, content: reader.result as string },
                        { onSettled: () => { onFileSettled(); resolve(); } },
                      );
                      return;
                    }
                  }
                  createFileMutation.mutate(
                    { parentPageId, title: effectiveFileName, content: reader.result as string },
                    { onSettled: () => { onFileSettled(); resolve(); } },
                  );
                };
                reader.readAsText(file);
              });
            } else {
              // Binary asset — upload to R2 + save FileModel
              const uploadFile =
                effectiveFileName !== file.name
                  ? new File([file], effectiveFileName, { type: file.type })
                  : file;
              try {
                await uploadFileMutation.mutateAsync({
                  file: uploadFile,
                  projectId,
                  workspaceId,
                  parentPageId,
                  parentId: parentId ?? undefined,
                });
                console.log(`[folder-upload] ✓ uploaded "${effectiveFileName}" → parentId=${parentId}`);
              } catch (uploadErr: any) {
                console.error(`[folder-upload] ✗ failed "${effectiveFileName}":`, uploadErr?.message ?? uploadErr);
              } finally {
                onFileSettled();
              }
            }
          }
        } catch (err) {
          console.error("[folder-upload] fatal:", err);
          for (let i = 0; i < folderItems.length; i++) onFileSettled();
        }
      })();
    }

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
        setPendingUploads(markDuplicates(allItems));
        setUploadDialogOpen(true);
      }
    },
    [parentPageId, readEntriesRecursively, markDuplicates],
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
      if (!parentPageId) return;
      const tabProjectId = (parentPage?.project as any)?._id ?? "";
      setUploadingCount((prev) => prev + files.length);

      const settle = () =>
        setUploadingCount((prev) => Math.max(0, prev - 1));

      files.forEach((file) => {
        const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
        if (TEX_EXTS.has(ext)) {
          // Tex file dropped into a folder — create as PageModel child
          const reader = new FileReader();
          reader.onload = () => {
            createFileMutation.mutate(
              { parentPageId, title: file.name, content: reader.result as string },
              { onSettled: settle },
            );
          };
          reader.readAsText(file);
        } else {
          // Binary asset — upload to R2
          uploadFileMutation.mutate(
            { file, projectId: tabProjectId, workspaceId, parentPageId, parentId: folderId },
            { onSettled: settle },
          );
        }
      });
    },
    [parentPageId, workspaceId, uploadFileMutation, createFileMutation, parentPage],
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
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Explorer
          </span>
          <div className="flex items-center gap-0.5">
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
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
          className="relative min-h-0 flex-1 overflow-y-auto"
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
                <div key={i} className="flex h-8 items-center gap-2 px-5">
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
          {uploadingCount > 0 && (
            <div className="flex h-8 items-center gap-2 px-5">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                Uploading {uploadingCount} file{uploadingCount > 1 ? "s" : ""}…
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
                const nameA = a.kind === "tex" ? a.data.title : a.data.filename;
                const nameB = b.kind === "tex" ? b.data.title : b.data.filename;
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
                      projectId={parentPageId || ""}
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
                      "group/row flex h-8 cursor-pointer items-center border-l-2 pr-2 transition-colors",
                      isActive
                        ? "border-l-primary bg-accent text-primary"
                        : "border-l-transparent hover:bg-accent/70",
                    )}
                  >
                    <span className="w-4 shrink-0" />
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
                            "flex-1 min-w-0 truncate text-[13px]",
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

        <div className="shrink-0 border-t border-border/70 bg-card">
          <button
            type="button"
            onClick={() => setIsOutlineOpen((value) => !value)}
            className="flex h-8 w-full items-center gap-2 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 transition-transform",
                isOutlineOpen && "rotate-90",
              )}
            />
            <ListTree className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Outline</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {outline.length}
            </span>
          </button>
          {isOutlineOpen && (
            <div className="max-h-[42vh] overflow-y-auto pb-1">
              {outline.length === 0 ? (
                <div className="px-9 py-2 text-[11px] text-muted-foreground">
                  No sections found.
                </div>
              ) : (
                outline.map((entry, index) => (
                  <button
                    key={`${entry.line}-${index}`}
                    type="button"
                    onClick={() => handleOutlineClick(entry.line, entry.title)}
                    style={{
                      paddingLeft: `${28 + OUTLINE_INDENT[entry.level]}px`,
                    }}
                    className={cn(
                      "flex h-7 w-full items-center gap-1.5 pr-2 text-left text-xs transition-colors hover:bg-accent/70",
                      OUTLINE_COLORS[entry.level],
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "shrink-0 text-muted-foreground/60",
                        entry.level === 0 ? "size-3.5" : "size-3",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {entry.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground/60">
                      :{entry.line}
                    </span>
                  </button>
                ))
              )}
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
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto overflow-x-hidden py-1">
            {pendingUploads.map((item, i) => {
              const ext = "." + (item.file.name.split(".").pop() ?? "").toLowerCase();
              const isTex = TEX_EXTS.has(ext);
              const isImg = item.file.type.startsWith("image/");
              const hasPath = item.name.includes("/");
              const folderPath = hasPath
                ? item.name.substring(0, item.name.lastIndexOf("/"))
                : null;
              const Icon = isTex ? FileCode2 : isImg ? Image : Paperclip;
              const isDuplicate = item.conflict === "duplicate";
              return (
                <div key={i} className="flex flex-col gap-1 px-1 py-1.5 rounded">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        isDuplicate ? "text-amber-500" : "text-muted-foreground",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      {folderPath && (
                        <div className="flex items-center gap-1 min-w-0">
                          <Folder className="size-3 text-amber-500 shrink-0" />
                          <span className="text-[10px] text-muted-foreground truncate">{folderPath}</span>
                        </div>
                      )}
                      <span className="text-xs text-foreground truncate block">{item.file.name}</span>
                    </div>
                    <button
                      onClick={() => setPendingUploads((prev) => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  {/* Conflict resolution — only shown for duplicates */}
                  {isDuplicate && (
                    <div className="ml-5 flex items-center gap-1.5">
                      <span className="text-[10px] text-amber-600 flex items-center gap-1 mr-1">
                        <AlertTriangle className="size-2.5" />
                        Already exists
                      </span>
                      <button
                        onClick={() =>
                          setPendingUploads((prev) =>
                            prev.map((p, j) => j === i ? { ...p, resolution: "overwrite" } : p),
                          )
                        }
                        className={cn(
                          "h-5 px-2 rounded text-[10px] border transition-colors",
                          item.resolution === "overwrite"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        Overwrite
                      </button>
                      <button
                        onClick={() =>
                          setPendingUploads((prev) =>
                            prev.map((p, j) => j === i ? { ...p, resolution: "suffix" } : p),
                          )
                        }
                        className={cn(
                          "h-5 px-2 rounded text-[10px] border transition-colors",
                          item.resolution === "suffix"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        Add suffix
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {pendingUploads.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No files selected.
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setUploadDialogOpen(false);
                setPendingUploads([]);
              }}
              className="h-8 rounded-md px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUpload}
              disabled={
                pendingUploads.length === 0 ||
                pendingUploads.some((p) => p.conflict === "duplicate" && !p.resolution)
              }
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingUploads.some((p) => p.conflict === "duplicate" && !p.resolution)
                ? "Resolve conflicts first"
                : `Upload ${
                  pendingUploads.length > 0
                    ? `${pendingUploads.length} file${pendingUploads.length > 1 ? "s" : ""}`
                    : ""
                }`}
            </button>
          </div>
        </DialogContent>
      </Dialog>


    </>
  );
}
