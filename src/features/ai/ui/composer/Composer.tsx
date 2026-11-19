'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  Database,
  FileText,
  FileUp,
  Folder,
  Globe,
  HardDrive,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Search,
  Square,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProjectAvatar } from '@/shared/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import {
  ACCEPTED_FILE_TYPES,
  type ContextTab,
  type SourceEntry,
  type UploadingFile,
} from '../../context/source.port';
import type { QuotedPassageData } from '../../engine/shell';
import { AttachmentBar } from './AttachmentBar';

export type ReaderDocScope = 'current' | 'open-tabs' | 'all';

export interface ComposerProps {
  variant?: 'workspace' | 'companion' | 'inline';
  placeholder?: string;
  className?: string;
  showDisclaimer?: boolean;
  initialValue?: string;

  spaceId?: string | null;
  onSpaceChange?: (spaceId: string | null) => void;
  showSpaceSelector?: boolean;

  sources?: readonly SourceEntry[];
  uploadingFiles?: readonly UploadingFile[];
  isUploading?: boolean;
  onUploadFiles?: (files: File[]) => Promise<unknown> | void;
  onRemoveSource?: (id: string) => void;
  onToggleSource?: (id: string) => void;
  onOpenPicker?: (tab: ContextTab) => void;

  webSearchEnabled?: boolean;
  webSearchSites?: readonly string[];
  onWebSearchChange?: (enabled: boolean) => void;
  onWebSearchSitesChange?: (sites: string[]) => void;

  isReaderContext?: boolean;
  readerPaper?: { id: string; title: string } | null;
  openReaderPapers?: ReadonlyArray<{ id: string; title: string }>;
  readerDocScope?: ReaderDocScope;
  onReaderDocScopeChange?: (scope: ReaderDocScope) => void;

  quotedPassage?: QuotedPassageData | null;
  onClearQuotedPassage?: () => void;

  isStreaming?: boolean;
  disabled?: boolean;
  onSend: (text: string) => void | Promise<void>;
  onStop?: () => void;
}

export function Composer({
  variant = 'workspace',
  placeholder = 'How can I help you today?',
  className,
  showDisclaimer = false,
  initialValue = '',

  spaceId = null,
  onSpaceChange,
  showSpaceSelector = true,

  sources = [],
  uploadingFiles = [],
  isUploading = false,
  onUploadFiles,
  onRemoveSource,
  onToggleSource,
  onOpenPicker,

  webSearchEnabled = false,
  webSearchSites = [],
  onWebSearchChange,
  onWebSearchSitesChange,

  isReaderContext = false,
  readerPaper = null,
  openReaderPapers = [],
  readerDocScope = 'current',
  onReaderDocScopeChange,

  quotedPassage = null,
  onClearQuotedPassage,

  isStreaming = false,
  disabled = false,
  onSend,
  onStop,
}: ComposerProps) {
  const compact = variant !== 'workspace';
  const [text, setText] = useState(initialValue);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [readerScopeOpen, setReaderScopeOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [newSiteInput, setNewSiteInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const { projects = [], isLoading: isLoadingProjects } = useProjects();
  const activeProjects = useMemo(
    () => (projects || []).filter((p) => !p.isArchived),
    [projects],
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (initialValue) {
      setText(initialValue);
      textareaRef.current?.focus();
    }
  }, [initialValue]);

  useEffect(() => {
    if (quotedPassage) {
      textareaRef.current?.focus();
    }
  }, [quotedPassage]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, compact ? 140 : 220)}px`;
  }, [text, compact]);

  const currentProjectObj = useMemo(() => {
    if (!spaceId) return null;
    return (
      activeProjects.find((p) => p.id === spaceId || p.identifier === spaceId) ??
      null
    );
  }, [activeProjects, spaceId]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return activeProjects;
    return activeProjects.filter((p) =>
      (p.name || '').toLowerCase().includes(q),
    );
  }, [activeProjects, projectSearch]);

  const uploadingActive = isUploading || uploadingFiles.length > 0;
  const canSend =
    Boolean(text.trim() || quotedPassage || sources.length > 0) &&
    !isStreaming &&
    !disabled &&
    !uploadingActive;

  const notifyIfUploading = () => {
    const isIndexing = uploadingFiles.some((f) => f.stage === 'processing');
    toast.info(
      isIndexing
        ? 'Documents are being indexed into the vector store. Please wait a moment...'
        : 'Documents are currently uploading. Please wait for completion...',
    );
  };

  const handleSubmit = () => {
    if (uploadingActive) {
      notifyIfUploading();
      return;
    }
    if (!canSend) return;

    const value = text.trim();
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    void onSend(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length > 0) {
      void onUploadFiles?.(files);
    }
  };

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
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      void onUploadFiles?.(files);
    }
  };

  const handleAddWebSite = () => {
    const clean = newSiteInput
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (!clean) return;
    if (!webSearchSites.includes(clean)) {
      onWebSearchSitesChange?.([...webSearchSites, clean]);
    }
    setNewSiteInput('');
  };

  const displaySpaceLabel = currentProjectObj?.name
    ? currentProjectObj.name
    : activeProjects.length === 0
      ? compact
        ? 'Personal'
        : 'All Projects'
      : compact
        ? 'Personal'
        : 'All Projects';

  return (
    <div
      className={cn(
        variant === 'workspace'
          ? 'w-full max-w-3xl mx-auto relative'
          : 'w-full shrink-0 select-none',
        className,
      )}
    >
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col rounded-lg border border-border bg-background transition-all focus-within:border-ai focus-within:ring-1 focus-within:ring-ai/30',
          compact ? 'px-3 py-2.5' : 'p-3 sm:p-3.5',
          isDragging && 'border-ai/70 ring-2 ring-ai/20 bg-ai/[0.02]',
        )}
      >
        {isDragging && (
          <div className="absolute inset-0 z-30 rounded-lg bg-background/95 backdrop-blur-xs border-2 border-dashed border-ai flex flex-col items-center justify-center gap-1.5 pointer-events-none">
            <FileUp className="size-5 text-ai animate-pulse motion-reduce:animate-none" />
            <p className="text-12 font-medium text-foreground">
              Drop files to attach to chat
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Top bar: Project space selector + Reader scope + Attachment chips */}
        {(showSpaceSelector ||
          isReaderContext ||
          (compact && (sources.length > 0 || uploadingFiles.length > 0))) && (
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {showSpaceSelector && onSpaceChange && (
              <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        suppressHydrationWarning
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted px-2 text-foreground transition-colors cursor-pointer outline-none shrink-0',
                          compact ? 'h-6 max-w-[200px] text-11' : 'h-7 max-w-[220px] text-12',
                        )}
                        aria-label="Project context scope"
                      >
                        {isMounted && currentProjectObj ? (
                          <ProjectAvatar
                            avatar={currentProjectObj.avatar}
                            name={currentProjectObj.name}
                            id={currentProjectObj.id}
                            size="custom"
                            className="size-3.5 flex items-center justify-center text-11 leading-none shrink-0"
                          />
                        ) : (
                          <Folder className="size-3 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate font-medium">
                          {isMounted ? displaySpaceLabel : compact ? 'Personal' : 'All Projects'}
                        </span>
                        <ChevronDown className="size-2.5 text-muted-foreground shrink-0 opacity-70" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    Project context scope
                  </TooltipContent>
                </Tooltip>

                <PopoverContent
                  align="start"
                  side={compact ? 'top' : 'bottom'}
                  sideOffset={6}
                  className="w-60 p-1.5 rounded-md shadow-md z-50 border border-border bg-popover max-h-64 flex flex-col"
                >
                  {activeProjects.length > 3 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
                      <Search className="size-3 text-muted-foreground shrink-0" />
                      <input
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder="Search projects..."
                        className="w-full bg-transparent text-11 outline-none placeholder:text-muted-foreground text-foreground"
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="space-y-0.5 overflow-y-auto max-h-52">
                    <button
                      type="button"
                      onClick={() => {
                        onSpaceChange(null);
                        setScopeOpen(false);
                        setProjectSearch('');
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                        !spaceId
                          ? 'bg-muted text-foreground font-medium'
                          : 'hover:bg-muted text-foreground/80 font-normal',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="size-3 text-muted-foreground shrink-0" />
                        <span className="truncate">Personal (No project)</span>
                      </div>
                      {!spaceId && <Check className="size-3 text-foreground shrink-0 ml-1.5" />}
                    </button>

                    <div className="my-1 border-t border-border/50" />

                    {isLoadingProjects && (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 text-11 text-muted-foreground">
                        <Loader2 className="size-3 animate-spin shrink-0" />
                        <span>Loading projects...</span>
                      </div>
                    )}

                    {!isLoadingProjects && filteredProjects.length === 0 && (
                      <div className="px-2.5 py-2 text-center text-11 text-muted-foreground italic">
                        {projectSearch ? 'No matching projects' : 'No projects'}
                      </div>
                    )}

                    {!isLoadingProjects &&
                      filteredProjects.map((p) => {
                        const selected = spaceId === p.id || spaceId === p.identifier;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              onSpaceChange(p.id);
                              setScopeOpen(false);
                              setProjectSearch('');
                            }}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                              selected
                                ? 'bg-muted text-foreground font-medium'
                                : 'hover:bg-muted text-foreground/80 font-normal',
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <ProjectAvatar
                                avatar={p.avatar}
                                name={p.name}
                                id={p.id}
                                size="custom"
                                className="size-3.5 flex items-center justify-center text-11 leading-none shrink-0"
                              />
                              <span className="truncate">{p.name}</span>
                            </div>
                            {selected && (
                              <Check className="size-3 text-foreground shrink-0 ml-1.5" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Reader Document Scope Selector */}
            {isReaderContext && onReaderDocScopeChange && (
              <Popover open={readerScopeOpen} onOpenChange={setReaderScopeOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 max-w-[200px] items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted px-2 text-11 text-foreground transition-colors cursor-pointer outline-none shrink-0"
                        aria-label="Paper context scope"
                      >
                        {readerDocScope === 'current' ? (
                          <FileText className="size-3 shrink-0 text-foreground" />
                        ) : (
                          <BookOpen className="size-3 shrink-0 text-foreground" />
                        )}
                        <span className="truncate font-medium">
                          {readerDocScope === 'current'
                            ? readerPaper?.title || 'This paper'
                            : readerDocScope === 'open-tabs'
                              ? `Open tabs (${openReaderPapers.length || 1})`
                              : 'Entire library'}
                        </span>
                        <ChevronDown className="size-2.5 text-muted-foreground shrink-0 opacity-70" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    Switch single-paper or multi-paper Q&A
                  </TooltipContent>
                </Tooltip>

                <PopoverContent
                  align="start"
                  side="top"
                  sideOffset={6}
                  className="w-64 p-1.5 rounded-md shadow-md z-50 border border-border bg-popover flex flex-col gap-0.5 select-none"
                >
                  <div className="px-2 py-1 text-10 font-medium text-muted-foreground">
                    Document scope
                  </div>
                  {readerPaper?.id && (
                    <button
                      type="button"
                      onClick={() => {
                        onReaderDocScopeChange('current');
                        setReaderScopeOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                        readerDocScope === 'current'
                          ? 'bg-muted text-foreground font-medium'
                          : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <span className="truncate">This paper only</span>
                      {readerDocScope === 'current' && <Check className="size-3 shrink-0" />}
                    </button>
                  )}
                  {openReaderPapers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        onReaderDocScopeChange('open-tabs');
                        setReaderScopeOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                        readerDocScope === 'open-tabs'
                          ? 'bg-muted text-foreground font-medium'
                          : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <span className="truncate">
                        All open tabs ({openReaderPapers.length})
                      </span>
                      {readerDocScope === 'open-tabs' && <Check className="size-3 shrink-0" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onReaderDocScopeChange('all');
                      setReaderScopeOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                      readerDocScope === 'all'
                        ? 'bg-muted text-foreground font-medium'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    <span className="truncate">Entire project library</span>
                    {readerDocScope === 'all' && <Check className="size-3 shrink-0" />}
                  </button>
                  {onOpenPicker && (
                    <>
                      <div className="my-1 border-t border-border/60" />
                      <button
                        type="button"
                        onClick={() => {
                          setReaderScopeOpen(false);
                          onOpenPicker('library');
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-11 text-left cursor-pointer hover:bg-muted text-foreground transition-colors"
                      >
                        <Plus className="size-3.5 shrink-0" />
                        <span>Select from Library...</span>
                      </button>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            )}

            {compact && onRemoveSource && (
              <AttachmentBar
                sources={sources}
                uploadingFiles={uploadingFiles}
                onRemoveSource={onRemoveSource}
                compact
              />
            )}
          </div>
        )}

        {!compact && onRemoveSource && (
          <AttachmentBar
            sources={sources}
            uploadingFiles={uploadingFiles}
            onRemoveSource={onRemoveSource}
            onToggleSource={onToggleSource}
          />
        )}

        {/* Quoted Passage Chip */}
        {quotedPassage && (
          <div className="flex items-start justify-between gap-2 mb-2 px-2.5 py-1.5 rounded-md bg-muted/60 border border-border text-11">
            <div className="flex flex-col min-w-0 flex-1 border-l border-border pl-2">
              <span className="text-10 text-muted-foreground font-medium truncate">
                Selected passage
                {quotedPassage.pageNumber ? ` • p. ${quotedPassage.pageNumber}` : ''}
              </span>
              <p className="text-11 text-foreground line-clamp-2 italic leading-snug mt-0.5 select-text">
                &ldquo;{quotedPassage.text}&rdquo;
              </p>
            </div>
            {onClearQuotedPassage && (
              <button
                type="button"
                onClick={onClearQuotedPassage}
                className="size-5 shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                aria-label="Remove quoted passage"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}

        {/* Prompt Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming || disabled}
          placeholder={placeholder}
          rows={compact ? 1 : 2}
          className={cn(
            'w-full resize-none bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none leading-relaxed',
            compact ? 'min-h-[32px] max-h-[140px] px-0.5 py-1' : 'min-h-[52px] max-h-[220px] px-1 py-1',
          )}
        />

        {/* Bottom Action Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1.5">
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={isStreaming || disabled}
                      className={cn(
                        'relative flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai',
                        compact ? 'size-7' : 'size-8',
                        sources.length > 0 && 'bg-muted',
                        (isStreaming || disabled) && 'opacity-40 cursor-not-allowed',
                      )}
                      aria-label="Add attachment or toggle features"
                    >
                      <Paperclip className="size-4 shrink-0 text-foreground" />
                      {sources.length > 0 && (
                        <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-ai text-white text-9 font-medium flex items-center justify-center">
                          {sources.length}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  Attachments & sources
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-56 p-1 rounded-lg shadow-lg border border-border bg-popover text-foreground select-none space-y-0.5"
              >
                {onUploadFiles && (
                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                  >
                    <Upload className="size-4 text-foreground shrink-0" />
                    <span>Upload from device</span>
                  </DropdownMenuItem>
                )}

                {onOpenPicker && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onOpenPicker('storage')}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                    >
                      <HardDrive className="size-4 text-foreground shrink-0" />
                      <span>Import from Storage</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => onOpenPicker('library')}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                    >
                      <BookOpen className="size-4 text-foreground shrink-0" />
                      <span>Import from Library</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => onOpenPicker('uploaded')}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                    >
                      <Database className="size-4 text-foreground shrink-0" />
                      <span>Uploaded documents</span>
                    </DropdownMenuItem>
                  </>
                )}

                {onWebSearchChange && (
                  <>
                    <DropdownMenuSeparator className="my-1 border-border/50" />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={webSearchEnabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onWebSearchChange(!webSearchEnabled);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted focus:bg-muted transition-colors cursor-pointer select-none text-foreground text-13 font-normal outline-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Globe className="size-4 text-foreground shrink-0" />
                        <span>Web search</span>
                      </div>
                      <div
                        className={cn(
                          'relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                          webSearchEnabled ? 'bg-ai' : 'bg-muted-foreground/30',
                        )}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block size-3 rounded-full bg-white transform transition duration-200',
                            webSearchEnabled ? 'translate-x-3' : 'translate-x-0',
                          )}
                        />
                      </div>
                    </button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {webSearchEnabled && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border/80 bg-ai/10 text-ai text-11 font-medium cursor-pointer hover:bg-ai/15 transition-colors"
                    title="Configure web search domains"
                  >
                    <Globe className="size-3 shrink-0" />
                    <span>Web</span>
                  </button>
                </PopoverTrigger>
                {onWebSearchSitesChange && (
                  <PopoverContent align="start" side="top" className="w-64 p-2.5 space-y-2">
                    <p className="text-11 font-medium text-foreground">
                      Allowed academic domains
                    </p>
                    <div className="flex gap-1">
                      <input
                        value={newSiteInput}
                        onChange={(e) => setNewSiteInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddWebSite();
                          }
                        }}
                        placeholder="e.g. arxiv.org"
                        className="flex-1 h-7 px-2 text-11 rounded border border-border bg-background outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddWebSite}
                        className="h-7 px-2 rounded bg-ai text-white text-11 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {webSearchSites.map((site) => (
                        <span
                          key={site}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-10 text-foreground"
                        >
                          {site}
                          <button
                            type="button"
                            onClick={() =>
                              onWebSearchSitesChange(
                                webSearchSites.filter((s) => s !== site),
                              )
                            }
                            className="hover:text-destructive cursor-pointer"
                            aria-label={`Remove ${site}`}
                          >
                            <X className="size-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            )}
          </div>

          {/* Right tools: Voice + Send/Stop */}
          <div className="flex items-center gap-1.5">
            {compact && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => toast.info('Voice input coming soon')}
                    disabled={isStreaming}
                    className="relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
                    aria-label="Voice input"
                  >
                    <Mic className="size-3.5 shrink-0 text-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  Voice input
                </TooltipContent>
              </Tooltip>
            )}

            {isStreaming ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onStop?.()}
                    className={cn(
                      'relative flex items-center justify-center rounded-md bg-ai text-white hover:bg-ai-hover transition-all active:scale-95 cursor-pointer',
                      compact ? 'size-7' : 'size-8',
                    )}
                    aria-label="Stop generating"
                  >
                    <Square className="size-3 fill-current" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  Stop generating
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSend}
                    className={cn(
                      'relative flex items-center justify-center rounded-md p-0 transition-all select-none',
                      compact ? 'size-7' : 'size-8',
                      uploadingActive
                        ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                        : !canSend
                          ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-40'
                          : 'bg-ai text-white hover:bg-ai-hover active:scale-95 cursor-pointer',
                    )}
                    aria-label={uploadingActive ? 'Processing documents...' : 'Send message'}
                  >
                    {uploadingActive ? (
                      <Loader2 className="size-3.5 animate-spin text-ai" />
                    ) : (
                      <ArrowUp className="size-3.5 shrink-0 stroke-[2.5] translate-y-[1px]" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {uploadingActive
                    ? 'Processing documents, please wait...'
                    : 'Send message'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {showDisclaimer && (
        <p className="text-10 text-muted-foreground text-center mt-1.5 select-none">
          Flux AI can make mistakes, please double-check responses.
        </p>
      )}
    </div>
  );
}
