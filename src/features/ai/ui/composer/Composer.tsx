'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  Database,
  FileText,
  FileUp,
  Globe,
  Loader2,
  Mic,
  Plus,
  Square,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  ACCEPTED_FILE_TYPES,
  type ContextTab,
  type SourceEntry,
  type UploadingFile,
} from '../../context/source.port';
import type { QuotedPassageData } from '../../engine/shell';
import { AttachmentBar } from './AttachmentBar';
import { ModelSelector } from './ModelSelector';

// Derived from backend retrieval budget: _MAX_MULTI_DOC_TOP_K (16) / _MIN_CHUNKS_PER_SCOPED_DOC (2)
export const MAX_READER_SCOPE_DOCS = 8;

export interface ComposerProps {
  variant?: 'workspace' | 'companion' | 'inline';
  placeholder?: string;
  className?: string;
  showDisclaimer?: boolean;
  initialValue?: string;
  draftRevision?: number;

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
  selectedReaderPaperIds?: readonly string[];
  onSelectedReaderPaperIdsChange?: (ids: string[]) => void;
  activeTabDriftPaper?: { id: string; title: string } | null;
  onAddDriftPaperToChat?: () => void;
  onNewChatForDriftPaper?: () => void;

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
  draftRevision = 0,

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
  selectedReaderPaperIds = [],
  onSelectedReaderPaperIdsChange,
  activeTabDriftPaper = null,
  onAddDriftPaperToChat,
  onNewChatForDriftPaper,

  quotedPassage = null,
  onClearQuotedPassage,

  isStreaming = false,
  disabled = false,
  onSend,
  onStop,
}: ComposerProps) {
  const compact = variant !== 'workspace';
  const [text, setText] = useState(initialValue);
  const [readerScopeOpen, setReaderScopeOpen] = useState(false);
  const [newSiteInput, setNewSiteInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (initialValue) {
      setText(initialValue);
      textareaRef.current?.focus();
    }
  }, [initialValue, draftRevision]);

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

  const uploadingActive = isUploading || uploadingFiles.length > 0;
  const canSend =
    Boolean(text.trim() || quotedPassage || sources.length > 0) &&
    !isStreaming &&
    !disabled &&
    !uploadingActive;

  const notifyIfUploading = () => {
    const isProcessing = uploadingFiles.some((f) => f.stage === 'processing');
    toast.info(
      isProcessing
        ? 'Documents are being processed. Please wait a moment...'
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

  const toolButtonClass = cn(
    'relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai',
    compact
      ? 'size-7 before:absolute before:-inset-2 md:before:hidden'
      : 'size-8 before:absolute before:-inset-1.5 md:before:hidden',
    (isStreaming || disabled) && 'opacity-40 cursor-not-allowed',
  );

  const webSearchButton = (
    <button
      type="button"
      disabled={isStreaming || disabled}
      aria-label="Web search"
      aria-pressed={!onWebSearchSitesChange ? webSearchEnabled : undefined}
      onClick={
        !onWebSearchSitesChange
          ? () => onWebSearchChange?.(!webSearchEnabled)
          : undefined
      }
      className={cn(
        toolButtonClass,
        webSearchEnabled
          ? 'border border-border/80 bg-ai/10 text-ai hover:bg-ai/15'
          : 'text-foreground hover:bg-muted',
      )}
    >
      <Globe className="size-4 shrink-0" aria-hidden="true" />
    </button>
  );

  const extraEnabledCount = sources.filter(
    (s) => s.enabled && !selectedReaderPaperIds.includes(s.id),
  ).length;
  const totalSelected = selectedReaderPaperIds.length + extraEnabledCount;
  const atDocLimit = totalSelected >= MAX_READER_SCOPE_DOCS;

  const readerTabsForPopover =
    openReaderPapers.length > 0
      ? openReaderPapers
      : readerPaper
        ? [readerPaper]
        : [];

  const resolvePaperTitle = (id: string) =>
    openReaderPapers.find((p) => p.id === id)?.title ||
    (readerPaper?.id === id ? readerPaper.title : undefined) ||
    'Current tab';

  const scopeTriggerLabel =
    selectedReaderPaperIds.length === 1
      ? resolvePaperTitle(selectedReaderPaperIds[0])
      : selectedReaderPaperIds.length > 1
        ? `${selectedReaderPaperIds.length} selected`
        : 'Add source';

  return (
    <div
      className={cn(
        variant === 'workspace'
          ? 'w-full max-w-3xl mx-auto relative'
          : 'w-full shrink-0 select-none',
        className,
      )}
    >
      {activeTabDriftPaper && (
        <div className="flex items-center justify-between gap-2 mb-1.5 px-2.5 py-1.5 rounded-md border border-border bg-muted/50 text-11">
          <span className="truncate text-muted-foreground min-w-0">
            Viewing:{' '}
            <span className="font-medium text-foreground">
              {activeTabDriftPaper.title}
            </span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {onAddDriftPaperToChat && (
              <button
                type="button"
                onClick={onAddDriftPaperToChat}
                disabled={atDocLimit}
                className="px-1.5 py-0.5 rounded border border-border bg-background hover:bg-muted text-10 font-medium text-foreground disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                + Add to chat
              </button>
            )}
            {onNewChatForDriftPaper && (
              <button
                type="button"
                onClick={onNewChatForDriftPaper}
                className="px-1.5 py-0.5 rounded bg-foreground text-background hover:opacity-90 text-10 font-medium cursor-pointer transition-opacity"
              >
                New chat
              </button>
            )}
          </div>
        </div>
      )}

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

        {/* Top bar: Reader scope + Attachment chips */}
        {(isReaderContext || sources.length > 0 || uploadingFiles.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {/* Reader Document Scope Selector */}
            {isReaderContext && onSelectedReaderPaperIdsChange && (
              <Popover open={readerScopeOpen} onOpenChange={setReaderScopeOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 max-w-[200px] items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted px-2 text-11 text-foreground transition-colors cursor-pointer outline-none shrink-0"
                        aria-label="Select sources"
                      >
                        {selectedReaderPaperIds.length <= 1 ? (
                          <FileText className="size-3 shrink-0 text-foreground" />
                        ) : (
                          <BookOpen className="size-3 shrink-0 text-foreground" />
                        )}
                        <span className="truncate font-medium">
                          {scopeTriggerLabel}
                        </span>
                        <ChevronDown className="size-2.5 text-muted-foreground shrink-0 opacity-70" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    Choose sources
                  </TooltipContent>
                </Tooltip>

                <PopoverContent
                  align="start"
                  side="top"
                  sideOffset={6}
                  className="w-72 p-1.5 rounded-md shadow-md z-50 border border-border bg-popover flex flex-col gap-0.5 select-none"
                >
                  {openReaderPapers.length > 1 && (
                    <div className="px-2 py-1 flex items-center justify-between gap-2 text-10 text-muted-foreground">
                      <div className="flex items-center gap-2.5 shrink-0">
                        {readerPaper?.id && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectedReaderPaperIdsChange([readerPaper.id]);
                              setReaderScopeOpen(false);
                            }}
                            className="hover:text-foreground cursor-pointer transition-colors"
                          >
                            Current
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const remainingCap = Math.max(
                              0,
                              MAX_READER_SCOPE_DOCS - extraEnabledCount,
                            );
                            const nextIds = openReaderPapers
                              .slice(0, remainingCap)
                              .map((p) => p.id);
                            onSelectedReaderPaperIdsChange(nextIds);
                          }}
                          className="hover:text-foreground cursor-pointer transition-colors"
                        >
                          All
                        </button>
                      </div>
                      <span className="tabular-nums">
                        {totalSelected}/{MAX_READER_SCOPE_DOCS}
                      </span>
                    </div>
                  )}
                  <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5">
                    {readerTabsForPopover.map((tab) => {
                      const isChecked = selectedReaderPaperIds.includes(tab.id);
                      const isDisabled = !isChecked && atDocLimit;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isChecked) {
                              onSelectedReaderPaperIdsChange(
                                selectedReaderPaperIds.filter((id) => id !== tab.id),
                              );
                            } else if (!atDocLimit) {
                              onSelectedReaderPaperIdsChange([
                                ...selectedReaderPaperIds,
                                tab.id,
                              ]);
                            }
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-11 text-left transition-colors',
                            isDisabled
                              ? 'opacity-45 cursor-not-allowed text-muted-foreground'
                              : isChecked
                                ? 'bg-muted text-foreground font-medium cursor-pointer'
                                : 'hover:bg-muted text-foreground cursor-pointer',
                          )}
                        >
                          <span
                            className={cn(
                              'size-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors',
                              isChecked
                                ? 'bg-foreground border-foreground text-background'
                                : 'border-border bg-background',
                            )}
                          >
                            {isChecked && (
                              <Check className="size-2.5" strokeWidth={2.5} />
                            )}
                          </span>
                          <span className="truncate flex-1">{tab.title}</span>
                        </button>
                      );
                    })}
                  </div>
                  {atDocLimit && (
                    <p className="px-2 pt-1 text-10 text-muted-foreground">
                      Limit: {MAX_READER_SCOPE_DOCS}
                    </p>
                  )}
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
                        <span>Add from Library</span>
                      </button>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            )}

            {onRemoveSource && (
              <AttachmentBar
                sources={sources}
                uploadingFiles={uploadingFiles}
                onRemoveSource={onRemoveSource}
                onToggleSource={onToggleSource}
                compact={compact}
              />
            )}
          </div>
        )}

        {/* Quoted Passage Chip */}
        {quotedPassage && (
          <div className="flex items-start justify-between gap-2 mb-2 px-2.5 py-1.5 rounded-md bg-muted/60 border border-border text-11">
            <div className="flex flex-col min-w-0 flex-1 border-l border-border pl-2">
              <span className="text-10 text-muted-foreground font-medium truncate">
                {quotedPassage.label || 'Selected passage'}
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
            {(onUploadFiles || onOpenPicker) && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={isStreaming || disabled}
                        className={cn(
                          toolButtonClass,
                          'text-foreground hover:bg-muted',
                          sources.length > 0 && 'bg-muted',
                        )}
                        aria-label="Add sources or files"
                      >
                        <Plus className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    Add sources
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
                      <Upload className="size-4 text-foreground shrink-0" aria-hidden="true" />
                      <span>Upload from device</span>
                    </DropdownMenuItem>
                  )}

                  {onOpenPicker && (
                    <>
                      <DropdownMenuItem
                        onClick={() => onOpenPicker('library')}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                      >
                        <BookOpen className="size-4 text-foreground shrink-0" aria-hidden="true" />
                        <span>Import from Library</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => onOpenPicker('uploaded')}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                      >
                        <Database className="size-4 text-foreground shrink-0" aria-hidden="true" />
                        <span>Uploaded documents</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {onWebSearchChange &&
              (onWebSearchSitesChange ? (
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>{webSearchButton}</PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      {webSearchEnabled ? 'Web search (on)' : 'Web search'}
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    align="start"
                    side="top"
                    sideOffset={8}
                    className="w-64 p-2.5 space-y-2.5"
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={webSearchEnabled}
                      onClick={() => onWebSearchChange(!webSearchEnabled)}
                      className="w-full flex items-center justify-between px-1.5 py-1 rounded-md hover:bg-muted focus:bg-muted transition-colors cursor-pointer select-none text-foreground text-13 font-normal outline-none focus-visible:ring-1 focus-visible:ring-ai"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="size-4 text-foreground shrink-0" aria-hidden="true" />
                        <span>Web search</span>
                      </div>
                      <div
                        className={cn(
                          'relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 motion-reduce:transition-none',
                          webSearchEnabled ? 'bg-ai' : 'bg-muted-foreground/30',
                        )}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block size-3 rounded-full transform transition duration-200 motion-reduce:transition-none',
                            webSearchEnabled
                              ? 'translate-x-3 bg-ai-foreground'
                              : 'translate-x-0 bg-card',
                          )}
                        />
                      </div>
                    </button>

                    <div
                      className={cn(
                        'pt-2 border-t border-border/60 space-y-2 transition-opacity',
                        !webSearchEnabled && 'opacity-60',
                      )}
                    >
                      <p className="text-11 font-medium text-foreground">
                        Allowed academic domains
                      </p>
                      <div className="flex gap-1">
                        <input
                          aria-label="Academic domain to allow"
                          value={newSiteInput}
                          onChange={(e) => setNewSiteInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddWebSite();
                            }
                          }}
                          placeholder="e.g. arxiv.org"
                          className="flex-1 h-7 px-2 text-11 rounded border border-border bg-background outline-none focus-visible:border-ai focus-visible:ring-1 focus-visible:ring-ai/30"
                        />
                        <button
                          type="button"
                          onClick={handleAddWebSite}
                          className="relative before:absolute before:-inset-2 md:before:hidden h-7 px-2 rounded bg-ai text-ai-foreground hover:bg-ai-hover text-11 font-medium cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
                        >
                          Add
                        </button>
                      </div>
                      {webSearchSites.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {webSearchSites.map((site) => (
                            <span
                              key={site}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-11 text-foreground"
                            >
                              {site}
                              <button
                                type="button"
                                onClick={() =>
                                  onWebSearchSitesChange(
                                    webSearchSites.filter((s) => s !== site),
                                  )
                                }
                                className="relative before:absolute before:-inset-2.5 md:before:hidden hover:text-destructive cursor-pointer rounded outline-none focus-visible:ring-1 focus-visible:ring-ai"
                                aria-label={`Remove ${site}`}
                              >
                                <X className="size-2.5" aria-hidden="true" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>{webSearchButton}</TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    {webSearchEnabled ? 'Web search (on)' : 'Web search'}
                  </TooltipContent>
                </Tooltip>
              ))}

            <ModelSelector compact={compact} disabled={isStreaming || disabled} />
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
        <p className="text-11 text-muted-foreground text-center mt-1.5 select-none">
          Flux AI can make mistakes, please double-check responses.
        </p>
      )}
    </div>
  );
}
