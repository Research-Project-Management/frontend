'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Check,
  Archive,
  Sparkles,
  ExternalLink,
  Minimize2,
  Presentation,
  FileCode,
  FileType,
  BookOpen,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import {
  useCompileStore,
  usePageStore,
  useDocumentSettingsStore,
  type CompileStatus,
  type LaTeXEngine,
} from '@/features/editor/store';
import {
  exportProjectAsZip,
  exportArxivSubmissionZip,
  exportDocumentAsWord,
  exportDocumentAsMarkdown,
  getExportFilename,
  LatexCompilerEngine,
} from '@/features/editor/utils';
import { toast } from 'sonner';
import type { PdfOutlineItem } from '@/features/editor/utils/pdf-outline.util';

// ── Compile Button with Overleaf-Parity Dropdown Menu ────────────────────────

export interface CompileButtonProps {
  compileStatus: CompileStatus;
  onCompile: () => void;
  engine?: LaTeXEngine;
  setEngine?: (e: LaTeXEngine) => void;
  compileMode?: 'full' | 'draft';
  setCompileMode?: (m: 'full' | 'draft') => void;
  autoCompile?: boolean;
  onToggleAutoCompile?: () => void;
  onClearCacheAndCompile?: () => void;
  onStopCompilation?: () => void;
}

export const CompileButton = React.memo(function CompileButton({
  compileStatus,
  onCompile,
  engine: _engine,
  setEngine: _setEngine,
  compileMode: propCompileMode,
  setCompileMode: propSetCompileMode,
  autoCompile: propAutoCompile,
  onToggleAutoCompile,
  onClearCacheAndCompile,
  onStopCompilation,
}: CompileButtonProps) {
  const isRunning =
    compileStatus !== 'idle' && compileStatus !== 'done' && compileStatus !== 'error';
  const statusLabel: Record<string, string> = {
    flushing: 'Saving…',
    syncing: 'Syncing…',
    compiling: 'Compiling…',
  };

  const storeAutoCompile = useDocumentSettingsStore((s) => s.autoCompile);
  const storeSetAutoCompile = useDocumentSettingsStore((s) => s.setAutoCompile);
  const storeCompileMode = useDocumentSettingsStore((s) => s.compileMode);
  const storeSetCompileMode = useDocumentSettingsStore((s) => s.setCompileMode);
  const linterEnabled = useDocumentSettingsStore((s) => s.linterEnabled);
  const setLinterEnabled = useDocumentSettingsStore((s) => s.setLinterEnabled);
  const stopOnFirstError = useDocumentSettingsStore((s) => s.stopOnFirstError);
  const setStopOnFirstError = useDocumentSettingsStore((s) => s.setStopOnFirstError);

  const autoCompile = propAutoCompile !== undefined ? propAutoCompile : storeAutoCompile;
  const handleSetAutoCompile = (val: boolean) => {
    storeSetAutoCompile(val);
    if (onToggleAutoCompile && ((val && !autoCompile) || (!val && autoCompile))) {
      onToggleAutoCompile();
    }
  };

  const compileMode = propCompileMode !== undefined ? propCompileMode : storeCompileMode;
  const handleSetCompileMode = (mode: 'full' | 'draft') => {
    storeSetCompileMode(mode);
    propSetCompileMode?.(mode);
  };

  const handleStopCompilation = () => {
    if (onStopCompilation) {
      onStopCompilation();
    } else {
      LatexCompilerEngine.cancelInFlightCompile();
      useCompileStore.getState().setCompileStatus('idle');
      toast.info('Compilation stopped');
    }
  };

  return (
    <div className="flex items-center select-none">
      <button
        type="button"
        onClick={onCompile}
        disabled={isRunning}
        title="Recompile (Ctrl+Enter)"
        aria-label={
          isRunning
            ? statusLabel[compileStatus] ?? 'Compiling document…'
            : 'Recompile document (Ctrl+Enter)'
        }
        className="flex items-center gap-1.5 h-7 px-3 rounded-l-md bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold shadow-2xs transition-colors disabled:opacity-60 outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 cursor-pointer"
      >
        {isRunning && <Loader2 className="size-3.5 animate-spin shrink-0" />}
        <span>{isRunning ? statusLabel[compileStatus] ?? 'Compiling…' : 'Recompile'}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Compile options"
            className="flex items-center justify-center h-7 w-5 rounded-r-md bg-[#16a34a] hover:bg-[#15803d] text-white border-l border-white/20 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <ChevronDown className="size-3 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 z-[9999] p-1.5 text-xs">
          {/* Section 1: Auto compile */}
          <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground select-none">
            Auto compile
          </div>
          <DropdownMenuItem
            onClick={() => handleSetAutoCompile(true)}
            className="px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer rounded"
          >
            <span>On</span>
            {autoCompile && <Check className="size-3.5 text-foreground shrink-0 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleSetAutoCompile(false)}
            className="px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer rounded"
          >
            <span>Off</span>
            {!autoCompile && <Check className="size-3.5 text-foreground shrink-0 ml-auto" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5" />

          {/* Section 2: Compile mode */}
          <div className="px-2.5 pt-1 pb-1 text-[11px] font-medium text-muted-foreground select-none">
            Compile mode
          </div>
          <DropdownMenuItem
            onClick={() => handleSetCompileMode('full')}
            className="px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer rounded"
          >
            <span>Normal</span>
            {compileMode === 'full' && <Check className="size-3.5 text-foreground shrink-0 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleSetCompileMode('draft')}
            className="px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer rounded"
          >
            <span>
              Fast <span className="text-muted-foreground text-[11px] font-normal">[draft]</span>
            </span>
            {compileMode === 'draft' && <Check className="size-3.5 text-foreground shrink-0 ml-auto" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5" />

          {/* Section 3: Syntax checks */}
          <div className="px-2.5 pt-1 pb-1 text-[11px] font-medium text-muted-foreground select-none">
            Syntax checks
          </div>
          <DropdownMenuItem
            onClick={() => setLinterEnabled(true)}
            className="px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer rounded"
          >
            <span>Check syntax before compile</span>
            {linterEnabled && <Check className="size-3.5 text-foreground shrink-0 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setLinterEnabled(false)}
            className="px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer rounded"
          >
            <span>Don’t check syntax</span>
            {!linterEnabled && <Check className="size-3.5 text-foreground shrink-0 ml-auto" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5" />

          {/* Section 4: Compile error handling */}
          <div className="px-2.5 pt-1 pb-1 text-[11px] font-medium text-muted-foreground select-none">
            Compile error handling
          </div>
          <DropdownMenuItem
            onClick={() => setStopOnFirstError(true)}
            className="px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer rounded"
          >
            <span>Stop on first error</span>
            {stopOnFirstError && <Check className="size-3.5 text-foreground shrink-0 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setStopOnFirstError(false)}
            className="px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer rounded"
          >
            <span>Try to compile despite errors</span>
            {!stopOnFirstError && <Check className="size-3.5 text-foreground shrink-0 ml-auto" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5" />

          {/* Section 5: Actions */}
          <DropdownMenuItem
            disabled={!isRunning}
            onClick={handleStopCompilation}
            className={cn(
              "px-2.5 py-1.5 text-xs flex items-center cursor-pointer rounded",
              !isRunning
                ? "text-muted-foreground opacity-40 cursor-not-allowed hover:bg-transparent"
                : "text-foreground hover:bg-accent"
            )}
          >
            <span>Stop compilation</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={onClearCacheAndCompile}
            className="px-2.5 py-1.5 text-xs flex items-center cursor-pointer rounded hover:bg-accent"
          >
            <span>Recompile from scratch</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

// ── Main Viewer Toolbar ─────────────────────────────────────────────────────

export interface ToolbarProps {
  compileStatus: CompileStatus;
  engine: LaTeXEngine;
  setEngine?: (e: LaTeXEngine) => void;
  compileMode: 'full' | 'draft';
  setCompileMode: (m: 'full' | 'draft') => void;
  autoCompile?: boolean;
  onToggleAutoCompile?: () => void;
  onClearCacheAndCompile?: () => void;
  onStopCompilation?: () => void;
  onCompile: () => void;
  onForceSync?: () => void;
  // Zoom
  scale: number;
  autoFit: boolean;
  showZoomGroup?: boolean;
  onToggleAutoFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom?: () => void;
  onSetScale?: (scale: number) => void;
  // Pages
  pageNumber: number;
  numPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage?: (page: number) => void;
  // PDF Dark Mode / Invert
  invertColors?: boolean;
  onToggleInvertColors?: () => void;
  // Actions
  pdfUrl: string | null;
  compileLog: string;
  showLog: boolean;
  showUtilityGroup?: boolean;
  onToggleLog: () => void;
  onDownload: () => void;
  onPopout?: () => void;
  isPoppedOut?: boolean;
  outline?: PdfOutlineItem[];
  onOpenPresentationMode?: () => void;
  isSpreadView?: boolean;
  onToggleSpreadView?: () => void;
}

const Toolbar = React.memo(function Toolbar({
  compileStatus,
  engine,
  setEngine,
  compileMode,
  setCompileMode,
  autoCompile,
  onToggleAutoCompile,
  onClearCacheAndCompile,
  onStopCompilation,
  onCompile,
  scale,
  autoFit,
  showZoomGroup = true,
  onToggleAutoFit,
  onZoomIn,
  onZoomOut,
  onSetScale,
  pageNumber,
  numPages,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  invertColors = false,
  onToggleInvertColors,
  isSpreadView = false,
  onToggleSpreadView,
  pdfUrl,
  compileLog,
  showLog,
  showUtilityGroup = true,
  onToggleLog,
  onDownload,
  onPopout,
  isPoppedOut = false,
  onOpenPresentationMode,
}: ToolbarProps) {
  const [inputPage, setInputPage] = useState(String(pageNumber));

  useEffect(() => {
    setInputPage(String(pageNumber));
  }, [pageNumber]);

  const handlePageCommit = () => {
    const p = parseInt(inputPage, 10);
    if (!isNaN(p) && p >= 1 && p <= (numPages || 1)) {
      onJumpToPage?.(p);
    } else {
      setInputPage(String(pageNumber));
    }
  };

  const compileErrors = useCompileStore((s) => s.compileErrors);
  const errorCount = compileErrors.filter((e) => e.severity !== 'warning').length;
  const warningCount = compileErrors.filter((e) => e.severity === 'warning').length;
  const hasErrors = compileStatus === 'error' || errorCount > 0 || (compileLog && compileLog.includes('! '));

  const currentPage = usePageStore((s) => s.currentPage);
  const parentPageId = usePageStore((s) => s.parentPageId);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const getEditorContent = usePageStore((s) => s.getEditorContent);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingDoc, setIsExportingDoc] = useState(false);

  const rootId =
    parentPageId ||
    currentPage?.id ||
    (typeof currentPage?.projectId === 'string'
      ? currentPage.projectId
      : (currentPage?.projectId as any)?.id) ||
    '';

  const handleDownloadWord = async () => {
    if (!rootId) {
      toast.error('Document root ID not found');
      return;
    }
    setIsExportingDoc(true);
    try {
      await exportDocumentAsWord({
        pageId: rootId,
        projectTitle: currentPage?.title,
      });
    } finally {
      setIsExportingDoc(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    if (!rootId) {
      toast.error('Document root ID not found');
      return;
    }
    setIsExportingDoc(true);
    try {
      await exportDocumentAsMarkdown({
        pageId: rootId,
        projectTitle: currentPage?.title,
      });
    } finally {
      setIsExportingDoc(false);
    }
  };

  const handleDownloadSourceZip = async () => {
    if (!rootId) {
      toast.error('Document root ID not found');
      return;
    }
    setIsExportingZip(true);
    try {
      await exportProjectAsZip({
        parentPageId: rootId,
        projectTitle: currentPage?.title,
        currentContent: getEditorContent.current?.(),
        activeFileId: activeFilePage?.id,
        activeFileTitle: activeFilePage?.title,
      });
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleDownloadArxivZip = async () => {
    if (!rootId) {
      toast.error('Document root ID not found');
      return;
    }
    setIsExportingZip(true);
    try {
      await exportArxivSubmissionZip({
        parentPageId: rootId,
        projectTitle: currentPage?.title,
        currentContent: getEditorContent.current?.(),
        activeFileId: activeFilePage?.id,
        activeFileTitle: activeFilePage?.title,
      });
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleDownloadLog = () => {
    if (!compileLog) {
      toast.error('No compilation logs available to download.');
      return;
    }
    const blob = new Blob([compileLog], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getExportFilename(currentPage?.title, 'txt').replace(/\.txt$/, '')}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded compilation log (.log)');
  };

  return (
    <div className="h-9 border-b border-border bg-background flex items-center justify-between px-2.5 shrink-0 z-10 gap-2 select-none text-foreground">
      {/* ── Left Group: [Recompile ▾] [📄] [⬇] ─────────────────────────── */}
      <div className="flex items-center gap-1.5 shrink-0">
        <CompileButton
          compileStatus={compileStatus}
          onCompile={onCompile}
          engine={engine}
          setEngine={setEngine}
          compileMode={compileMode}
          setCompileMode={setCompileMode}
          autoCompile={autoCompile}
          onToggleAutoCompile={onToggleAutoCompile}
          onClearCacheAndCompile={onClearCacheAndCompile}
          onStopCompilation={onStopCompilation}
        />

        {/* Utility Group: Logs, Download, Popout */}
        {showUtilityGroup && (
          <>
            {/* Logs Button (📄) with Overleaf-parity error badge */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleLog}
                  aria-label="Logs and output files"
                  className={cn(
                    'flex h-7 px-2 items-center gap-1.5 rounded transition-colors cursor-pointer relative text-xs',
                    showLog
                      ? 'bg-muted text-foreground'
                      : 'text-foreground/80 hover:text-foreground hover:bg-muted',
                  )}
                >
                  <FileText className="size-3.5 shrink-0" />
                  {errorCount > 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white leading-none">
                      {errorCount}
                    </span>
                  ) : warningCount > 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white leading-none">
                      {warningCount}
                    </span>
                  ) : hasErrors ? (
                    <span className="size-1.5 rounded-full bg-rose-500 ring-2 ring-background" />
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Logs and output files {errorCount > 0 ? `(${errorCount} error${errorCount > 1 ? 's' : ''})` : warningCount > 0 ? `(${warningCount} warning${warningCount > 1 ? 's' : ''})` : ''}
              </TooltipContent>
            </Tooltip>

            {/* Download Dropdown (Overleaf Parity: PDF, Word .docx, Markdown .md, Source ZIP, arXiv ZIP, Logs) */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={isExportingZip || isExportingDoc}
                      aria-label="Download or export options"
                      className="flex size-7 items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer outline-none"
                    >
                      {isExportingZip || isExportingDoc ? (
                        <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                      ) : (
                        <Download className="size-3.5 shrink-0" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Download & Export</TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="start" className="w-56 text-xs z-[9999] p-1">
                {/* 1. PDF */}
                <DropdownMenuItem
                  onClick={onDownload}
                  disabled={!pdfUrl}
                  className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="size-4 text-rose-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">PDF Document (.pdf)</span>
                    <span className="text-[10px] text-muted-foreground">
                      {pdfUrl ? 'Latest compiled output' : 'Compile first to generate'}
                    </span>
                  </div>
                </DropdownMenuItem>

                {/* 2. Word (.docx) */}
                <DropdownMenuItem
                  onClick={handleDownloadWord}
                  disabled={isExportingDoc}
                  className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileType className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Word Document (.docx)</span>
                    <span className="text-[10px] text-muted-foreground">OpenXML / Office compatible</span>
                  </div>
                </DropdownMenuItem>

                {/* 3. Markdown (.md) */}
                <DropdownMenuItem
                  onClick={handleDownloadMarkdown}
                  disabled={isExportingDoc}
                  className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileCode className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Markdown Document (.md)</span>
                    <span className="text-[10px] text-muted-foreground">Clean GitHub Flavored Markdown</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                {/* 4. Source ZIP */}
                <DropdownMenuItem
                  onClick={handleDownloadSourceZip}
                  disabled={isExportingZip}
                  className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <Archive className="size-4 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Source Bundle (.zip)</span>
                    <span className="text-[10px] text-muted-foreground">All LaTeX files & image assets</span>
                  </div>
                </DropdownMenuItem>

                {/* 5. arXiv Package */}
                <DropdownMenuItem
                  onClick={handleDownloadArxivZip}
                  disabled={isExportingZip}
                  className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">arXiv Package (.zip)</span>
                    <span className="text-[10px] text-muted-foreground">Ready for arXiv submission</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

                {/* 6. Compile Log */}
                <DropdownMenuItem
                  onClick={handleDownloadLog}
                  disabled={!compileLog}
                  className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Compilation Log (.log)</span>
                    <span className="text-[10px] text-muted-foreground">Raw build log for debugging</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Popout / Reattach Button */}
            {onPopout && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onPopout}
                    aria-label={isPoppedOut ? "Reattach viewer" : "Detach viewer to new window"}
                    className="flex size-7 items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    {isPoppedOut ? (
                      <Minimize2 className="size-3.5 shrink-0" />
                    ) : (
                      <ExternalLink className="size-3.5 shrink-0" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isPoppedOut ? "Reattach PDF viewer" : "Open PDF in new window"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Presentation Mode Button (Overleaf Parity) */}
            {onOpenPresentationMode && pdfUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenPresentationMode}
                    aria-label="Presentation mode (Beamer slides) (F5)"
                    className="flex size-7 items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Presentation className="size-3.5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Presentation mode (Beamer slides) (F5)</TooltipContent>
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* ── Right Group: [🌓] [⌃] [⌄] [ 1 ] / 1  [−] [+] [102% ▾] ───────── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* PDF Dark mode / Invert colors toggle (🌓) */}
        {onToggleInvertColors && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleInvertColors}
                aria-label="Invert PDF colors (Dark mode)"
                className={cn(
                  'flex size-7 items-center justify-center rounded transition-colors cursor-pointer text-xs font-mono',
                  invertColors
                    ? 'bg-primary/15 text-primary shadow-2xs font-semibold'
                    : 'text-foreground/80 hover:text-foreground hover:bg-muted',
                )}
              >
                <span className="text-sm select-none leading-none">🌓</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Invert PDF colors (Dark mode)</TooltipContent>
          </Tooltip>
        )}

        {/* Two-page spread view toggle (📖) */}
        {onToggleSpreadView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleSpreadView}
                aria-label={isSpreadView ? "Switch to single page view" : "Two-page spread view"}
                className={cn(
                  'flex size-7 items-center justify-center rounded transition-colors cursor-pointer',
                  isSpreadView
                    ? 'bg-primary/15 text-primary shadow-2xs font-semibold'
                    : 'text-foreground/80 hover:text-foreground hover:bg-muted',
                )}
              >
                <BookOpen className="size-3.5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isSpreadView ? "Switch to single page view" : "Two-page spread view"}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Page Navigation: Vertical Chevrons & Editable Input */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onPrevPage}
                disabled={pageNumber <= 1}
                aria-label="Previous page"
                className="flex size-6 items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted disabled:opacity-35 transition-colors cursor-pointer"
              >
                <ChevronUp className="size-3.5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Previous page</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onNextPage}
                disabled={pageNumber >= numPages}
                aria-label="Next page"
                className="flex size-6 items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted disabled:opacity-35 transition-colors cursor-pointer"
              >
                <ChevronDown className="size-3.5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Next page</TooltipContent>
          </Tooltip>

          {/* Page input box: [ 1 ] / N */}
          <div className="flex items-center gap-1 ml-0.5">
            <input
              type="text"
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePageCommit();
              }}
              onBlur={handlePageCommit}
              className="h-6 w-9 rounded border border-border bg-background px-1 text-center font-mono text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-2xs"
            />
            <span className="font-mono text-xs text-muted-foreground">
              / {numPages || 1}
            </span>
          </div>
        </div>

        {/* Zoom controls: [ − ] [ + ] [ 102% ▾ ] */}
        {showZoomGroup && (
          <div className="flex items-center gap-0.5 pl-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onZoomOut}
                  aria-label="Zoom out"
                  className="flex size-6 items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Minus className="size-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Zoom out</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onZoomIn}
                  aria-label="Zoom in"
                  className="flex size-6 items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Plus className="size-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Zoom in</TooltipContent>
            </Tooltip>

            {/* Zoom Level Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-6 min-w-16 items-center justify-between gap-1 rounded border border-border bg-background px-2 text-xs font-mono font-medium text-foreground hover:bg-muted transition-colors cursor-pointer shadow-2xs ml-0.5"
                >
                  <span>{autoFit ? 'Fit' : `${Math.round(scale * 100)}%`}</span>
                  <ChevronDown className="size-2.5 opacity-60 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 z-[9999]">
                <DropdownMenuItem onClick={onToggleAutoFit} className="text-xs cursor-pointer">
                  <Check className={cn('size-3.5 mr-2 text-primary shrink-0', !autoFit && 'opacity-0')} />
                  <span className={cn('font-medium', autoFit && 'text-primary font-semibold')}>
                    Fit to Width
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => {
                      if (autoFit) onToggleAutoFit();
                      onSetScale?.(s);
                    }}
                    className="text-xs cursor-pointer flex items-center justify-between"
                  >
                    <span className="font-mono">{Math.round(s * 100)}%</span>
                    {!autoFit && Math.round(scale * 100) === Math.round(s * 100) && (
                      <Check className="size-3 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
});

export default Toolbar;
