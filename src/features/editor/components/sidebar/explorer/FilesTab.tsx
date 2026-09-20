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
import { toast } from "sonner";
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
  FileType,
  BookText,
  Braces,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import {
  createFileSchema,
  createFolderSchema,
  renameItemSchema,
} from "@/features/editor/schemas";
import { usePageStore, useTabsStore, useSettingsStore, type AssetInfo } from "@/features/editor/store";
import {
  pageQuery,
  filesQuery,
  usePageActions,
  useFileActions,
} from '@/features/editor/hooks/use-core';
import { useQuery } from '@tanstack/react-query';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

import type { EditorStorageItem as StorageItem } from '@/features/editor/services/storage.service';

// ── File icon helper ────────────────────────────────────────────────────────

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
import AddFilesModal, { type AddFilesTab } from "@/features/editor/components/modals/AddFilesModal";
import { parseDocumentOutline, OUTLINE_INDENT } from "@/features/editor/utils/pdf-outline.util";
import { parseZipArchive, extractAndImportZipToProject } from "@/features/editor/utils/import-zip.util";

const OUTLINE_COLORS: Record<number, string> = {
  0: "font-medium text-foreground",
  1: "text-foreground/90",
  2: "text-muted-foreground",
  3: "text-muted-foreground/80",
  4: "text-muted-foreground/70",
};

// ── Main FilesTab ───────────────────────────────────────────────────────────

const FilesTab = React.memo(function FilesTab({ onClose }: { onClose?: () => void }) {
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
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const setTexFiles = usePageStore((s) => s.setTexFiles);
  const setSelectedAsset = usePageStore((s) => s.setSelectedAsset);
  const editorRef = usePageStore((s) => s.editorRef);
  const scrollToLineRef = usePageStore((s) => s.scrollToLineRef);
  const openTab = useTabsStore((s) => s.openTab);

  const [isFileTreeOpen, setIsFileTreeOpen] = useState(true);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [outlineHeight, setOutlineHeight] = useState(200);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);

  const startResizeOutline = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    const startY = e.clientY;
    const startH = outlineHeight;

    const onMouseMove = (ev: MouseEvent) => {
      const deltaY = startY - ev.clientY;
      const newH = Math.min(Math.max(startH + deltaY, 80), 500);
      setOutlineHeight(newH);
    };

    const onMouseUp = () => {
      setIsDraggingSplitter(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [outlineHeight]);

  const docContent = currentPage?.content || "";
  const outline = useMemo(
    () => (isOutlineOpen ? parseDocumentOutline(docContent) : []),
    [docContent, isOutlineOpen],
  );

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
  const [isAddFilesModalOpen, setIsAddFilesModalOpen] = useState(false);
  const [addFilesTab, setAddFilesTab] = useState<AddFilesTab>('new-file');
  const [isDragging, setIsDragging] = useState(false);
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
  const projectId =
    (typeof parentPage?.projectId === "string"
      ? parentPage.projectId
      : (parentPage?.projectId as any)?.id) ||
    (typeof currentPage?.projectId === "string"
      ? currentPage.projectId
      : (currentPage?.projectId as any)?.id) ||
    "";
  const mainFileId =
    parentPage?.mainFile && typeof parentPage.mainFile === "object"
      ? parentPage.mainFile.id
      : ((parentPage?.mainFile as string | null | undefined) ?? null);

  const setMainFile = useSettingsStore((s) => s.setMainFile);




  const { data: files, isLoading } = useQuery({
    ...filesQuery(parentPageId ?? ""),
    enabled: !!parentPageId,
  });

  useEffect(() => {
    if (!files) return;
    const names = files.map((f: any) => f.title);
    setTexFiles(names);
  }, [files, setTexFiles]);

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

  const handleFileClick = useCallback(
    (fileId: string, title: string) => {
      // Don't re-open the already-active file
      const activeFileId = searchParams.get("file") ?? pageId;
      if (fileId === activeFileId) return;
      // Use parentPageId as the tab key (matches EditorLayout's rootPageId)
      if (parentPageId) openTab(parentPageId, { id: fileId, title });
      // Update only the ?file= query param — pageId (project root) stays stable
      setSearchParams({ file: fileId });
    },
    [searchParams, pageId, parentPageId, openTab, setSearchParams],
  );

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

  const handleOpenFileModal = () => {
    setAddFilesTab('new-file');
    setIsAddFilesModalOpen(true);
  };

  const handleOpenUploadModal = () => {
    setAddFilesTab('upload');
    setIsAddFilesModalOpen(true);
  };

  useEffect(() => {
    const unsubFile = EditorEventBus.on('flux:new-file', () => {
      setIsFileTreeOpen(true);
      handleOpenFileModal();
    });
    const unsubFolder = EditorEventBus.on('flux:new-folder', () => {
      setIsFileTreeOpen(true);
      handleStartCreateFolder();
    });
    const unsubUpload = EditorEventBus.on('flux:upload-file', () => {
      setIsFileTreeOpen(true);
      handleOpenUploadModal();
    });
    return () => {
      unsubFile();
      unsubFolder();
      unsubUpload();
    };
  }, []);

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
        const isZip = lower.endsWith('.zip');
        return {
          ...item,
          conflict: isDup ? "duplicate" : "none",
          unpackZip: isZip ? true : undefined,
        };
      });
    },
    [existingNames],
  );

  /** Auto-generate a unique suffix name: file.tex -> file_2.tex, file_3.tex ... */
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

  const handleAddFilesPick = useCallback(
    (items: { file: File; name: string }[]) => {
      setIsAddFilesModalOpen(false);
      setPendingUploads(markDuplicates(items));
      setUploadDialogOpen(true);
    },
    [markDuplicates],
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
    const parsed = createFileSchema.safeParse({ title });
    if (!parentPageId || !parsed.success) return;
    createFileMutation.mutate(
      { parentPageId, title: parsed.data.title },
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
    const parsed = createFolderSchema.safeParse({ name });
    if (!parentPageId || !projectId || !parsed.success) return;
    createFolder.mutate(
      { name: parsed.data.name, projectId, pageId: parentPageId },
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
    const parsed = renameItemSchema.safeParse({ name: title });
    if (!parsed.success) {
      setRenamingId(null);
      return;
    }
    // Look up the current title so backend can rename the file in the compiler.
    const oldTitle = files?.find((f: any) => f.id === fileId)?.title ?? "";
    updateTitleMutation.mutate(
      { pageId: fileId, title: parsed.data.name, oldTitle },
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
    const targetFile = files?.find((f: any) => f.id === fileId);
    if (targetFile) {
      const fileName = targetFile.title.endsWith('.tex') ? targetFile.title : `${targetFile.title}.tex`;
      setMainFile(fileName);
      toast.success(`Set ${fileName} as main document`);
    }
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

    const zipUnpackItems = uploads.filter(
      (p: PendingItem) => p.name.toLowerCase().endsWith(".zip") && p.unpackZip !== false,
    );
    const nonZipUploads = uploads.filter(
      (p: PendingItem) => !p.name.toLowerCase().endsWith(".zip") || p.unpackZip === false,
    );

    if (zipUnpackItems.length > 0 && parentPageId) {
      void (async () => {
        const tabProjectId =
          (typeof parentPage?.projectId === "string"
            ? parentPage.projectId
            : (parentPage?.projectId as any)?.id) ||
          projectId ||
          "";

        for (const zipItem of zipUnpackItems) {
          try {
            toast.loading(`Unpacking ${zipItem.file.name}...`, { id: `zip-${zipItem.name}` });
            const parsed = await parseZipArchive(zipItem.file);
            await extractAndImportZipToProject({
              extracted: parsed,
              projectId: tabProjectId,
              parentPageId,
            });
            toast.success(`Unpacked ${parsed.totalFiles} files from ${zipItem.file.name}`, {
              id: `zip-${zipItem.name}`,
            });
          } catch (err: any) {
            console.error("Failed to unpack zip:", err);
            toast.error(`Failed to unpack ${zipItem.file.name}: ${err?.message || "Unknown error"}`, {
              id: `zip-${zipItem.name}`,
            });
          }
        }
        queryClient.invalidateQueries({
          queryKey: ["project-files-editor", parentPageId],
          exact: false,
        });
        queryClient.invalidateQueries({
          queryKey: filesQuery(parentPageId).queryKey,
        });
      })();
    }

    const folderItems = nonZipUploads.filter((p) => p.name.includes("/"));
    const flatItems = nonZipUploads.filter((p) => !p.name.includes("/"));
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
          const beginDocIdx = lines.findIndex((l: string) =>
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
      const tabProjectId =
        (typeof parentPage?.projectId === "string"
          ? parentPage.projectId
          : (parentPage?.projectId as any)?.id) ||
        projectId ||
        "";
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
          // Binary asset – upload to R2
          uploadFile.mutate(
            { file, projectId: tabProjectId, pageId: parentPageId, parentId: folderId },
            { onSettled: settle },
          );
        }
      });
    },
    [parentPageId, uploadFile, createFileMutation, parentPage],
  );

  const handleOutlineClick = useCallback(
    (line: number, _title?: string) => {
      scrollToLineRef.current?.(line);
    },
    [scrollToLineRef],
  );

  return (
    <>
      <div className="w-full h-full flex flex-col select-none text-sm bg-background">
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

        {/* Header toolbar */}
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 bg-background select-none">
          <button
            type="button"
            onClick={() => setIsFileTreeOpen((prev) => !prev)}
            className="flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-foreground/80 cursor-pointer select-none"
            title={isFileTreeOpen ? "Collapse file tree" : "Expand file tree"}
            aria-label={isFileTreeOpen ? "Collapse file tree" : "Expand file tree"}
          >
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 transition-transform text-muted-foreground",
                isFileTreeOpen && "rotate-90",
              )}
            />
            <span>File tree</span>
          </button>
          {isFileTreeOpen && (
            <div className="flex items-center gap-0.5">
              {[
                { icon: FilePlus, label: "New File", action: handleOpenFileModal },
                {
                  icon: FolderPlus,
                  label: "New Folder",
                  action: handleStartCreateFolder,
                },
                { icon: Upload, label: "Upload Files", action: handleOpenUploadModal },
              ].map(({ icon: Icon, label, action }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={action}
                      aria-label={label}
                      className="flex size-7 items-center justify-center rounded text-foreground/80 transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                    >
                      <Icon className="size-3.5 shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </div>

        {/* ── File tree ──────────────────────────────────────────────────────── */}
        {isFileTreeOpen && (
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

          {/* ── Inline create inputs ────────────────────────────────────────── */}
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
                Uploading {uploadingCount} file{uploadingCount > 1 ? "s" : ""}…
              </span>
            </div>
          )}

          {/* ── UNIFIED FILE TREE ─────────────────────────────────────────── */}
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
                const activeId = activeFilePage?.id ?? (searchParams.get('fileId') || pageId);
                const isActive = file.id === activeId || file.id === pageId;
                const isMain = file.id === mainFileId;
                const { icon: FileIcon, color: fileColor } = getFileIcon(
                  file.title,
                );
                return (
                  <div
                    key={file.id}
                    onClick={() => handleFileClick(file.id, file.title)}
                    className={cn(
                      "group/row flex h-7.5 cursor-pointer items-center rounded-md mx-1 px-2 my-0.5 transition-colors select-none",
                      isActive
                        ? "bg-[#1b5e3a] dark:bg-[#1a5632] text-white shadow-2xs font-medium"
                        : "hover:bg-muted/70 text-foreground/90",
                    )}
                  >
                    <FileIcon
                      className={cn(
                        "size-3.5 shrink-0 mr-1.5",
                        isActive ? "text-white" : fileColor,
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
                            "flex-1 min-w-0 truncate text-xs",
                            isActive
                              ? "text-white font-medium"
                              : "text-foreground/90",
                          )}
                        >
                          {displayName(file.title)}
                        </span>
                        {isMain && !renamingId && (
                          <span
                            className={cn(
                              "shrink-0 text-[10px] px-1.5 py-px rounded-full font-medium mr-1",
                              isActive
                                ? "bg-white/20 text-white"
                                : "border border-primary/30 bg-primary/8 text-primary/80",
                            )}
                          >
                            main
                          </span>
                        )}
                        {renamingId !== file.id && (
                          <RowActions className={isActive ? "text-white/80 hover:text-white hover:bg-white/15 opacity-100" : undefined}>
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
        )}

        {/* Resizable Divider between File tree and File outline */}
        {isOutlineOpen && (
          <div
            onMouseDown={isFileTreeOpen ? startResizeOutline : undefined}
            className={cn(
              "h-2 w-full shrink-0 flex items-center justify-center border-t border-border hover:bg-muted/60 select-none group transition-colors",
              isFileTreeOpen ? "cursor-row-resize" : "cursor-default"
            )}
          >
            <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
              <span className="size-1 rounded-full bg-foreground/60" />
              <span className="size-1 rounded-full bg-foreground/60" />
              <span className="size-1 rounded-full bg-foreground/60" />
              <span className="size-1 rounded-full bg-foreground/60" />
            </div>
          </div>
        )}

        {/* ── File outline Accordion ────────────────────────────────────────── */}
        <div
          className={cn(
            "border-t border-border bg-background flex flex-col select-none",
            !isFileTreeOpen && isOutlineOpen ? "flex-1 min-h-0" : "shrink-0"
          )}
        >
          <button
            type="button"
            onClick={() => setIsOutlineOpen((value) => !value)}
            className="flex h-8 w-full items-center gap-1.5 px-3 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted/60 cursor-pointer select-none"
          >
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 transition-transform text-muted-foreground",
                isOutlineOpen && "rotate-90",
              )}
            />
            <span className="min-w-0 flex-1 truncate">File outline</span>
            {outline.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono font-medium text-muted-foreground">
                {outline.length}
              </span>
            )}
          </button>
          {isOutlineOpen && (
            <div
              style={isFileTreeOpen ? { height: `${outlineHeight}px` } : undefined}
              className={cn(
                "overflow-y-auto pb-1 border-t border-border/40",
                !isFileTreeOpen && "flex-1 min-h-0"
              )}
            >
              {outline.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center px-4 py-8 select-none">
                  <p className="text-xs text-foreground/80 font-medium">
                    We can&apos;t find any sections or subsections in this file.
                  </p>
                  <span className="text-[11px] text-primary hover:underline mt-1.5 cursor-pointer">
                    Find out more about the file outline
                  </span>
                </div>
              ) : (
                outline.map((entry, index) => (
                  <button
                    key={`${entry.line}-${index}`}
                    type="button"
                    onClick={() => handleOutlineClick(entry.line, entry.title)}
                    style={{
                      paddingLeft: `${24 + OUTLINE_INDENT[entry.level]}px`,
                    }}
                    className={cn(
                      "flex h-7 w-full items-center gap-1.5 pr-2 text-left text-xs transition-colors hover:bg-muted/70 cursor-pointer",
                      OUTLINE_COLORS[entry.level],
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "shrink-0 text-muted-foreground",
                        entry.level === 0 ? "size-3.5" : "size-3",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {entry.title}
                    </span>
                    <span className="shrink-0 text-[11px] font-mono text-muted-foreground">
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
        onToggleUnpackZip={(i, unpack) =>
          setPendingUploads((prev) =>
            prev.map((p, j) => (j === i ? { ...p, unpackZip: unpack } : p)),
          )
        }
        onCancel={() => {
          setUploadDialogOpen(false);
          setPendingUploads([]);
        }}
        onConfirm={handleConfirmUpload}
      />

      <AddFilesModal
        open={isAddFilesModalOpen}
        onOpenChange={setIsAddFilesModalOpen}
        defaultTab={addFilesTab}
        parentPageId={parentPageId}
        projectId={projectId}
        onPickItems={handleAddFilesPick}
      />


    </>
  );
});

export default FilesTab;
