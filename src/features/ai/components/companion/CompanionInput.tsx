'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowUp,
  Square,
  Folder,
  Globe,
  Paperclip,
  Check,
  ChevronDown,
  Loader2,
  X,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileImage,
  File,
  FileUp,
  Search,
  Mic,
  Plus,
  HardDrive,
  BookOpen,
  Upload,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { ProjectAvatar } from '@/shared/components/icons';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { useAiCompanionStore } from '../../store/ai-companion.store';
import { uploadDocument, type UploadDocumentProgress } from '../../services/chat.service';
import dynamic from 'next/dynamic';

const LibraryPickerModal = dynamic(
  () => import('./LibraryPickerModal').then((m) => m.LibraryPickerModal),
  { ssr: false }
);

const StoragePickerModal = dynamic(
  () => import('./StoragePickerModal').then((m) => m.StoragePickerModal),
  { ssr: false }
);

const UploadedDocumentsModal = dynamic(
  () => import('./UploadedDocumentsModal').then((m) => m.UploadedDocumentsModal),
  { ssr: false }
);

const ACCEPTED_TYPES =
  '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.json,.ts,.tsx,.js,.py';

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileMeta(name: string, size?: number) {
  const parts = (name || '').split('.');
  const ext = parts.length > 1 ? (parts.pop() || '').toLowerCase() : '';
  const sizeText = size ? formatBytes(size) : '';

  if (ext === 'pdf') {
    return {
      type: 'PDF',
      icon: FileText,
      iconColor: 'text-destructive',
      sizeText,
    };
  }
  if (['doc', 'docx'].includes(ext)) {
    return {
      type: 'Word',
      icon: FileText,
      iconColor: 'text-primary',
      sizeText,
    };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return {
      type: 'Image',
      icon: FileImage,
      iconColor: 'text-primary',
      sizeText,
    };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      type: 'Sheet',
      icon: FileSpreadsheet,
      iconColor: 'text-success',
      sizeText,
    };
  }
  if (
    [
      'ts',
      'tsx',
      'js',
      'jsx',
      'json',
      'py',
      'java',
      'cpp',
      'c',
      'go',
      'rs',
      'md',
      'txt',
    ].includes(ext)
  ) {
    return {
      type: 'Code',
      icon: FileCode,
      iconColor: 'text-warning',
      sizeText,
    };
  }
  return {
    type: 'File',
    icon: File,
    iconColor: 'text-muted-foreground',
    sizeText,
  };
}


export interface AttachedFile {
  id: string;
  name: string;
  size?: number;
}

export interface UploadingFileItem {
  id: string;
  name: string;
  size?: number;
  progress: number;
  stage: 'uploading' | 'processing';
}

export interface SendMessageOptions {
  projectId?: string | null;
  webSearchSites?: string[] | null;
  documentIds?: string[] | null;
  attachedFiles?: AttachedFile[];
}

interface CompanionInputProps {
  currentProjectId?: string;
  onSend: (text: string, options?: SendMessageOptions) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  initialText?: string;
  placeholder?: string;
  className?: string;
  showDisclaimer?: boolean;
}

export function CompanionInput({
  currentProjectId,
  onSend,
  onStop = () => {},
  isStreaming = false,
  initialText = '',
  placeholder = 'How can I help you today?',
  className = 'px-3.5 pb-3 pt-2 bg-background',
  showDisclaimer = true,
}: CompanionInputProps) {
  const [text, setText] = useState(initialText);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isUploadedDocsModalOpen, setIsUploadedDocsModalOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const { projects = [], isLoading: isLoadingProjects } = useProjects();

  // Active non-archived projects
  const activeProjects = useMemo(() => {
    return (projects || []).filter((p: any) => !p.isArchived);
  }, [projects]);

  // Track if user explicitly clicked "None" in the dropdown to avoid auto-selecting again in this session
  const hasUserExplicitlyClearedRef = useRef(false);

  // Initialize selectedProject with resolution hierarchy:
  // 1. currentProjectId (prop from route)
  // 2. localStorage ('flux_active_project_id')
  // 3. null (resolved to activeProjects[0] once activeProjects load)
  const [selectedProject, setSelectedProject] = useState<string | null>(() => {
    if (currentProjectId) return currentProjectId;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('flux_active_project_id');
      if (stored) return stored;
    }
    return null;
  });

  // When route project ID changes, sync and reset explicit clear flag
  const prevRouteProjectIdRef = useRef(currentProjectId);
  useEffect(() => {
    if (currentProjectId !== prevRouteProjectIdRef.current) {
      prevRouteProjectIdRef.current = currentProjectId;
      if (currentProjectId) {
        hasUserExplicitlyClearedRef.current = false;
        const matched = activeProjects.find(
          (p: any) => p.id === currentProjectId || p.identifier === currentProjectId
        );
        const resolvedId = matched ? matched.id : currentProjectId;
        setSelectedProject(resolvedId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('flux_active_project_id', resolvedId);
        }
      }
    }
  }, [currentProjectId, activeProjects]);

  // Synchronize and auto-resolve selectedProject when activeProjects load or change
  useEffect(() => {
    if (activeProjects.length === 0) {
      if (selectedProject !== null) {
        setSelectedProject(null);
      }
      return;
    }

    // If user explicitly chose "None" in this session, do not auto-select
    if (hasUserExplicitlyClearedRef.current) {
      return;
    }

    // 1. If route project ID is present, try matching it first
    if (currentProjectId) {
      const matched = activeProjects.find(
        (p: any) => p.id === currentProjectId || p.identifier === currentProjectId
      );
      if (matched) {
        if (selectedProject !== matched.id) {
          setSelectedProject(matched.id);
          if (typeof window !== 'undefined') {
            localStorage.setItem('flux_active_project_id', matched.id);
          }
        }
        return;
      }
    }

    // 2. If current selectedProject matches an active project (by id or identifier)
    if (selectedProject) {
      const matched = activeProjects.find(
        (p: any) => p.id === selectedProject || p.identifier === selectedProject
      );
      if (matched) {
        if (selectedProject !== matched.id) {
          setSelectedProject(matched.id);
          if (typeof window !== 'undefined') {
            localStorage.setItem('flux_active_project_id', matched.id);
          }
        }
        return;
      }
    }

    // 3. Check localStorage for active project
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('flux_active_project_id');
      if (stored) {
        const matched = activeProjects.find(
          (p: any) => p.id === stored || p.identifier === stored
        );
        if (matched) {
          setSelectedProject(matched.id);
          return;
        }
      }
    }

    // 4. Fallback: Default to the first active project if any exist (never default to 'None' when projects exist)
    const firstProject = activeProjects[0];
    if (firstProject) {
      setSelectedProject(firstProject.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('flux_active_project_id', firstProject.id);
      }
    }
  }, [activeProjects, currentProjectId, selectedProject]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return activeProjects;
    return activeProjects.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q)
    );
  }, [activeProjects, projectSearch]);

  useEffect(() => {
    if (initialText) {
      setText(initialText);
      textareaRef.current?.focus();
    }
  }, [initialText]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [text]);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const targetScope = selectedProject || 'me';

      const tempItems: UploadingFileItem[] = files.map((f, idx) => ({
        id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: f.size,
        progress: 0,
        stage: 'uploading',
      }));

      setUploadingFiles((prev) => [...prev, ...tempItems]);

      let successCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const tempId = tempItems[i].id;
        try {
          const res = await uploadDocument(targetScope, file, (progress: UploadDocumentProgress) => {
            setUploadingFiles((prev) =>
              prev.map((item) =>
                item.id === tempId
                  ? {
                      ...item,
                      progress: progress.percent,
                      stage: progress.stage,
                    }
                  : item
              )
            );
          });
          setAttachedFiles((prev) => [
            ...prev,
            {
              id: res.id,
              name: res.name || file.name,
              size: res.size || file.size,
            },
          ]);
          successCount++;
        } catch (err: any) {
          toast.error(`Failed to upload ${file.name}: ${err?.message || 'Error'}`);
        } finally {
          setUploadingFiles((prev) => prev.filter((item) => item.id !== tempId));
        }
      }

      if (successCount > 0) {
        toast.success(`Attached ${successCount} file(s)`);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [selectedProject]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const isUploading = uploadingFiles.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isUploading) {
        const isIndexing = uploadingFiles.some((f) => f.stage === 'processing');
        toast.info(
          isIndexing
            ? 'Documents are being indexed into the vector store. Please wait a moment...'
            : 'Documents are currently uploading. Please wait for completion...'
        );
        return;
      }
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (isUploading) {
      const isIndexing = uploadingFiles.some((f) => f.stage === 'processing');
      toast.info(
        isIndexing
          ? 'Documents are being indexed into the vector store. Please wait a moment...'
          : 'Documents are currently uploading. Please wait for completion...'
      );
      return;
    }
    if ((!text.trim() && attachedFiles.length === 0) || isStreaming) return;

    const finalProjectId = currentProjectObj ? currentProjectObj.id : selectedProject;
    const finalWebSearch = webSearchEnabled ? ['*'] : undefined;
    const finalDocIds =
      attachedFiles.length > 0 ? attachedFiles.map((f) => f.id) : undefined;

    onSend(text.trim(), {
      projectId: finalProjectId,
      webSearchSites: finalWebSearch,
      documentIds: finalDocIds,
      attachedFiles: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    });

    setText('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Selected project display name & object lookup (matching by id or identifier)
  const currentProjectObj = useMemo(() => {
    if (!selectedProject) return null;
    return (
      activeProjects.find(
        (p: any) => p.id === selectedProject || p.identifier === selectedProject
      ) || null
    );
  }, [activeProjects, selectedProject]);

  const rawProjectName =
    currentProjectObj?.name || (activeProjects.length === 0 ? 'No project' : 'None');
  const currentProjectName =
    rawProjectName.toLowerCase().includes('flux neural dynamics') ||
    rawProjectName.toLowerCase() === 'flux'
      ? 'flux'
      : rawProjectName;

  return (
    <div className={cn('w-full shrink-0 select-none', className)}>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col rounded-lg border border-border bg-background transition-all px-3 py-2.5',
          isDragging && 'border-ai/70 ring-2 ring-ai/20 bg-ai/[0.02]'
        )}
      >
        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div className='absolute inset-0 z-30 rounded-lg bg-background/95 backdrop-blur-xs border-2 border-dashed border-ai flex flex-col items-center justify-center gap-1.5 pointer-events-none'>
            <FileUp className='size-5 text-foreground transition-transform duration-300 ease-out animate-pulse motion-reduce:animate-none' />
            <p className='text-12 font-medium text-foreground'>Drop files to attach to chat</p>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept={ACCEPTED_TYPES}
          className='hidden'
          onChange={handleFileUpload}
        />

        {/* ── Top Bar: Project Scope Selector & Attached/Uploading Files ────── */}
        <div className='flex items-center gap-1.5 flex-wrap mb-2'>
          <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type='button'
                    className='inline-flex h-6 max-w-[220px] items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted px-2 text-11 text-foreground transition-colors cursor-pointer outline-none shrink-0 relative before:absolute before:-inset-1.5 md:before:hidden'
                    aria-label='Project context scope'
                  >
                    {currentProjectObj ? (
                      <ProjectAvatar
                        avatar={currentProjectObj.avatar}
                        name={currentProjectObj.name}
                        id={currentProjectObj.id}
                        size="custom"
                        className="size-3.5 flex items-center justify-center text-11 leading-none shrink-0"
                      />
                    ) : (
                      <Folder className='size-3 text-foreground shrink-0' />
                    )}
                    <span className='truncate font-medium'>{currentProjectName}</span>
                    <ChevronDown className='size-2.5 text-foreground shrink-0 opacity-70 ml-0.5' />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side='top' sideOffset={4}>
                Project context scope
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              align='start'
              side='top'
              sideOffset={6}
              className='w-60 p-1.5 rounded-md shadow-md z-50 border border-border bg-popover max-h-64 flex flex-col'
            >
              {/* Search input if multiple projects */}
              {activeProjects.length > 3 && (
                <div className='flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1'>
                  <Search className='size-3 text-foreground shrink-0' />
                  <input
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder='Search projects...'
                    className='w-full bg-transparent text-11 outline-none placeholder:text-muted-foreground text-foreground'
                    autoFocus
                  />
                </div>
              )}

              <div className='space-y-0.5 overflow-y-auto max-h-52'>
                {/* Option 1: None */}
                <button
                  type='button'
                  onClick={() => {
                    hasUserExplicitlyClearedRef.current = true;
                    setSelectedProject(null);
                    setScopeOpen(false);
                    setProjectSearch('');
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                    selectedProject === null
                      ? 'bg-muted text-foreground font-medium'
                      : 'hover:bg-muted text-foreground font-normal'
                  )}
                >
                  <div className='flex items-center gap-2 truncate'>
                    <Folder className='size-3 text-foreground shrink-0' />
                    <span className='truncate'>None</span>
                  </div>
                  {selectedProject === null && (
                    <Check className='size-3 text-foreground shrink-0 ml-1.5' />
                  )}
                </button>

                <div className='my-1 border-t border-border/50' />

                {isLoadingProjects && (
                  <div className='flex items-center gap-2 px-2.5 py-1.5 text-11 text-muted-foreground'>
                    <Loader2 className='size-3 animate-spin shrink-0 text-foreground' />
                    <span>Loading projects...</span>
                  </div>
                )}

                {!isLoadingProjects && activeProjects.length === 0 && (
                  <div className='px-2.5 py-2 text-center text-11 text-muted-foreground italic'>
                    No projects available
                  </div>
                )}

                {!isLoadingProjects && filteredProjects.length === 0 && projectSearch && (
                  <div className='px-2.5 py-2 text-center text-11 text-muted-foreground italic'>
                    No matching projects
                  </div>
                )}

                {!isLoadingProjects &&
                  filteredProjects.map((p: any) => {
                    const isSelected =
                      selectedProject === p.id || selectedProject === p.identifier;
                    const displayName =
                      p.name?.toLowerCase().includes('flux neural dynamics') || p.name?.toLowerCase() === 'flux'
                        ? 'flux'
                        : p.name;
                    return (
                      <button
                        key={p.id}
                        type='button'
                        onClick={() => {
                          hasUserExplicitlyClearedRef.current = false;
                          setSelectedProject(p.id);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('flux_active_project_id', p.id);
                          }
                          setScopeOpen(false);
                          setProjectSearch('');
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-muted text-foreground font-medium'
                            : 'hover:bg-muted text-foreground font-normal'
                        )}
                      >
                        <div className='flex items-center gap-2 truncate'>
                          <ProjectAvatar
                            avatar={p.avatar}
                            name={displayName}
                            id={p.id}
                            size="custom"
                            className="size-3.5 flex items-center justify-center text-11 leading-none shrink-0"
                          />
                          <span className='truncate'>{displayName}</span>
                        </div>
                        {isSelected && (
                          <Check className='size-3 text-foreground shrink-0 ml-1.5' />
                        )}
                      </button>
                    );
                  })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Uploading files */}
          {uploadingFiles.map((up) => {
            const isProcessing = up.stage === 'processing';
            return (
              <Tooltip key={up.id}>
                <TooltipTrigger asChild>
                  <div className='inline-flex h-6.5 items-center gap-1.5 px-2 rounded-md border border-border/70 bg-muted/40 text-11 text-foreground transition-all select-none max-w-[240px] cursor-default'>
                    <Loader2 className='size-3 animate-spin text-ai shrink-0' />
                    <span className='truncate max-w-[120px] font-medium'>{up.name}</span>
                    <span className='text-10 text-muted-foreground font-mono shrink-0'>
                      {isProcessing ? 'Indexing...' : `${up.progress}%`}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side='top' sideOffset={4} className='max-w-xs'>
                  <p className='font-medium truncate'>{up.name}</p>
                  <p className='text-10 text-muted-foreground'>
                    {isProcessing
                      ? 'Extracting content & indexing vector store...'
                      : `Uploading: ${up.progress}%`}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Uploaded files */}
          {attachedFiles.map((file) => {
            const meta = getFileMeta(file.name, file.size);
            const IconComp = meta.icon;
            return (
              <div
                key={file.id}
                className='group relative inline-flex h-6.5 items-center gap-1.5 px-2 rounded-md border border-border bg-background hover:bg-muted/50 text-11 text-foreground transition-all select-none max-w-[240px]'
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className='flex items-center gap-1.5 min-w-0 cursor-default'>
                      <IconComp className={cn('size-3 shrink-0', meta.iconColor)} />
                      <span className='truncate max-w-[120px] font-medium'>
                        {file.name}
                      </span>
                      {meta.sizeText && (
                        <span className='text-10 text-muted-foreground shrink-0'>
                          {meta.sizeText}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side='top' sideOffset={4} className='max-w-xs'>
                    <p className='font-medium truncate'>{file.name}</p>
                    {meta.sizeText && (
                      <p className='text-10 text-muted-foreground'>
                        {meta.sizeText} • Ready for AI
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type='button'
                      onClick={() => removeAttachedFile(file.id)}
                      className='size-4.5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted ml-0.5 cursor-pointer relative before:absolute before:-inset-2 md:before:hidden'
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className='size-2.5' />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='top' sideOffset={4}>
                    Remove document
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>

        {/* ── Textarea ───────────────────────────────────────────────────────── */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={placeholder}
          rows={1}
          className='w-full resize-none bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none leading-relaxed min-h-[32px] max-h-[140px] px-0.5 py-1'
        />

        {/* ── Bottom Action Toolbar ─────────────────────────────────────────── */}
        <div className='flex items-center justify-between pt-2'>
          {/* Left tools: Plus menu containing upload, storage import, library import, web search */}
          <div className='flex items-center gap-1'>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type='button'
                      disabled={isStreaming}
                      className={cn(
                        'relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai before:absolute before:-inset-2 md:before:hidden',
                        isStreaming && 'opacity-40 cursor-not-allowed'
                      )}
                      aria-label='Add attachment or toggle features'
                    >
                      <Plus className='size-4 shrink-0 text-foreground' />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side='top' sideOffset={4}>
                  Add documents or tools
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align='start'
                side='top'
                sideOffset={8}
                className='w-56 p-1 rounded-lg shadow-lg border border-border bg-popover text-foreground select-none space-y-0.5'
              >
                {/* 1. Upload from Device */}
                <DropdownMenuItem
                  onClick={() => fileInputRef.current?.click()}
                  className='flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground'
                >
                  <Upload className='size-4 text-foreground shrink-0' />
                  <span>Upload from device</span>
                </DropdownMenuItem>

                {/* 2. Import from Storage */}
                <DropdownMenuItem
                  onClick={() => setIsStorageModalOpen(true)}
                  className='flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground'
                >
                  <HardDrive className='size-4 text-foreground shrink-0' />
                  <span>Import from Storage</span>
                </DropdownMenuItem>

                {/* 3. Import from Library */}
                <DropdownMenuItem
                  onClick={() => setIsLibraryModalOpen(true)}
                  className='flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground'
                >
                  <BookOpen className='size-4 text-foreground shrink-0' />
                  <span>Import from Library</span>
                </DropdownMenuItem>

                {/* 4. Uploaded AI Documents */}
                <DropdownMenuItem
                  onClick={() => setIsUploadedDocsModalOpen(true)}
                  className='flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground'
                >
                  <Database className='size-4 text-foreground shrink-0' />
                  <span>Uploaded documents</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className='my-1' />

                {/* 4. Web Search Toggle inside the Plus menu */}
                <button
                  type='button'
                  role='switch'
                  aria-checked={webSearchEnabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setWebSearchEnabled(!webSearchEnabled);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      setWebSearchEnabled(!webSearchEnabled);
                    }
                  }}
                  className='w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted focus:bg-muted transition-colors cursor-pointer select-none text-foreground text-13 font-normal outline-none focus-visible:ring-1 focus-visible:ring-ai'
                >
                  <div className='flex items-center gap-2.5 min-w-0'>
                    <Globe className='size-4 text-foreground shrink-0' />
                    <span>Web search</span>
                  </div>
                  <div
                    className={cn(
                      'relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                      webSearchEnabled ? 'bg-ai' : 'bg-muted-foreground/30'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block size-3 rounded-full bg-white transform ring-0 transition duration-200 ease-in-out',
                        webSearchEnabled ? 'translate-x-3' : 'translate-x-0'
                      )}
                    />
                  </div>
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right tool: Mic, Send or Stop */}
          <div className='flex items-center gap-1.5'>
            {/* Voice Input Mic button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  onClick={() => {
                    toast.info('Voice input coming soon');
                  }}
                  disabled={isStreaming}
                  className='relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none before:absolute before:-inset-2 md:before:hidden'
                  aria-label='Voice input'
                >
                  <Mic className='size-3.5 shrink-0 text-foreground' />
                </button>
              </TooltipTrigger>
              <TooltipContent side='top' sideOffset={4}>
                Voice input
              </TooltipContent>
            </Tooltip>

            {isStreaming ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    onClick={onStop}
                    className='relative flex size-7 items-center justify-center rounded-md bg-ai text-white hover:bg-ai-hover transition-all active:scale-95 cursor-pointer before:absolute before:-inset-2 md:before:hidden'
                    aria-label='Stop generating'
                  >
                    <Square className='size-3 fill-current' />
                  </button>
                </TooltipTrigger>
                <TooltipContent side='top' sideOffset={4}>
                  Stop generating
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    onClick={handleSubmit}
                    disabled={(!text.trim() && attachedFiles.length === 0) || isUploading}
                    className={cn(
                      'relative flex size-7 items-center justify-center rounded-md p-0 transition-all select-none before:absolute before:-inset-2 md:before:hidden',
                      isUploading
                        ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                        : (!text.trim() && attachedFiles.length === 0)
                          ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-40'
                          : 'bg-ai text-white hover:bg-ai-hover active:scale-95 cursor-pointer'
                    )}
                    aria-label={
                      isUploading
                        ? 'Processing documents...'
                        : 'Send message'
                    }
                  >
                    {isUploading ? (
                      <Loader2 className='size-3.5 animate-spin text-ai' />
                    ) : (
                      <ArrowUp className='size-3.5 shrink-0 stroke-[2.5] translate-y-[1px]' />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side='top' sideOffset={4}>
                  {isUploading
                    ? uploadingFiles.some((f) => f.stage === 'processing')
                      ? 'Indexing documents, please wait...'
                      : 'Uploading documents, please wait...'
                    : 'Send message'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Plane Style Disclaimer Footer */}
      {showDisclaimer && (
        <p className='text-12 text-muted-foreground text-center select-none pt-2 pb-0.5 leading-normal'>
          AI Assistant can make mistakes, please double-check responses.
        </p>
      )}

      {/* Library Picker Modal */}
      {isLibraryModalOpen && (
        <LibraryPickerModal
          isOpen={isLibraryModalOpen}
          onClose={() => setIsLibraryModalOpen(false)}
          projectId={selectedProject}
          onSelectItems={(items) => {
            setAttachedFiles((prev) => {
              const existingIds = new Set(prev.map((f) => f.id));
              const fresh = items.filter((f) => !existingIds.has(f.id));
              return [...prev, ...fresh];
            });
          }}
          onSelectItem={(item) => {
            setAttachedFiles((prev) => {
              if (prev.some((f) => f.id === item.id)) return prev;
              return [...prev, item];
            });
          }}
        />
      )}

      {/* Storage Picker Modal */}
      {isStorageModalOpen && (
        <StoragePickerModal
          isOpen={isStorageModalOpen}
          onClose={() => setIsStorageModalOpen(false)}
          projectId={selectedProject}
          onSelectItems={(items) => {
            setAttachedFiles((prev) => {
              const existingIds = new Set(prev.map((f) => f.id));
              const fresh = items.filter((f) => !existingIds.has(f.id));
              return [...prev, ...fresh];
            });
          }}
          onSelectItem={(item) => {
            setAttachedFiles((prev) => {
              if (prev.some((f) => f.id === item.id)) return prev;
              return [...prev, item];
            });
          }}
        />
      )}

      {/* Uploaded Documents Modal */}
      {isUploadedDocsModalOpen && (
        <UploadedDocumentsModal
          isOpen={isUploadedDocsModalOpen}
          onClose={() => setIsUploadedDocsModalOpen(false)}
          projectId={selectedProject}
          onSelectItems={(items) => {
            setAttachedFiles((prev) => {
              const existingIds = new Set(prev.map((f) => f.id));
              const fresh = items.filter((f) => !existingIds.has(f.id));
              return [...prev, ...fresh];
            });
          }}
          onSelectItem={(item) => {
            setAttachedFiles((prev) => {
              if (prev.some((f) => f.id === item.id)) return prev;
              return [...prev, item];
            });
          }}
        />
      )}
    </div>
  );
}
