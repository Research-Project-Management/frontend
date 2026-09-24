'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Textarea,
  Switch,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/components/ui";
import {
  ArrowUp,
  Square,
  Globe,
  GlobeOff,
  Plus,
  ChevronDown,
  Check,
  Loader2,
  FileText,
  X,
  Folder,
  FileUp,
  Upload,
  PanelRightOpen,
  BookOpen,
  HardDrive,
  FileImage,
  FileSpreadsheet,
  FileCode,
  File,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/shared/lib/utils";
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { useChatMode } from '../../hooks/use-chat-mode';
import { useAiUIStore } from '../../store';
import { uploadDocument } from '../../services/chat.service';
import { SourcePickerModal } from '../modals/source-picker-modal';
import type { AgentId } from '../../types/chat.types';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.json,.ts,.tsx,.js,.py';

function formatBytes(bytes?: number) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const SHEET_EXTS = new Set(['xls', 'xlsx', 'csv']);
const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'md', 'txt',
]);

function getFileMeta(name: string, sourceType?: string, size?: number) {
  const parts = (name || '').split('.');
  const ext = parts.length > 1 ? (parts.pop() || '').toLowerCase() : '';
  const extLabel = ext ? ext.toUpperCase() : 'FILE';
  const sizeText = size ? formatBytes(size) : '';

  if (sourceType === 'library') {
    return {
      typeLabel: 'Library Paper',
      sizeText,
      icon: BookOpen,
      iconColor: 'text-primary bg-primary/10 border-primary/20',
    };
  }

  if (ext === 'pdf') {
    return {
      typeLabel: 'PDF',
      sizeText,
      icon: FileText,
      iconColor: 'text-destructive bg-destructive/10 border-destructive/20',
    };
  }

  if (IMAGE_EXTS.has(ext)) {
    return {
      typeLabel: extLabel,
      sizeText,
      icon: FileImage,
      iconColor: 'text-primary bg-primary/10 border-primary/20',
    };
  }

  if (SHEET_EXTS.has(ext)) {
    return {
      typeLabel: 'Spreadsheet',
      sizeText,
      icon: FileSpreadsheet,
      iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    };
  }

  if (CODE_EXTS.has(ext)) {
    return {
      typeLabel: extLabel,
      sizeText,
      icon: FileCode,
      iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    };
  }

  if (sourceType === 'storage') {
    return {
      typeLabel: 'Storage',
      sizeText,
      icon: HardDrive,
      iconColor: 'text-primary bg-primary/10 border-primary/20',
    };
  }

  return {
    typeLabel: extLabel,
    sizeText,
    icon: File,
    iconColor: 'text-muted-foreground bg-muted border-border',
  };
}

const STORAGE_KEY_WEB_SITES = 'flux_web_search_sites';
const DEFAULT_WEB_SITES = [
  'arxiv.org',
  'biorxiv.org',
  'medrxiv.org',
  'nature.com',
  'science.org',
  'ieee.org',
];

export interface ChatInputProps {
  onSend?: (
    text: string,
    projectId?: string,
    webSearchSites?: string[],
    intentHint?: string,
  ) => void;
  disabled?: boolean;
  initialProject?: string;
  initialMessage?: string;
  initialAgent?: AgentId | null;
  initialWebSearch?: boolean;
  className?: string;
}

export function ChatInput({
  onSend,
  disabled,
  initialProject,
  initialMessage,
  initialWebSearch,
  className,
}: ChatInputProps) {
  const { projects = [], isLoading: isLoadingProjects } = useProjects();
  const {
    sources = [],
    addSource,
    removeSource,
    toggleSource,
    setFluxDataEnabled,
  } = useChatMode();
  const { isSourcesOpen, toggleSources } = useAiUIStore();

  const [message, setMessage] = useState(initialMessage || '');
  const [webSearch, setWebSearch] = useState(Boolean(initialWebSearch));
  const [selectedProject, setSelectedProject] = useState<string>(initialProject || 'all');
  const [scopeOpen, setScopeOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'library' | 'storage'>('library');
  const [uploadingFiles, setUploadingFiles] = useState<
    Array<{
      id: string;
      name: string;
      size?: number;
      progress?: number;
      stage?: 'uploading' | 'processing';
    }>
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active non-archived projects
  const activeProjects = useMemo(() => {
    return (projects || []).filter((p: any) => !p.isArchived);
  }, [projects]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
    }
  }, [message]);

  useEffect(() => {
    setMessage(initialMessage || '');
  }, [initialMessage]);

  useEffect(() => {
    if (initialProject) {
      setSelectedProject(initialProject);
    }
  }, [initialProject]);

  // If no initial project passed, check localStorage for stored active project
  useEffect(() => {
    if (!initialProject && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('flux_active_project_id');
        if (stored && activeProjects.some((p: any) => p.id === stored)) {
          setSelectedProject(stored);
        }
      } catch {}
    }
  }, [initialProject, activeProjects]);

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const processFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const targetScope = selectedProject === 'all' || !selectedProject ? 'me' : selectedProject;
      const tempItems = files.map((f, idx) => ({
        id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        name: f.name,
        size: f.size,
        progress: 0,
        stage: 'uploading' as const,
      }));

      setUploadingFiles((prev) => [...prev, ...tempItems]);

      let successCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const tempId = tempItems[i].id;
        try {
          const res = await uploadDocument(targetScope, file, (progress) => {
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
          addSource(res.id, res.name, {
            size: res.size || file.size,
            sourceType: 'upload',
          });
          successCount++;
        } catch (err: any) {
          toast.error(`Failed to upload ${file.name}: ${err?.message || 'Upload error'}`);
        } finally {
          setUploadingFiles((prev) => prev.filter((item) => item.id !== tempId));
        }
      }

      if (successCount > 0) {
        setFluxDataEnabled(true);
        toast.success(`Attached ${successCount} file(s) to AI context`);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [selectedProject, addSource, setFluxDataEnabled],
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const [webSearchOpen, setWebSearchOpen] = useState(false);
  const [newSiteInput, setNewSiteInput] = useState('');
  const [webSites, setWebSites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_WEB_SITES);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_WEB_SITES;
  });

  const saveWebSites = (sites: string[]) => {
    setWebSites(sites);
    try {
      localStorage.setItem(STORAGE_KEY_WEB_SITES, JSON.stringify(sites));
    } catch {}
  };

  const handleAddSite = (siteToAdd?: string) => {
    const raw = (siteToAdd || newSiteInput).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!raw) return;
    if (!webSites.includes(raw)) {
      const next = [...webSites, raw];
      saveWebSites(next);
      if (!webSearch) setWebSearch(true);
    }
    setNewSiteInput('');
  };

  const handleRemoveSite = (siteToRemove: string) => {
    const next = webSites.filter((s) => s !== siteToRemove);
    saveWebSites(next);
  };

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;
    const finalProjectId = selectedProject === 'all' || !selectedProject ? undefined : selectedProject;
    onSend?.(
      message.trim(),
      finalProjectId,
      webSearch ? (webSites.length > 0 ? webSites : ['*']) : undefined,
    );
    setMessage('');
  }, [message, disabled, selectedProject, onSend, webSearch, webSites]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isAllProjects = selectedProject === 'all' || !selectedProject;
  const currentProjObj = activeProjects.find((p: any) => p.id === selectedProject);
  const currentProjName = isAllProjects
    ? 'All Projects'
    : currentProjObj?.name || 'All Projects';

  return (
    <div className={cn("w-full max-w-3xl mx-auto relative", className)}>
      {/* Source Picker Modal (Library & Storage) */}
      <SourcePickerModal
        open={sourcePickerOpen}
        onOpenChange={setSourcePickerOpen}
        projectId={selectedProject === 'all' ? undefined : selectedProject}
        initialTab={modalTab}
      />

      {/* Main chat input container with Drag & Drop */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg border border-border bg-background shadow-2xs transition-all p-3 sm:p-3.5",
          isDragging && "border-primary/70 ring-2 ring-primary/20 bg-primary/[0.02]"
        )}
      >
        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 rounded-lg bg-background/95 backdrop-blur-xs border-2 border-dashed border-primary flex flex-col items-center justify-center gap-2 pointer-events-none transition-all">
            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <FileUp className="size-5 transition-transform duration-300 ease-out animate-pulse motion-reduce:animate-none" />
            </div>
            <p className="text-12 font-medium text-foreground">Drop files here to attach</p>
            <p className="text-10 text-muted-foreground">PDF, Word, Images, Spreadsheets, Code</p>
          </div>
        )}

        {/* ── Top-Left: Scope Project Badge ───────────────────────────────────── */}
        <div className="flex items-center justify-between mb-1.5">
          <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted px-2 py-1 text-12 font-medium text-foreground transition-colors cursor-pointer outline-none shadow-2xs"
              >
                <Folder className="size-3.5 text-muted-foreground shrink-0" />
                <span className="max-w-44 truncate">{currentProjName}</span>
                <ChevronDown className="size-3 text-muted-foreground shrink-0 opacity-70" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={6}
              className="w-56 p-1 rounded-md shadow-md z-50 max-h-72 overflow-y-auto"
            >
              {/* All Projects Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedProject('all');
                  setScopeOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors",
                  isAllProjects
                    ? "bg-muted text-foreground font-medium"
                    : "hover:bg-muted text-foreground/80 font-normal"
                )}
              >
                <span className="truncate">All Projects</span>
                {isAllProjects && <Check className="size-3.5 text-foreground shrink-0 ml-2" />}
              </button>

              <div className="my-1 border-t border-border/50" />

              {isLoadingProjects && (
                <div className="flex items-center gap-2 px-2.5 py-2 text-12 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                  <span>Loading projects...</span>
                </div>
              )}

              {!isLoadingProjects && activeProjects.length === 0 && (
                <div className="px-2.5 py-2 text-12 text-muted-foreground italic">
                  No projects
                </div>
              )}

              {!isLoadingProjects && activeProjects.map((proj: any) => {
                const isSelected = selectedProject === proj.id;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      setSelectedProject(proj.id);
                      setScopeOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors",
                      isSelected
                        ? "bg-muted text-foreground font-medium"
                        : "hover:bg-muted text-foreground/80 font-normal"
                    )}
                  >
                    <span className="truncate">{proj.name}</span>
                    {isSelected && <Check className="size-3.5 text-foreground shrink-0 ml-2" />}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>

        {/* ── ChatGPT-style Attached Files & Uploads Container ───────────────────────────────── */}
        {(sources.length > 0 || uploadingFiles.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap px-1 pt-0.5 pb-2.5 border-b border-border/40 mb-1 max-h-48 overflow-y-auto">
            {/* Uploading File Cards */}
            {uploadingFiles.map((up) => {
              const isProcessing = up.stage === 'processing';
              return (
                <div
                  key={up.id}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border/70 bg-muted/40 max-w-[240px] shadow-2xs"
                >
                  <div className="size-7 rounded-md flex items-center justify-center shrink-0 border border-border/50 bg-background text-primary">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-11 font-medium text-foreground truncate">{up.name}</p>
                    <div className="flex items-center gap-1.5 text-10 text-muted-foreground">
                      <span className={isProcessing ? "text-primary font-medium" : ""}>
                        {isProcessing ? 'Indexing vectors...' : `Uploading (${up.progress ?? 0}%)`}
                      </span>
                      {up.size ? <span>• {formatBytes(up.size)}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Attached Source Cards */}
            {sources.map((src) => {
              const meta = getFileMeta(src.name, src.sourceType, src.size);
              const IconComp = meta.icon;
              return (
                <div
                  key={src.id}
                  onClick={() => toggleSource(src.id)}
                  className={cn(
                    "group relative flex items-center gap-2.5 px-3 py-1.5 rounded-md border text-left cursor-pointer transition-all max-w-[240px] shadow-2xs select-none",
                    src.enabled
                      ? "bg-card hover:bg-muted/50 border-border"
                      : "bg-muted/30 border-border/40 opacity-55 hover:opacity-80"
                  )}
                  title={`${src.name} (${src.enabled ? 'Enabled in AI context - click to disable' : 'Disabled - click to enable'})`}
                >
                  {/* File Icon Badge */}
                  <div
                    className={cn(
                      "size-7 rounded-md flex items-center justify-center shrink-0 border",
                      meta.iconColor
                    )}
                  >
                    <IconComp className="size-3.5" />
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-11 font-medium truncate",
                        src.enabled ? "text-foreground" : "text-muted-foreground line-through"
                      )}
                    >
                      {src.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-10 text-muted-foreground">
                      <span>{meta.typeLabel}</span>
                      {meta.sizeText && (
                        <>
                          <span>•</span>
                          <span>{meta.sizeText}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Remove X Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSource(src.id);
                    }}
                    className="size-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0 ml-0.5 outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    aria-label={`Remove ${src.name}`}
                    title={`Remove ${src.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Textarea ───────────────────────────────────────────────────────── */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today?"
          disabled={disabled}
          className="w-full min-h-[64px] max-h-[220px] border-0 bg-transparent px-1 py-1.5 text-13 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none placeholder:text-muted-foreground text-foreground"
        />

        {/* ── Bottom Action Bar ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 pt-2">
          {/* Left tools: + button and indicators */}
          <div className="flex items-center gap-1">
            {/* Hidden File Input for Direct Upload */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Attach Sources Button (+) with Dropdown Menu */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative size-8 flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary",
                        (sources.length > 0 || isSourcesOpen) && "bg-muted"
                      )}
                      aria-label="Add sources or toggle features"
                      title="Add attachment or toggle features"
                    >
                      <Plus className="size-4 shrink-0 text-foreground" />
                      {sources.length > 0 && (
                        <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-primary text-white text-9 font-medium flex items-center justify-center shadow-2xs">
                          {sources.length}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Add attachment or toggle features
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-56 p-1 rounded-lg shadow-lg border border-border bg-popover text-foreground select-none space-y-0.5"
              >
                {/* 1. Upload from computer */}
                <DropdownMenuItem
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                >
                  <Upload className="size-4 text-foreground shrink-0" />
                  <span>Upload from device</span>
                </DropdownMenuItem>

                {/* 2. Upload from Storage */}
                <DropdownMenuItem
                  onClick={() => {
                    setModalTab('storage');
                    setSourcePickerOpen(true);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                >
                  <HardDrive className="size-4 text-foreground shrink-0" />
                  <span>Upload from storage</span>
                </DropdownMenuItem>

                {/* 3. Import from Library */}
                <DropdownMenuItem
                  onClick={() => {
                    setModalTab('library');
                    setSourcePickerOpen(true);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                >
                  <BookOpen className="size-4 text-foreground shrink-0" />
                  <span>Import from Library</span>
                </DropdownMenuItem>

                {/* 4. Sources Panel */}
                <DropdownMenuItem
                  onClick={toggleSources}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PanelRightOpen className="size-4 text-foreground shrink-0" />
                    <span>Sources panel</span>
                  </div>
                  {isSourcesOpen && <Check className="size-3 text-foreground shrink-0" />}
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 border-border/50" />

                {/* 5. Web search toggle inside */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setWebSearch(!webSearch);
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer select-none text-foreground text-13 font-normal"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Globe className="size-4 text-foreground shrink-0" />
                    <span>Web search</span>
                  </div>
                  <div
                    className={cn(
                      'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                      webSearch ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block size-3 rounded-full bg-white shadow-xs transform ring-0 transition duration-200 ease-in-out',
                        webSearch ? 'translate-x-3' : 'translate-x-0'
                      )}
                    />
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Indicator button when Sources panel is open */}
            {isSourcesOpen && (
              <button
                type="button"
                onClick={toggleSources}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-10 font-medium bg-muted hover:bg-muted/80 text-foreground select-none cursor-pointer"
                title="Click to close sources panel"
              >
                <PanelRightOpen className="size-3 shrink-0 text-foreground" />
                <span>Sources open</span>
              </button>
            )}
          </div>

          {/* Right tools: Send or Stop button */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!message.trim() && !disabled}
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center p-0 transition-all shrink-0 cursor-pointer shadow-2xs select-none",
                    disabled
                      ? "bg-primary text-white hover:bg-primary-hover cursor-pointer"
                      : "bg-primary text-white hover:bg-primary-hover active:scale-95 disabled:cursor-not-allowed"
                  )}
                  aria-label={disabled ? "Stop generating" : "Send message"}
                >
                  {disabled ? (
                    <Square className="size-3 fill-current shrink-0" />
                  ) : (
                    <ArrowUp className="size-3.5 shrink-0 stroke-[2.5] translate-y-[1px]" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {disabled ? "Stop generating" : "Send message"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInput;
