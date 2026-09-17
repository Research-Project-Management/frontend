'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  FileText,
  Upload,
  Folder,
  Globe,
  BookOpen,
  Loader2,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Input,
  Checkbox,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useFileActions } from '@/features/editor/hooks/use-core';
import { useEditorStorage } from '@/features/editor/hooks/use-storage';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { PageService } from '@/features/projects/project-id/pages/services/page.service';
import { pageService } from '@/features/editor/services/core.service';
import { useViewItems } from '@/features/library/hooks/use-items';
import { formatItemToBibtex } from '@/features/editor/utils/citation.util';
import type { Item } from '@/features/library/types/library.types';

export type AddFilesTab = 'new-file' | 'upload' | 'project' | 'url' | 'library';

interface AddFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: AddFilesTab;
  parentPageId: string | null;
  projectId?: string;
  onPickItems?: (items: { file: File; name: string }[]) => void;
}

// ── Directory drag & drop entry reader ──────────────────────────────────────
async function readEntriesRecursively(
  dirEntry: FileSystemDirectoryEntry,
  basePath: string,
): Promise<{ file: File; relativePath: string }[]> {
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
}

export default function AddFilesModal({
  open,
  onOpenChange,
  defaultTab = 'new-file',
  parentPageId,
  projectId = '',
  onPickItems,
}: AddFilesModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const setSearchParams = useCallback(
    (newParams: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([k, v]) => {
        if (!v) params.delete(k);
        else params.set(k, v);
      });
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const [activeTab, setActiveTab] = useState<AddFilesTab>(defaultTab);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  const { createFile } = useFileActions();
  const { uploadFile } = useEditorStorage(parentPageId, undefined);

  // ── 1. New File State ─────────────────────────────────────────────────────
  const [newFileName, setNewFileName] = useState('');
  const [isCreatingNewFile, setIsCreatingNewFile] = useState(false);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && activeTab === 'new-file') {
      const timer = setTimeout(() => newFileInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open, activeTab]);

  const handleCreateNewFile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = newFileName.trim();
    if (!raw || !parentPageId) return;

    const title = /\.[a-z0-9]+$/i.test(raw) ? raw : `${raw}.tex`;
    setIsCreatingNewFile(true);
    try {
      const created = await createFile.mutateAsync({
        parentPageId,
        title,
        content: '',
      });
      toast.success(`Created ${title}`);
      setSearchParams({ file: created.id });
      setNewFileName('');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create file');
    } finally {
      setIsCreatingNewFile(false);
    }
  };

  // ── 2. Upload State & Handlers ────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleNativeFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    onOpenChange(false);
    onPickItems?.(picked.map((f) => ({ file: f, name: f.name })));
  };

  const handleNativeFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    onOpenChange(false);
    onPickItems?.(
      picked.map((f) => ({
        file: f,
        name: (f as any).webkitRelativePath || f.name,
      })),
    );
  };

  const handleModalDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
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
      onOpenChange(false);
      onPickItems?.(allItems);
    }
  };

  // ── 3. From Another Project State ─────────────────────────────────────────
  const { projects: allProjects = [], isLoading: isLoadingProjects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [projectTargetName, setProjectTargetName] = useState<string>('');
  const [isCopyingFromProject, setIsCopyingFromProject] = useState(false);

  const availableProjects = useMemo(() => {
    return allProjects.filter((p: any) => p.id !== projectId);
  }, [allProjects, projectId]);

  const {
    data: otherProjectPages = [],
    isLoading: isLoadingOtherPages,
  } = useQuery({
    queryKey: ['project-pages-for-copy', selectedProjectId],
    queryFn: () => PageService.getProjectPages(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const handleCopyFromProject = async () => {
    if (!parentPageId || !selectedFileId || !projectTargetName.trim()) return;
    setIsCopyingFromProject(true);
    try {
      const sourcePage = await pageService.getById(selectedFileId);
      const rawContent = sourcePage?.content;
      const contentStr = typeof rawContent === 'string'
        ? rawContent
        : (rawContent as any)?.text || (rawContent as any)?.content || '';
      const created = await createFile.mutateAsync({
        parentPageId,
        title: projectTargetName.trim(),
        content: contentStr,
      });
      toast.success(`Copied ${projectTargetName} into this project`);
      setSearchParams({ file: created.id });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to copy file from project');
    } finally {
      setIsCopyingFromProject(false);
    }
  };

  // ── 4. From External URL State ────────────────────────────────────────────
  const [fetchUrl, setFetchUrl] = useState('');
  const [urlFileName, setUrlFileName] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const handleUrlChange = (val: string) => {
    setFetchUrl(val);
    try {
      const urlObj = new URL(val);
      const cleanPath = urlObj.pathname.split('/').filter(Boolean).pop();
      if (cleanPath && !urlFileName) {
        setUrlFileName(decodeURIComponent(cleanPath));
      }
    } catch {
      // not valid full URL yet
    }
  };

  const handleFetchFromUrl = async () => {
    const rawUrl = fetchUrl.trim();
    if (!rawUrl || !parentPageId) return;

    let targetName = urlFileName.trim();
    if (!targetName) {
      try {
        const u = new URL(rawUrl);
        targetName = u.pathname.split('/').pop() || 'downloaded.tex';
      } catch {
        targetName = 'downloaded.tex';
      }
    }

    setIsFetchingUrl(true);
    try {
      const response = await fetch(rawUrl);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const isText =
        contentType.includes('text/') ||
        contentType.includes('json') ||
        contentType.includes('javascript') ||
        /\.(tex|bib|sty|cls|dtx|ltx|txt|md|csv|tsv|json)$/i.test(targetName);

      if (isText) {
        const textContent = await response.text();
        const created = await createFile.mutateAsync({
          parentPageId,
          title: targetName,
          content: textContent,
        });
        toast.success(`Imported ${targetName} from URL`);
        setSearchParams({ file: created.id });
      } else {
        const blob = await response.blob();
        const file = new File([blob], targetName, {
          type: blob.type || 'application/octet-stream',
        });
        await uploadFile.mutateAsync({
          file,
          projectId,
          pageId: parentPageId,
        });
        toast.success(`Imported asset ${targetName} from URL`);
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('External URL fetch error:', err);
      toast.error(
        'Could not fetch file directly. If this domain blocks cross-origin requests (CORS), please download the file to your computer and upload it via the Upload tab.',
      );
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // ── 5. From Library State ─────────────────────────────────────────────────
  const [bibFileName, setBibFileName] = useState('references.bib');
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isExportingBib, setIsExportingBib] = useState(false);

  const { data: libraryData, isLoading: isLoadingLibrary } = useViewItems(
    'user',
    'all',
    librarySearch,
  );
  const libraryItems: Item[] = useMemo(() => libraryData?.items ?? [], [libraryData]);

  // Default select all when library items are loaded for the first time
  useEffect(() => {
    if (libraryItems.length > 0 && selectedItemIds.size === 0) {
      setSelectedItemIds(new Set(libraryItems.map((i) => i.id)));
    }
  }, [libraryItems]);

  const handleToggleSelectAll = () => {
    if (selectedItemIds.size === libraryItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(libraryItems.map((i) => i.id)));
    }
  };

  const handleToggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportFromLibrary = async () => {
    if (!parentPageId || selectedItemIds.size === 0) return;
    const targetName = bibFileName.trim() || 'references.bib';
    const chosenItems = libraryItems.filter((i) => selectedItemIds.has(i.id));

    setIsExportingBib(true);
    try {
      const bibEntries = chosenItems
        .map((item) => formatItemToBibtex(item))
        .join('\n\n');

      const created = await createFile.mutateAsync({
        parentPageId,
        title: targetName,
        content: bibEntries,
      });

      toast.success(
        `Created ${targetName} with ${chosenItems.length} citation(s)`,
      );
      setSearchParams({ file: created.id });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export library references');
    } finally {
      setIsExportingBib(false);
    }
  };

  // ── Navigation Tabs Configuration ─────────────────────────────────────────
  const tabs = [
    { id: 'new-file' as const, label: 'New file', icon: FileText },
    { id: 'upload' as const, label: 'Upload', icon: Upload },
    { id: 'project' as const, label: 'From another project', icon: Folder },
    { id: 'url' as const, label: 'From external URL', icon: Globe },
    { id: 'library' as const, label: 'From library', icon: BookOpen },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-xl text-foreground select-none">
        {/* Hidden inputs for upload */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleNativeFilesPicked}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          {...({ webkitdirectory: '', directory: '' } as any)}
          multiple
          onChange={handleNativeFolderPicked}
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border/80 bg-muted/30">
          <DialogTitle className="text-base font-semibold text-foreground">
            Add files
          </DialogTitle>
          <DialogDescription className="sr-only">
            Add or upload files into this LaTeX project
          </DialogDescription>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body: Left sidebar + Right form pane */}
        <div className="flex min-h-[420px]">
          {/* Left Navigation Sidebar */}
          <div className="w-56 shrink-0 border-r border-border bg-muted/20 p-2.5 flex flex-col gap-1">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer',
                    isActive
                      ? 'bg-background text-foreground shadow-sm font-semibold border border-border/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      isActive ? 'text-[#16a34a]' : 'text-muted-foreground',
                    )}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Form & Content Pane */}
          <div className="flex-1 p-6 flex flex-col justify-between">
            {/* 1. New File Tab */}
            {activeTab === 'new-file' && (
              <form
                onSubmit={handleCreateNewFile}
                className="flex-1 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Create a new file
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enter a name for the file you want to create.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-medium text-foreground">
                      File name
                    </label>
                    <Input
                      ref={newFileInputRef}
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="e.g. section1.tex, appendix.tex"
                      className="h-9 text-xs"
                      autoFocus
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Files ending in .tex, .bib, .cls, .sty, or .md will be
                      opened in the editor.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="rounded-full border border-border px-5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newFileName.trim() || isCreatingNewFile}
                    className="rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    {isCreatingNewFile && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* 2. Upload Tab */}
            {activeTab === 'upload' && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Upload files
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload files or whole folders from your computer into this
                      project.
                    </p>
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(false);
                    }}
                    onDrop={handleModalDrop}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors text-center cursor-pointer',
                      isDraggingOver
                        ? 'border-[#16a34a] bg-emerald-500/10'
                        : 'border-border/80 hover:border-foreground/30 bg-muted/10',
                    )}
                  >
                    <div className="size-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <Upload className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        Drag and drop files here, or
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Maximum file size: 50MB. LaTeX files, images, PDFs, and
                        folders are supported.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                      >
                        Select files
                      </button>
                      <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        Select a folder
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="rounded-full border border-border px-5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* 3. From Another Project Tab */}
            {activeTab === 'project' && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Add file from another project
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Copy a file from one of your other projects into this
                      project.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Select Project */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">
                        Project
                      </label>
                      {isLoadingProjects ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 className="size-3.5 animate-spin" />
                          Loading projects...
                        </div>
                      ) : availableProjects.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">
                          No other projects found in your workspace.
                        </p>
                      ) : (
                        <Select
                          value={selectedProjectId}
                          onValueChange={(val) => {
                            setSelectedProjectId(val);
                            setSelectedFileId('');
                            setProjectTargetName('');
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProjects.map((p: any) => (
                              <SelectItem
                                key={p.id}
                                value={p.id}
                                className="text-xs"
                              >
                                {p.name || p.title || 'Untitled Project'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Select File from Chosen Project */}
                    {selectedProjectId && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          File to copy
                        </label>
                        {isLoadingOtherPages ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <Loader2 className="size-3.5 animate-spin" />
                            Loading files...
                          </div>
                        ) : otherProjectPages.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-1">
                            No files found in selected project.
                          </p>
                        ) : (
                          <Select
                            value={selectedFileId}
                            onValueChange={(val) => {
                              setSelectedFileId(val);
                              const target = otherProjectPages.find(
                                (f: any) => f.id === val,
                              );
                              if (target) setProjectTargetName(target.title);
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select a file" />
                            </SelectTrigger>
                            <SelectContent>
                              {otherProjectPages.map((f: any) => (
                                <SelectItem
                                  key={f.id}
                                  value={f.id}
                                  className="text-xs"
                                >
                                  {f.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {/* Target File Name in this project */}
                    {selectedFileId && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          File name in this project
                        </label>
                        <Input
                          value={projectTargetName}
                          onChange={(e) => setProjectTargetName(e.target.value)}
                          placeholder="File name"
                          className="h-9 text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="rounded-full border border-border px-5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      !selectedFileId ||
                      !projectTargetName.trim() ||
                      isCopyingFromProject
                    }
                    onClick={handleCopyFromProject}
                    className="rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    {isCopyingFromProject && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Create
                  </button>
                </div>
              </div>
            )}

            {/* 4. From External URL Tab */}
            {activeTab === 'url' && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Add file from external URL
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fetch and import a file directly from a public URL.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">
                        URL to fetch
                      </label>
                      <Input
                        value={fetchUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://example.com/dataset.csv or raw GitHub URL"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground">
                        File name in this project
                      </label>
                      <Input
                        value={urlFileName}
                        onChange={(e) => setUrlFileName(e.target.value)}
                        placeholder="e.g. data.csv, imported.tex"
                        className="h-9 text-xs"
                      />
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Note: The URL must allow direct public access. For files on
                      GitHub, use the raw content URL (e.g. raw.githubusercontent.com).
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="rounded-full border border-border px-5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!fetchUrl.trim() || isFetchingUrl}
                    onClick={handleFetchFromUrl}
                    className="rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    {isFetchingUrl && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Create
                  </button>
                </div>
              </div>
            )}

            {/* 5. From Library Tab */}
            {activeTab === 'library' && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Add references from your library
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Export items from your Flux Library into a BibTeX (.bib) file.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          BibTeX file name
                        </label>
                        <Input
                          value={bibFileName}
                          onChange={(e) => setBibFileName(e.target.value)}
                          placeholder="references.bib"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-foreground">
                          Search library
                        </label>
                        <div className="relative">
                          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={librarySearch}
                            onChange={(e) => setLibrarySearch(e.target.value)}
                            placeholder="Filter papers..."
                            className="h-8 text-xs pl-8"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Library items select list */}
                    <div className="border border-border rounded-lg p-2 bg-muted/10 space-y-2">
                      <div className="flex items-center justify-between text-xs pb-1 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="select-all"
                            checked={
                              libraryItems.length > 0 &&
                              selectedItemIds.size === libraryItems.length
                            }
                            onCheckedChange={handleToggleSelectAll}
                          />
                          <label
                            htmlFor="select-all"
                            className="text-xs font-medium cursor-pointer"
                          >
                            Select all
                          </label>
                        </div>
                        <span className="text-muted-foreground text-[11px]">
                          {selectedItemIds.size} of {libraryItems.length} selected
                        </span>
                      </div>

                      <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                        {isLoadingLibrary ? (
                          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Loading library items...
                          </div>
                        ) : libraryItems.length === 0 ? (
                          <div className="text-center py-6 text-xs text-muted-foreground">
                            No references found in your library.
                          </div>
                        ) : (
                          libraryItems.map((item) => {
                            const isSelected = selectedItemIds.has(item.id);
                            return (
                              <div
                                key={item.id}
                                onClick={() => handleToggleItem(item.id)}
                                className={cn(
                                  'flex items-start gap-2 p-1.5 rounded-md hover:bg-muted/60 transition-colors cursor-pointer text-xs',
                                  isSelected && 'bg-muted/40',
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleItem(item.id)}
                                  className="mt-0.5"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-foreground truncate">
                                    {item.title || 'Untitled Reference'}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                    {item.citationKey && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1 py-0 h-4 font-mono font-normal"
                                      >
                                        {item.citationKey}
                                      </Badge>
                                    )}
                                    {item.date && (
                                      <span>
                                        {typeof item.date === 'string'
                                          ? item.date.slice(0, 4)
                                          : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-4">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="rounded-full border border-border px-5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedItemIds.size === 0 || isExportingBib}
                    onClick={handleExportFromLibrary}
                    className="rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white px-5 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    {isExportingBib && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Create
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
