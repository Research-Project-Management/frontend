'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useAddFilesActions } from './hooks/useAddFilesActions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  newFileModalSchema,
  urlImportModalSchema,
  libraryBibtexModalSchema,
  type NewFileModalFormValues,
  type UrlImportModalFormValues,
  type LibraryBibtexModalFormValues,
} from './schemas/add-files.schema';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { cn } from '@/shared/lib/utils';
import { useFileActions, pageKeys } from '@/features/editor/ui/hooks/use-core';
import { useEditorStorage } from '@/features/editor/ui/hooks/use-storage';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { PageService } from '@/features/projects/project-id/pages/services/page.service';
import { pageService } from '@/features/editor/coordinators/services/core.service';
import { manuscriptService } from '@/features/editor/coordinators/services/manuscript.service';
import { formatItemToBibtex } from '@/features/editor/domain/utils/citation.util';
import { useViewItems, type Item } from '@/features/library';

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
  const queryClient = useQueryClient();

  // ── 1. New File State & Form ───────────────────────────────────────────────
  const [isCreatingNewFile, setIsCreatingNewFile] = useState(false);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  const {
    register: registerNewFile,
    handleSubmit: handleSubmitNewFile,
    reset: resetNewFile,
    formState: { errors: newFileErrors },
  } = useForm<NewFileModalFormValues>({
    resolver: zodResolver(newFileModalSchema),
    defaultValues: { fileName: '' },
  });

  useEffect(() => {
    if (open && activeTab === 'new-file') {
      const timer = setTimeout(() => newFileInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open, activeTab]);

  const handleCreateNewFile = (data: NewFileModalFormValues) => {
    const raw = data.fileName.trim();
    if (!raw || !parentPageId) return;

    const title = /\.[a-z0-9]+$/i.test(raw) ? raw : `${raw}.tex`;
    setIsCreatingNewFile(true);
    createFile.mutate(
      {
        parentPageId,
        title,
        content: '',
      },
      {
        onSuccess: (created) => {
          setSearchParams({ file: created.id });
          resetNewFile();
          onOpenChange(false);
        },
        onSettled: () => {
          setIsCreatingNewFile(false);
        },
      },
    );
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
      createFile.mutate(
        {
          parentPageId,
          title: projectTargetName.trim(),
          content: contentStr,
        },
        {
          onSuccess: (created) => {
            setSearchParams({ file: created.id });
            onOpenChange(false);
          },
          onSettled: () => {
            setIsCopyingFromProject(false);
          },
        },
      );
    } catch {
      setIsCopyingFromProject(false);
    }
  };

  // ── 4. From External URL State & Form ─────────────────────────────────────
  const effectiveProjectId = projectId || parentPageId || '';
  const { isFetchingUrl, importFromUrl } = useAddFilesActions({
    parentPageId,
    effectiveProjectId,
    createFile,
    uploadFile,
    setSearchParams,
    onClose: () => onOpenChange(false),
  });

  const {
    register: registerUrl,
    handleSubmit: handleSubmitUrl,
    setValue: setUrlValue,
    watch: watchUrl,
    reset: resetUrl,
    formState: { errors: urlErrors },
  } = useForm<UrlImportModalFormValues>({
    resolver: zodResolver(urlImportModalSchema),
    defaultValues: { url: '', fileName: '' },
  });

  const handleUrlInputChange = (val: string) => {
    setUrlValue('url', val, { shouldValidate: true });
    try {
      const urlObj = new URL(val);
      const cleanPath = urlObj.pathname.split('/').filter(Boolean).pop();
      if (cleanPath && !watchUrl('fileName')) {
        setUrlValue('fileName', decodeURIComponent(cleanPath), { shouldValidate: true });
      }
    } catch {
      // not valid full URL yet
    }
  };

  const handleFetchFromUrl = async (data: UrlImportModalFormValues) => {
    if (!parentPageId) return;
    await importFromUrl(data.url, data.fileName);
    resetUrl();
  };

  // ── 5. From Library State & Form ───────────────────────────────────────────
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isExportingBib, setIsExportingBib] = useState(false);

  const {
    register: registerLibraryBibtex,
    handleSubmit: handleSubmitLibraryBibtex,
    formState: { errors: libraryBibtexErrors },
  } = useForm<LibraryBibtexModalFormValues>({
    resolver: zodResolver(libraryBibtexModalSchema),
    defaultValues: { fileName: 'references.bib' },
  });

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

  const handleExportFromLibrary = (data: LibraryBibtexModalFormValues) => {
    if (!parentPageId || selectedItemIds.size === 0) return;
    const targetName = data.fileName.trim() || 'references.bib';
    const chosenItems = libraryItems.filter((i) => selectedItemIds.has(i.id));

    setIsExportingBib(true);
    const bibEntries = chosenItems
      .map((item) => formatItemToBibtex(item))
      .join('\n\n');

    createFile.mutate(
      {
        parentPageId,
        title: targetName,
        content: bibEntries,
      },
      {
        onSuccess: (created) => {
          setSearchParams({ file: created.id });
          onOpenChange(false);
        },
        onSettled: () => {
          setIsExportingBib(false);
        },
      },
    );
  };

  // ── Navigation Tabs Configuration ─────────────────────────────────────────
  const tabs = [
    { id: 'new-file' as const, label: 'New file', icon: FileText },
    { id: 'upload' as const, label: 'Upload', icon: Upload },
    { id: 'project' as const, label: 'From another project', icon: Folder },
    { id: 'url' as const, label: 'From external URL', icon: Globe },
    { id: 'library' as const, label: 'From library', icon: BookOpen },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    if (currentIndex === -1) return;

    let nextIndex = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== -1) {
      const nextTab = tabs[nextIndex];
      setActiveTab(nextTab.id);
      document.getElementById(`add-files-tab-${nextTab.id}`)?.focus();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-300 rounded-lg text-foreground select-none">
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

        {/* ── Dialog Header (Only Title and Close Icon) ─────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-background shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Add Files
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Add or upload files into this LaTeX project
        </DialogDescription>

        {/* Modal Body: Left sidebar + Right form pane */}
        <div className="flex flex-col sm:flex-row min-h-[420px]">
          {/* Left Navigation Sidebar */}
          <div
            className="w-full sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-muted/20 p-2 sm:p-2.5 flex sm:flex-col flex-row overflow-x-auto sm:overflow-x-visible gap-1"
            role="tablist"
            aria-label="Add file options"
            aria-orientation="vertical"
            onKeyDown={handleTabKeyDown}
          >
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  id={`add-files-tab-${id}`}
                  type="button"
                  role="tab"
                  tabIndex={isActive ? 0 : -1}
                  aria-selected={isActive}
                  aria-controls={`add-files-panel-${id}`}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-12 font-medium text-left transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary whitespace-nowrap',
                    isActive
                      ? 'bg-background text-foreground font-semibold border border-border/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Form & Content Pane */}
          <div
            id={`add-files-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`add-files-tab-${activeTab}`}
            tabIndex={0}
            className="flex-1 p-4 sm:p-6 flex flex-col justify-between outline-none"
          >
            {/* 1. New File Tab */}
            {activeTab === 'new-file' && (
              <form
                onSubmit={handleSubmitNewFile(handleCreateNewFile)}
                className="flex-1 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="space-y-1.5 pt-1">
                    <label className="text-12 font-medium text-foreground">
                      File name
                    </label>
                    <Input
                      {...registerNewFile('fileName')}
                      placeholder="e.g. section1.tex, appendix.tex"
                      className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
                      autoFocus
                    />
                    {newFileErrors.fileName && (
                      <p className="text-11 text-destructive">{newFileErrors.fileName.message}</p>
                    )}
                    <p className="text-11 text-muted-foreground">
                      Files ending in .tex, .bib, .cls, .sty, or .md will be opened in the editor.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isCreatingNewFile}
                    className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
                  >
                    {isCreatingNewFile && (
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
                    )}
                    <span>Create</span>
                  </Button>
                </div>
              </form>
            )}

            {/* 2. Upload Tab */}
            {activeTab === 'upload' && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-4 pt-1">
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
                      'border-2 border-dashed rounded-md p-8 flex flex-col items-center justify-center gap-3 transition-colors text-center cursor-pointer',
                      isDraggingOver
                        ? 'border-primary bg-primary/5'
                        : 'border-border/80 hover:border-foreground/30 bg-muted/10',
                    )}
                  >
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <Upload className="size-5" strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-12 font-medium text-foreground">
                        Drag and drop files here, or
                      </p>
                      <p className="text-11 text-muted-foreground">
                        Maximum file size: 50MB. LaTeX files, images, PDFs, and folders are supported.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 px-3.5 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none"
                      >
                        Select files
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => folderInputRef.current?.click()}
                        className="h-8 px-3.5 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
                      >
                        Select a folder
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-border mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}

            {/* 3. From Another Project Tab */}
            {activeTab === 'project' && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-3 pt-1">
                  {/* Select Project */}
                  <div className="space-y-1">
                    <label className="text-12 font-medium text-foreground">
                      Project
                    </label>
                    {isLoadingProjects ? (
                      <div className="flex items-center gap-2 text-12 text-muted-foreground py-2">
                        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
                        Loading projects...
                      </div>
                    ) : availableProjects.length === 0 ? (
                      <p className="text-12 text-muted-foreground py-1">
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
                        <SelectTrigger className="h-8 text-12 bg-muted/40 rounded-md border-border/60">
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProjects.map((p: any) => (
                            <SelectItem
                              key={p.id}
                              value={p.id}
                              className="text-12"
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
                      <label className="text-12 font-medium text-foreground">
                        File to copy
                      </label>
                      {isLoadingOtherPages ? (
                        <div className="flex items-center gap-2 text-12 text-muted-foreground py-2">
                          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
                          Loading files...
                        </div>
                      ) : otherProjectPages.length === 0 ? (
                        <p className="text-12 text-muted-foreground py-1">
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
                          <SelectTrigger className="h-8 text-12 bg-muted/40 rounded-md border-border/60">
                            <SelectValue placeholder="Select a file" />
                          </SelectTrigger>
                          <SelectContent>
                            {otherProjectPages.map((f: any) => (
                              <SelectItem
                                key={f.id}
                                value={f.id}
                                className="text-12"
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
                      <label className="text-12 font-medium text-foreground">
                        File name in this project
                      </label>
                      <Input
                        value={projectTargetName}
                        onChange={(e) => setProjectTargetName(e.target.value)}
                        placeholder="File name"
                        className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      !selectedFileId ||
                      !projectTargetName.trim() ||
                      isCopyingFromProject
                    }
                    onClick={handleCopyFromProject}
                    className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
                  >
                    {isCopyingFromProject && (
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
                    )}
                    <span>Create</span>
                  </Button>
                </div>
              </div>
            )}

            {/* 4. From External URL Tab */}
            {activeTab === 'url' && (
              <form
                onSubmit={handleSubmitUrl(handleFetchFromUrl)}
                className="flex-1 flex flex-col justify-between"
              >
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-12 font-medium text-foreground">
                      URL to fetch
                    </label>
                    <Input
                      {...registerUrl('url')}
                      onChange={(e) => handleUrlInputChange(e.target.value)}
                      placeholder="https://example.com/dataset.csv or raw GitHub URL"
                      className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
                    />
                    {urlErrors.url && (
                      <p className="text-11 text-destructive">{urlErrors.url.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-12 font-medium text-foreground">
                      File name in this project
                    </label>
                    <Input
                      {...registerUrl('fileName')}
                      placeholder="e.g. data.csv, imported.tex"
                      className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
                    />
                    {urlErrors.fileName && (
                      <p className="text-11 text-destructive">{urlErrors.fileName.message}</p>
                    )}
                  </div>

                  <p className="text-11 text-muted-foreground">
                    Note: The URL must allow direct public access. For files on GitHub, use the raw content URL.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isFetchingUrl}
                    className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
                  >
                    {isFetchingUrl && (
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
                    )}
                    <span>Create</span>
                  </Button>
                </div>
              </form>
            )}

            {/* 5. From Library Tab */}
            {activeTab === 'library' && (
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-12 font-medium text-foreground">
                        BibTeX file name
                      </label>
                      <Input
                        {...registerLibraryBibtex('fileName')}
                        placeholder="references.bib"
                        className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
                      />
                      {libraryBibtexErrors.fileName && (
                        <p className="text-11 text-destructive">{libraryBibtexErrors.fileName.message}</p>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-12 font-medium text-foreground">
                        Search library
                      </label>
                      <div className="relative">
                        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                        <Input
                          value={librarySearch}
                          onChange={(e) => setLibrarySearch(e.target.value)}
                          placeholder="Filter papers..."
                          className="h-8 text-12 pl-8 bg-muted/40 rounded-md border-border/60 focus:bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Library items list with open hairlines */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-11 pb-1.5 px-1 border-b border-border/60 text-muted-foreground font-medium">
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
                          className="text-11 font-medium cursor-pointer text-foreground"
                        >
                          Select all
                        </label>
                      </div>
                      <span>
                        {selectedItemIds.size} of {libraryItems.length} selected
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-border/60 px-1 thin-scrollbar">
                      {isLoadingLibrary ? (
                        <div className="flex items-center justify-center py-6 text-12 text-muted-foreground gap-2">
                          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
                          <span>Loading library items...</span>
                        </div>
                      ) : libraryItems.length === 0 ? (
                        <div className="text-center py-6 text-12 text-muted-foreground">
                          No references found in your library.
                        </div>
                      ) : (
                        libraryItems.map((item) => {
                          const isSelected = selectedItemIds.has(item.id);
                          return (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              aria-pressed={isSelected}
                              onClick={() => handleToggleItem(item.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleToggleItem(item.id);
                                }
                              }}
                              className={cn(
                                'flex items-start gap-2.5 py-2 px-1 hover:bg-muted/20 transition-colors cursor-pointer text-12 outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm',
                                isSelected && 'bg-muted/15',
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
                                <div className="text-11 text-muted-foreground flex items-center gap-2 mt-0.5">
                                  {item.citationKey && (
                                    <Badge
                                      variant="outline"
                                      className="text-10 px-1 py-0 h-4 font-mono font-normal"
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

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={selectedItemIds.size === 0 || isExportingBib}
                    onClick={handleSubmitLibraryBibtex(handleExportFromLibrary)}
                    className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
                  >
                    {isExportingBib && (
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
                    )}
                    <span>Create</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
