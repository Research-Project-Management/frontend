'use client';
import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTabsStore } from "@/features/editor/store/tabs.store";
import { logger } from "@/shared/lib/utils";
import { useEditorStorage } from '@/features/editor/hooks/use-storage';
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { usePageStore, type AssetInfo } from "@/features/editor/store/page.store";
import {
  pageQuery,
  filesQuery,
  usePageActions,
  useFileActions,
} from '@/features/editor/hooks/use-page';
import { useQuery } from '@tanstack/react-query';

import type { EditorStorageItem as StorageItem } from '@/features/editor/services/storage.service';

// GöÇGöÇ File icon helper GöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇ

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "tex":
    case "ltx":
    case "dtx":
      return { icon: FileCode2, color: "text-primary" };
    case "bib":
    case "bst":
      return { icon: BookText, color: "text-success" };
    case "cls":
    case "sty":
    case "ins":
      return { icon: Braces, color: "text-primary" };
    case "md":
    case "txt":
      return { icon: FileType, color: "text-muted-foreground" };
    default:
      return { icon: FileCode2, color: "text-muted-foreground" };
  }
}

import {
  IndentGuides,
  InlineInput,
  RenameInput,
  RowActions,
  StorageFolderNode,
  StorageFileRow,
} from "./FileTreeNodes";
import {
  UploadConflictDialog,
  TEX_EXTS,
  type PendingUploadItem as PendingItem,
} from "./UploadConflictDialog";


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

function parseOutline(content: any): OutlineEntry[] {
  const str = typeof content === 'string'
    ? content
    : content && typeof content === 'object'
      ? (content.source || content.text || content.content || '')
      : '';
  const entries: OutlineEntry[] = [];
  str.split("\n").forEach((rawLine: string, idx: number) => {
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
  } catch (err) {
    logger.debug('[FilesTab] Outline navigation lookup failed', { err });
  }

  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = (content.items as any[]).map((it) => it.str).join(" ");
      if (text.toLowerCase().includes(needle)) return i;
    } catch (err) {
      logger.debug('[FilesTab] Text content search failed for page', { page: i, err });
    }
  }

  return null;
}

// GöÇGöÇ Main FilesTab GöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇ

export default function FilesTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const setSearchParams = useCallback((newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (!v) params.delete(k);
      else params.set(k, v);
    });
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);
  const {
    currentPage,
    activeFilePage,
    editorRef,
    getEditorContent,
    pdfDocRef,
    gotoPageRef,
    setTexFiles,
    setSelectedAsset,
  } = usePageStore();
  const { openTab } = useTabsStore();

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
  const [pendingUploads, setPendingUploads] = useState<PendingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const dragCounterRef = useRef(0);

  // pageId from URL is always the project root page after the routing refactor.
  const parentPageId: string | null = pageId ?? null;

  const { data: parentPage, isLoading: parentPageLoading } = useQuery({
    ...pageQuery(parentPageId ?? ""),
    enabled: !!parentPageId,
  });

  // IMPORTANT: Use parentPageId (root page) as the key for fetching files
  // Each root page has its own independent file system
  // projectId is derived from parentPage for tab management
  const projectId = (parentPage?.projectId as any)?.id ?? "";
  const mainFileId =
    parentPage?.mainFile && typeof parentPage.mainFile === "object"
      ? parentPage.mainFile.id
      : ((parentPage?.mainFile as string | null | undefined) ?? null);



  // Derive workspaceId from parentPage.project.workspace for uploads
  const workspaceId: string =
    (parentPage?.projectId as any)?.workspaceId?.id ?? "";

  const { data: files, isLoading } = useQuery({
    ...filesQuery(parentPageId ?? ""),
    enabled: !!parentPageId,
  });

  useEffect(() => {
    if (!files) return;
    const names = files.map((f: any) => f.title);
    setTexFiles(names);
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
    activeFilePage?.id,
    activeFilePage?.content,
    currentPage?.content,
    editorRef,
    getEditorContent,
  ]);

  const { createFile: createFileMutation, setMainFile: setMainFileMutation } = useFileActions();
  const { deletePage: deletePageMutation, updateTitle: updateTitleMutation, updateContent: updateContentMutation } = usePageActions();

  // Storage files (images, pdfs, etc.) - FETCH BY PARENT PAGE ID, NOT PROJECT ID
  // Each root page has its own independent file system
  const {
    files: projectFiles,
    isLoading: projectFilesLoading,
    uploadFile,
    createFolder,
  } = useEditorStorage(parentPageId || null, undefined);

  // Automatic refetch handled by useQuery dependencies.

  // Log project files when loaded



  const queryClient = useQueryClient();

  const handleOpenPreview = useCallback(
    (item: StorageItem) => {
      const asset: AssetInfo = {
        id: item.id,
        filename: item.filename,
        url: item.url,
        mimeType: item.mimeType,
        size: item.size,
      };
      setSelectedAsset(asset);
      // Register the image as a tab and navigate to it via ?file=
      if (parentPageId)
        openTab(parentPageId, { id: item.id, title: item.filename, fileUrl: item.url });
      setSearchParams({ file: item.id });
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
    // Update only the ?file= query param GÇö pageId (project root) stays stable
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
    files?.forEach((f: any) => names.add(f.title.toLowerCase()));
    projectFiles?.forEach((f: any) => {
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

  /** Auto-generate a unique suffix name: file.tex GåÆ file_2.tex, file_3.tex GÇª */
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
    setPendingUploads(markDuplicates(picked.map((f: any) => ({ file: f, name: f.name }))));
    setUploadDialogOpen(true);
  };

  const handleFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    setPendingUploads(
      markDuplicates(
        picked.map((f: any) => ({ file: f, name: (f as any).webkitRelativePath || f.name })),
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
        onSuccess: (file: any) => {
          setIsCreatingFile(false);
          setNewFileName("");
          setSearchParams({ file: file.id });
        },
      },
    );
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!parentPageId || !projectId || !name) return;
    createFolder.mutate(
      { name, projectId, workspaceId, pageId: parentPageId },
      {
        onSuccess: () => {
          setIsCreatingFolder(false);
          setNewFolderName("");

        },
      },
    );
  };

  const handleStartRename = (file: { id: string; title: string }) => {
    setRenamingId(file.id);
    setRenameValue(file.title);
  };

  const handleCommitRename = (fileId: string) => {
    const title = sanitizeTitle(renameValue);
    if (!title) {
      setRenamingId(null);
      return;
    }
    // Look up the current title so backend can rename the file in the compiler.
    const oldTitle = files?.find((f: any) => f.id === fileId)?.title ?? "";
    updateTitleMutation.mutate(
      { pageId: fileId, title, oldTitle },
      { onSuccess: () => setRenamingId(null) },
    );
  };

  const handleDelete = (fileId: string) => {
    if (!parentPageId) return;
    deletePageMutation.mutate(
      fileId,
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
    if (pendingUploads.some((p) => p.conflict === "duplicate" && !p.resolution)) return;
    setUploadDialogOpen(false);

    const resolved = pendingUploads.map((p) => {
      if (p.conflict === "duplicate" && p.resolution === "suffix") {
        return { ...p, name: autoSuffix(p.name) };
      }
      return p;
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
        if (parentPageId) {
          queryClient.invalidateQueries({
            queryKey: ["project-files-editor", parentPageId],
            exact: false,
          });
        }
      }
    };

    let lastTexId: string | null = null;
    if (texFlat.length) {
      for (const { file, name, conflict, resolution } of texFlat) {
        try {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });

          if (conflict === "duplicate" && resolution === "overwrite") {
            const existingPage = files?.find(
              (f: any) => f.title.toLowerCase() === file.name.toLowerCase(),
            );
            if (existingPage) {
              await updateContentMutation.mutateAsync({
                pageId: existingPage.id,
                content,
              });
              lastTexId = existingPage.id;
              continue;
            }
          }

          const created = await createFileMutation.mutateAsync({
            parentPageId,
            title: name.trim() || file.name,
            content,
          });
          lastTexId = created.id;
        } catch (err) {
          console.error("Failed to upload tex:", err);
        } finally {
          onFileSettled();
        }
      }
      if (lastTexId) setSearchParams({ file: lastTexId });
    }

    if (assetFlat.length && projectId) {
      for (const { file, name } of assetFlat) {
        try {
          const renamedFile =
            name !== file.name
              ? new File([file], name, { type: file.type })
              : file;
          await uploadFile.mutateAsync({
            file: renamedFile,
            projectId,
            workspaceId,
            pageId: parentPageId,
          });
        } catch (err) {
          console.error("Failed to upload asset:", err);
        } finally {
          onFileSettled();
        }
      }
    }

    if (folderItems.length && projectId) {
      void (async () => {
        try {
          const assetFolderItems = folderItems.filter(p => !TEX_EXTS.has("." + (p.name.split(".").pop() ?? "").toLowerCase()));
          const folderPaths = new Set<string>();
          for (const { name } of assetFolderItems) {
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
            const parentId = parentPath ? folderIdMap[parentPath] : null;

            const created = await createFolder.mutateAsync({
              name: folderName,
              projectId,
              workspaceId,
              parentId: parentId ?? undefined,
              pageId: parentPageId,
            });
            const folderId = (created as any).folder?.id ?? (created as any).id;
            folderIdMap[folderPath] = folderId;
          }

          for (const { file, name, conflict, resolution } of folderItems) {
            const parts = name.split("/");
            const rawFileName = parts[parts.length - 1];
            const folderPath = parts.slice(0, -1).join("/");

            const effectiveFileName =
              conflict === "duplicate" && resolution === "suffix"
                ? autoSuffix(rawFileName)
                : rawFileName;

            const ext = "." + (rawFileName.split(".").pop() ?? "").toLowerCase();
            const isTex = TEX_EXTS.has(ext);

            if (isTex) {
              try {
                const content = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsText(file);
                });

                const fullTitle = folderPath ? `${folderPath}/${effectiveFileName}` : effectiveFileName;

                if (conflict === "duplicate" && resolution === "overwrite") {
                  const existingPage = files?.find(
                    (f: any) => f.title.toLowerCase() === fullTitle.toLowerCase(),
                  );
                  if (existingPage) {
                    await updateContentMutation.mutateAsync({
                      pageId: existingPage.id,
                      content,
                    });
                    continue;
                  }
                }
                await createFileMutation.mutateAsync({
                  parentPageId,
                  title: fullTitle,
                  content,
                });
              } catch (err) {
                console.error("Failed to upload folder tex:", err);
              } finally {
                onFileSettled();
              }
            } else {
              const parentId = folderPath ? folderIdMap[folderPath] : null;
              const fileToUpload =
                effectiveFileName !== file.name
                  ? new File([file], effectiveFileName, { type: file.type })
                  : file;
              try {
                await uploadFile.mutateAsync({
                  file: fileToUpload,
                  projectId,
                  workspaceId,
                  pageId: parentPageId,
                  parentId: parentId ?? undefined,
                });
              } catch (uploadErr) {
                console.error("Failed:", uploadErr);
              } finally {
                onFileSettled();
              }
            }
          }
        } catch (err) {
          console.error("Fatal error:", err);
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

      plainFiles.forEach((f: any) => allItems.push({ file: f, name: f.name }));

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

  const handleUploadToFolder = useCallback(
    (files: File[], folderId: string) => {
      if (!parentPageId) return;
      const tabProjectId = (parentPage?.projectId as any)?.id ?? "";
      setUploadingCount((prev) => prev + files.length);

      const settle = () =>
        setUploadingCount((prev) => Math.max(0, prev - 1));

      files.forEach((file) => {
        const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
        if (TEX_EXTS.has(ext)) {

          const reader = new FileReader();
          reader.onload = () => {
            createFileMutation.mutate(
              { parentPageId, title: file.name, content: reader.result as string },
              { onSettled: settle },
            );
          };
          reader.readAsText(file);
        } else {
          // Binary asset GÇö upload to R2
          uploadFile.mutate(
            { file, projectId: tabProjectId, workspaceId, pageId: parentPageId, parentId: folderId },
            { onSettled: settle },
          );
        }
      });
    },
    [parentPageId, workspaceId, uploadFile, createFileMutation, parentPage],
  );


  return (
    <>
      <div className="w-full h-full flex flex-col select-none text-sm">
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

        {/* GöÇGöÇ Header toolbar GöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇ */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-xs font-semibold text-muted-foreground">
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
                    className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer"
                  >
                    <Icon className="size-3.5 shrink-0" />
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
                    className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer"
                  >
                    <X className="size-3.5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Close</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* GöÇGöÇ File tree GöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇ */}
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
                <Upload className="size-5 text-primary shrink-0" />
              </div>
              <span className="text-xs font-medium text-primary">
                Drop files to upload
              </span>
            </div>
          )}

          {/* GöÇGöÇ Inline create inputs GöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇ */}
          {isCreatingFile && (
            <InlineInput
              icon={FileCode2}
              iconColor="text-primary"
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
              iconColor="text-warning"
              value={newFolderName}
              onChange={setNewFolderName}
              placeholder="folder name"
              onCommit={handleCreateFolder}
              onCancel={handleCancelCreateFolder}
              isPending={createFolder.isPending}
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
              <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                Uploading {uploadingCount} file{uploadingCount > 1 ? "s" : ""}GÇª
              </span>
            </div>
          )}

          {/* GöÇGöÇ UNIFIED FILE TREE GöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇGöÇ */}
          {!isLoading &&
            !projectFilesLoading &&
            (() => {
              type UnifiedItem =
                | { kind: "folder"; data: StorageItem }
                | { kind: "asset"; data: StorageItem }
                | {
                  kind: "tex";
                  data: { id: string; title: string; updatedAt: string };
                };

              const items: UnifiedItem[] = [];

              // Folders first
              projectFiles?.forEach((f: any) => {
                if (f.isFolder) items.push({ kind: "folder", data: f });
              });

              // Then tex files and non-tex files, sorted alphabetically
              const fileItems: UnifiedItem[] = [];
              files?.forEach((f: any) => fileItems.push({ kind: "tex", data: f }));
              projectFiles?.forEach((f: any) => {
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
                    <FileText className="size-6 opacity-20 shrink-0" />
                    <span className="text-xs text-center">
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
                      key={item.data.id}
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
                      key={item.data.id}
                      item={item.data}
                      depth={0}
                      onInsertAsset={handleInsertAsset}
                      onPreview={handleOpenPreview}
                    />
                  );
                }

                // kind === "tex"
                const file = item.data;
                const isActive = file.id === pageId;
                const isMain = file.id === mainFileId;
                const { icon: FileIcon, color: fileColor } = getFileIcon(
                  file.title,
                );
                return (
                  <div
                    key={file.id}
                    onClick={() => handleFileClick(file.id, file.title)}
                    className={cn(
                      "group/row flex h-8 cursor-pointer items-center border-l-2 pr-2 transition-colors",
                      isActive
                        ? "border-l-primary bg-muted text-primary"
                        : "border-l-transparent hover:bg-muted",
                    )}
                  >
                    <span className="w-4 shrink-0" />
                    <FileIcon
                      className={cn(
                        "size-3.5 shrink-0 mr-1.5",
                        isActive ? "text-primary" : fileColor,
                      )}
                    />

                    {renamingId === file.id ? (
                      <RenameInput
                        value={renameValue}
                        onChange={setRenameValue}
                        onCommit={() => handleCommitRename(file.id)}
                        onCancel={() => setRenamingId(null)}
                        isPending={updateTitleMutation.isPending}
                      />
                    ) : (
                      <>
                        <span
                          className={cn(
                            "flex-1 min-w-0 truncate text-sm",
                            isActive
                              ? "text-primary font-medium"
                              : "text-foreground/90",
                          )}
                        >
                          {displayName(file.title)}
                        </span>
                        {isMain && !renamingId && (
                          <span className="shrink-0 text-xs px-1.5 py-px rounded-full border border-primary/30 bg-primary/8 text-primary/80 font-medium mr-1">
                            main
                          </span>
                        )}
                        {renamingId !== file.id && (
                          <RowActions>
                            {!isMain && (
                              <DropdownMenuItem
                                className="text-xs!"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetMain(file.id);
                                }}
                              >
                                <Star className="size-3.5 mr-2 shrink-0" />
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
                              <Pencil className="size-3.5 mr-2 shrink-0" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-xs!"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(file.id);
                              }}
                            >
                              <Trash2 className="size-3.5 mr-2 shrink-0" />
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

        <div className="shrink-0 border-t border-border bg-card">
          <button
            type="button"
            onClick={() => setIsOutlineOpen((value) => !value)}
            className="flex h-8 w-full items-center gap-2 px-3 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted cursor-pointer"
          >
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 transition-transform",
                isOutlineOpen && "rotate-90",
              )}
            />
            <ListTree className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Outline</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {outline.length}
            </span>
          </button>
          {isOutlineOpen && (
            <div className="max-h-[42vh] overflow-y-auto pb-1">
              {outline.length === 0 ? (
                <div className="px-9 py-2 text-xs text-muted-foreground">
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
                      "flex h-7 w-full items-center gap-1.5 pr-2 text-left text-xs transition-colors hover:bg-muted cursor-pointer",
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
                    <span className="shrink-0 text-xs text-muted-foreground/60">
                      :{entry.line}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <UploadConflictDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUploadDialogOpen(false);
            setPendingUploads([]);
          }
        }}
        pendingUploads={pendingUploads}
        onRemoveItem={(i) =>
          setPendingUploads((prev) => prev.filter((_, j) => j !== i))
        }
        onSetResolution={(i, resolution) =>
          setPendingUploads((prev) =>
            prev.map((p, j) => (j === i ? { ...p, resolution } : p)),
          )
        }
        onCancel={() => {
          setUploadDialogOpen(false);
          setPendingUploads([]);
        }}
        onConfirm={handleConfirmUpload}
      />


    </>
  );
}
