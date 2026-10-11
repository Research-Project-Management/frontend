'use client';

import React, { useRef } from 'react';
import nextDynamic from 'next/dynamic';
import {
  ArrowUp,
  Square,
  X,
  Plus,
  Upload,
  HardDrive,
  BookOpen,
  Database,
  Globe,
  Loader2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import {
  ACCEPTED_TYPES,
  getFileMeta,
  QUICK_ACTIONS,
  type AttachedFile,
  type UploadingFileItem,
} from './ai-tab.helpers';

const LibraryPickerModal = nextDynamic(
  () =>
    import('@/features/ai/components/companion/LibraryPickerModal').then(
      (m) => m.LibraryPickerModal
    ),
  { ssr: false }
);

const StoragePickerModal = nextDynamic(
  () =>
    import('@/features/ai/components/companion/StoragePickerModal').then(
      (m) => m.StoragePickerModal
    ),
  { ssr: false }
);

const UploadedDocumentsModal = nextDynamic(
  () =>
    import('@/features/ai/components/companion/UploadedDocumentsModal').then(
      (m) => m.UploadedDocumentsModal
    ),
  { ssr: false }
);

export interface AiInputAreaProps {
  inputPrompt: string;
  setInputPrompt: (val: string) => void;
  onSendMessage: (customPrompt?: string) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  selectionContext: string | null;
  hasMessages: boolean;
  attachedFiles: AttachedFile[];
  uploadingFiles: UploadingFileItem[];
  onRemoveAttachedFile: (fileId: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (val: boolean) => void;
  currentProjectId: string | null;
  onLibraryAttached: (items: any[]) => void;
  onStorageAttached: (items: any[]) => void;
  onDocumentsAttached: (items: any[]) => void;
  isLibraryModalOpen: boolean;
  setIsLibraryModalOpen: (open: boolean) => void;
  isStorageModalOpen: boolean;
  setIsStorageModalOpen: (open: boolean) => void;
  isUploadedDocsModalOpen: boolean;
  setIsUploadedDocsModalOpen: (open: boolean) => void;
}

export function AiInputArea({
  inputPrompt,
  setInputPrompt,
  onSendMessage,
  onStopStreaming,
  isStreaming,
  selectionContext,
  hasMessages,
  attachedFiles,
  uploadingFiles,
  onRemoveAttachedFile,
  onFileUpload,
  webSearchEnabled,
  setWebSearchEnabled,
  currentProjectId,
  onLibraryAttached,
  onStorageAttached,
  onDocumentsAttached,
  isLibraryModalOpen,
  setIsLibraryModalOpen,
  isStorageModalOpen,
  setIsStorageModalOpen,
  isUploadedDocsModalOpen,
  setIsUploadedDocsModalOpen,
}: AiInputAreaProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  return (
    <div className="shrink-0 p-2.5 sm:p-3 bg-background select-none">
      {/* Quick action chips above textarea if conversation is active */}
      {hasMessages && (
        <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
          {QUICK_ACTIONS.slice(0, 3).map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => onSendMessage(act.prompt)}
              disabled={isStreaming}
              className="shrink-0 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-11 font-medium text-foreground hover:bg-muted hover:border-border transition-colors disabled:opacity-40 cursor-pointer"
            >
              {act.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="rounded-md border border-border/80 bg-muted/20 focus-within:border-ai/50 focus-within:bg-background transition-all p-2 flex flex-col gap-1.5">
        {/* Attached Files List */}
        {(attachedFiles.length > 0 || uploadingFiles.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap pb-1.5 pt-0.5 max-h-32 overflow-y-auto">
            {uploadingFiles.map((up) => {
              const isProcessing = up.stage === 'processing';
              return (
                <Tooltip key={up.id}>
                  <TooltipTrigger asChild>
                    <div className="inline-flex h-6.5 items-center gap-1.5 px-2 rounded-md border border-border/70 bg-muted/40 text-11 text-foreground transition-all select-none max-w-[240px] cursor-default">
                      <Loader2 className="size-3 animate-spin text-ai shrink-0 motion-reduce:animate-none" />
                      <span className="truncate max-w-[120px] font-medium">{up.name}</span>
                      <span className="text-10 text-muted-foreground font-mono shrink-0">
                        {isProcessing ? 'Indexing...' : `${up.progress}%`}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4} className="max-w-xs">
                    <p className="font-medium truncate">{up.name}</p>
                    <p className="text-10 text-muted-foreground">
                      {isProcessing
                        ? 'Extracting content & indexing vector store...'
                        : `Uploading: ${up.progress}%`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {attachedFiles.map((file) => {
              const meta = getFileMeta(file.name, file.size);
              const IconComp = meta.icon;
              return (
                <div
                  key={file.id}
                  className="group relative inline-flex h-6.5 items-center gap-1.5 px-2 rounded-md border border-border bg-background hover:bg-muted/50 text-11 text-foreground transition-all select-none max-w-[240px]"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 min-w-0 cursor-default">
                        <IconComp className={cn('size-3 shrink-0', meta.iconColor)} />
                        <span className="truncate max-w-[120px] font-medium">
                          {file.name}
                        </span>
                        {meta.sizeText && (
                          <span className="text-10 text-muted-foreground shrink-0">
                            {meta.sizeText}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4} className="max-w-xs">
                      <p className="font-medium truncate">{file.name}</p>
                      {meta.sizeText && (
                        <p className="text-10 text-muted-foreground">
                          {meta.sizeText} • Ready for AI
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onRemoveAttachedFile(file.id)}
                        className="size-4.5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted ml-0.5 cursor-pointer"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="size-2.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      Remove document
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={inputPrompt}
          onChange={handleTextareaChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
          placeholder={
            selectionContext
              ? 'Ask AI about the selected text...'
              : 'Ask AI about paper, LaTeX syntax...'
          }
          disabled={isStreaming}
          className="w-full resize-none bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none leading-relaxed min-h-[32px] max-h-[140px] px-0.5 py-1"
        />

        {/* Bottom Action Toolbar inside card */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={isStreaming}
                      className={cn(
                        'relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai',
                        isStreaming && 'opacity-40 cursor-not-allowed'
                      )}
                      aria-label="Add attachment or toggle features"
                    >
                      <Plus className="size-4 shrink-0 text-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  Add documents or tools
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-56 p-1 rounded-lg shadow-raised-100 border border-border bg-popover text-foreground select-none space-y-0.5"
              >
                <DropdownMenuItem
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                >
                  <Upload className="size-4 text-foreground shrink-0" />
                  <span>Upload from device</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setIsStorageModalOpen(true)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                >
                  <HardDrive className="size-4 text-foreground shrink-0" />
                  <span>Import from Storage</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setIsLibraryModalOpen(true)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                >
                  <BookOpen className="size-4 text-foreground shrink-0" />
                  <span>Import from Library</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setIsUploadedDocsModalOpen(true)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                >
                  <Database className="size-4 text-foreground shrink-0" />
                  <span>Uploaded documents</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                <div
                  role="menuitemcheckbox"
                  tabIndex={0}
                  aria-checked={webSearchEnabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setWebSearchEnabled(!webSearchEnabled);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setWebSearchEnabled(!webSearchEnabled);
                    }
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer select-none text-foreground text-13 font-normal"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Globe className="size-4 text-foreground shrink-0" />
                    <span>Web search</span>
                  </div>
                  <div
                    className={cn(
                      'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                      webSearchEnabled ? 'bg-ai' : 'bg-muted-foreground/30'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block size-3 rounded-full bg-background transform ring-0 transition duration-200 ease-in-out',
                        webSearchEnabled ? 'translate-x-3' : 'translate-x-0'
                      )}
                    />
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-1">
            {isStreaming ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onStopStreaming}
                    className="flex size-7 items-center justify-center rounded-md bg-ai text-white hover:bg-ai-hover transition-all active:scale-95 cursor-pointer"
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
                    onClick={() => onSendMessage()}
                    disabled={(!inputPrompt.trim() && attachedFiles.length === 0) || uploadingFiles.length > 0}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-md p-0 transition-all select-none',
                      uploadingFiles.length > 0
                        ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                        : (!inputPrompt.trim() && attachedFiles.length === 0)
                          ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-40'
                          : 'bg-ai text-white hover:bg-ai-hover active:scale-95 cursor-pointer'
                    )}
                    aria-label={uploadingFiles.length > 0 ? 'Processing documents...' : 'Send message'}
                  >
                    {uploadingFiles.length > 0 ? (
                      <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-ai" />
                    ) : (
                      <ArrowUp className="size-3.5 shrink-0 stroke-[2.5] translate-y-[1px]" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {uploadingFiles.length > 0 ? 'Processing documents...' : 'Send message (Enter)'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Hidden File Input for Device Upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={onFileUpload}
      />

      {/* Attachment Modals */}
      <LibraryPickerModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        projectId={currentProjectId}
        onSelectItems={onLibraryAttached}
      />

      <StoragePickerModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        projectId={currentProjectId}
        onSelectItems={onStorageAttached}
      />

      <UploadedDocumentsModal
        isOpen={isUploadedDocsModalOpen}
        onClose={() => setIsUploadedDocsModalOpen(false)}
        projectId={currentProjectId}
        onSelectItems={onDocumentsAttached}
      />
    </div>
  );
}
