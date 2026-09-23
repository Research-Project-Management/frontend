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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { uploadDocument } from '../../services/chat.service';
import { LibraryPickerModal } from './LibraryPickerModal';
import { StoragePickerModal } from './StoragePickerModal';

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
  className = 'px-3 pb-3 pt-1 bg-background',
  showDisclaimer = true,
}: CompanionInputProps) {
  const [text, setText] = useState(initialText);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<
    Array<{ id: string; name: string; size?: number }>
  >([]);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const { projects = [], isLoading: isLoadingProjects } = useProjects();

  // Active non-archived projects
  const activeProjects = useMemo(() => {
    return (projects || []).filter((p: any) => !p.isArchived);
  }, [projects]);

  // Selected project: defaults to currentProjectId if inside a project, otherwise null ('None')
  const [selectedProject, setSelectedProject] = useState<string | null>(() => {
    return currentProjectId || null;
  });

  const prevRouteProjectIdRef = useRef(currentProjectId);
  useEffect(() => {
    if (currentProjectId !== prevRouteProjectIdRef.current) {
      prevRouteProjectIdRef.current = currentProjectId;
      setSelectedProject(currentProjectId || null);
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (
      selectedProject &&
      activeProjects.length > 0 &&
      !activeProjects.some((p: any) => p.id === selectedProject)
    ) {
      setSelectedProject(null);
    }
  }, [activeProjects, selectedProject]);

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

      const tempItems = files.map((f, idx) => ({
        id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: f.size,
      }));

      setUploadingFiles((prev) => [...prev, ...tempItems]);

      let successCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const tempId = tempItems[i].id;
        try {
          const res = await uploadDocument(targetScope, file);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if ((!text.trim() && attachedFiles.length === 0) || isStreaming) return;

    const finalProjectId = selectedProject;
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

  // Selected project display name
  const currentProjectObj = activeProjects.find((p: any) => p.id === selectedProject);
  const currentProjectName = currentProjectObj?.name || 'None';

  return (
    <div className={cn('w-full shrink-0 select-none', className)}>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col rounded-lg border border-border bg-background shadow-2xs transition-all p-2.5',
          isDragging && 'border-primary/70 ring-2 ring-primary/20 bg-primary/[0.02]'
        )}
      >
        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div className='absolute inset-0 z-30 rounded-lg bg-background/95 backdrop-blur-xs border-2 border-dashed border-primary flex flex-col items-center justify-center gap-1.5 pointer-events-none'>
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

        {/* ── Top Bar: Project Scope Selector ────── */}
        <div className='flex items-center pb-1 mb-0.5'>
          <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
            <PopoverTrigger asChild>
              <button
                type='button'
                className='inline-flex h-6.5 max-w-[220px] items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted px-2 text-11 text-foreground transition-colors cursor-pointer outline-none shadow-2xs'
                title='Select project for chat context'
              >
                <Folder className='size-3 text-foreground shrink-0' />
                <span className='truncate font-medium'>{currentProjectName}</span>
                <ChevronDown className='size-2.5 text-foreground shrink-0 opacity-70 ml-0.5' />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align='start'
              side='top'
              sideOffset={6}
              className='w-60 p-1.5 rounded-md shadow-md z-50 border border-border bg-popover max-h-64 flex flex-col'
            >
              {/* Search input if multiple projects */}
              {activeProjects.length > 3 && (
                <div className='flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1 shadow-2xs'>
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
                    const isSelected = selectedProject === p.id;
                    return (
                      <button
                        key={p.id}
                        type='button'
                        onClick={() => {
                          setSelectedProject(p.id);
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
                          <Folder className='size-3 text-foreground shrink-0' />
                          <span className='truncate'>{p.name}</span>
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
        </div>

        {/* ── Attached Files List ────────────────────────────────────────────── */}
        {(attachedFiles.length > 0 || uploadingFiles.length > 0) && (
          <div className='flex items-center gap-1.5 flex-wrap pb-1.5 pt-0.5 max-h-32 overflow-y-auto mb-1'>
            {/* Uploading files */}
            {uploadingFiles.map((up) => (
              <div
                key={up.id}
                className='flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/80 bg-muted/40 text-11 text-muted-foreground animate-pulse'
              >
                <Loader2 className='size-3 animate-spin text-foreground shrink-0' />
                <span className='truncate max-w-[120px]'>{up.name}</span>
              </div>
            ))}

            {/* Uploaded files */}
            {attachedFiles.map((file) => {
              const meta = getFileMeta(file.name, file.size);
              const IconComp = meta.icon;
              return (
                <div
                  key={file.id}
                  className='group relative flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card hover:bg-muted/50 text-11 text-foreground transition-all shadow-2xs select-none'
                  title={file.name}
                >
                  <IconComp className={cn('size-3 shrink-0', meta.iconColor)} />
                  <span className='truncate max-w-[120px] font-medium'>
                    {file.name}
                  </span>
                  {meta.sizeText && (
                    <span className='text-10 text-muted-foreground shrink-0'>
                      {meta.sizeText}
                    </span>
                  )}
                  <button
                    type='button'
                    onClick={() => removeAttachedFile(file.id)}
                    className='size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 ml-0.5 cursor-pointer'
                    title={`Remove ${file.name}`}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className='size-3' />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Textarea ───────────────────────────────────────────────────────── */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={placeholder}
          rows={1}
          className='w-full resize-none bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none leading-relaxed min-h-[44px] max-h-[140px] px-1 py-0.5'
        />

        {/* ── Bottom Action Toolbar ─────────────────────────────────────────── */}
        <div className='flex items-center justify-between pt-1 mt-0.5'>
          {/* Left tools: Plus menu containing upload, storage import, library import, web search */}
          <div className='flex items-center gap-1'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type='button'
                  disabled={isStreaming}
                  className={cn(
                    'relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                    isStreaming && 'opacity-40 cursor-not-allowed'
                  )}
                  aria-label='Add attachment or toggle features'
                  title='Add attachment or toggle web search'
                >
                  <Plus className='size-4 shrink-0 text-foreground' />
                </button>
              </DropdownMenuTrigger>
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

                {/* 2. Upload from Storage */}
                <DropdownMenuItem
                  onClick={() => setIsStorageModalOpen(true)}
                  className='flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground'
                >
                  <HardDrive className='size-4 text-foreground shrink-0' />
                  <span>Upload from storage</span>
                </DropdownMenuItem>

                {/* 3. Import from Library */}
                <DropdownMenuItem
                  onClick={() => setIsLibraryModalOpen(true)}
                  className='flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground'
                >
                  <BookOpen className='size-4 text-foreground shrink-0' />
                  <span>Import from Library</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className='my-1' />

                {/* 4. Web Search Toggle inside the Plus menu */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setWebSearchEnabled(!webSearchEnabled);
                  }}
                  className='flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer select-none text-foreground text-13 font-normal'
                >
                  <div className='flex items-center gap-2.5 min-w-0'>
                    <Globe className='size-4 text-foreground shrink-0' />
                    <span>Web search</span>
                  </div>
                  <div
                    className={cn(
                      'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                      webSearchEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block size-3 rounded-full bg-white shadow-xs transform ring-0 transition duration-200 ease-in-out',
                        webSearchEnabled ? 'translate-x-3' : 'translate-x-0'
                      )}
                    />
                  </div>
                </div>
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
                  className='flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none'
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
              <button
                type='button'
                onClick={onStop}
                className='flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95 shadow-2xs cursor-pointer'
                title='Stop generating'
                aria-label='Stop generating'
              >
                <Square className='size-3 fill-current' />
              </button>
            ) : (
              <button
                type='button'
                onClick={handleSubmit}
                disabled={!text.trim() && attachedFiles.length === 0}
                className='flex size-7 items-center justify-center rounded-full p-0 transition-all shadow-2xs cursor-pointer select-none bg-primary text-white hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed'
                title='Send message'
                aria-label='Send message'
              >
                <ArrowUp className='size-3.5 shrink-0 stroke-[2.5] translate-y-[1px]' />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plane Style Disclaimer Footer */}
      {showDisclaimer && (
        <p className='text-11 text-muted-foreground/75 text-center select-none pt-2 pb-0.5 leading-tight'>
          Flux AI can make mistakes, please double-check responses.
        </p>
      )}

      {/* Library Picker Modal */}
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

      {/* Storage Picker Modal */}
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
    </div>
  );
}
