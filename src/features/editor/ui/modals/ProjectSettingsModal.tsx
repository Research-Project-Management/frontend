'use client';

/**
 * ProjectSettingsModal.tsx
 *
 * Canonical Project Settings, Sync, and Formatting Modal (Block 7: UI Shell / Modals Layer).
 * Location: `features/editor/ui/modals/ProjectSettingsModal.tsx`
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  X,
  FileText,
  BookOpen,
  Paintbrush,
  Settings,
  Landmark,
  ExternalLink,
  Plus,
  Trash2,
  Download,
  FileDown,
  Loader2,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { apiPost, apiDelete } from '@/shared/lib/api';
import { exportProjectAsZip } from '@/features/editor/coordinators/services/archive-export.service';
import { useSpellingDictionary } from '@/features/editor/ui/hooks/use-spelling';
import { ProjectReferencesTab, ProjectGithubTab } from './project-settings';
import { GitHubIcon } from '@/shared/components/icons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { learnedWordSchema, type LearnedWordFormValues } from '@/features/editor/domain/types';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/shared/lib/utils';
import {
  useSettingsStore,
  usePageStore,
  useCompilerStore,
  type CompilerEngine,
  type KeybindingMode,
  type EditorTheme,
} from '@/features/editor/store';
import { EDITOR_THEMES } from '@/features/editor/engines';
import { useTheme } from '@/shared/providers';
import { filesQuery, pageQuery, useFileActions } from '@/features/editor/ui/hooks/use-core';
import { useQuery } from '@tanstack/react-query';
import { editorCommandBus } from '@/features/editor/coordinators';

export const EDITOR_FONT_FAMILIES = [
  { id: 'default', label: 'Default Monospace (Monaco / Menlo)' },
  { id: 'fira', label: 'Fira Code' },
  { id: 'jetbrains', label: 'JetBrains Mono' },
  { id: 'consolas', label: 'Consolas' },
  { id: 'source-code', label: 'Source Code Pro' },
  { id: 'courier', label: 'Courier New' },
  { id: 'inconsolata', label: 'Inconsolata' },
];

export const EDITOR_FONT_SIZES = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24];

type SettingsTab =
  | 'editor'
  | 'compiler'
  | 'references'
  | 'github'
  | 'appearance'
  | 'notifications';

// ── Overleaf 1:1 Code Icon (<>) ────────────────────────────────────────────────
function CodeIconBrackets({ className = 'size-4 shrink-0' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="8 7 3 12 8 17" />
      <polyline points="16 7 21 12 16 17" />
    </svg>
  );
}

// ── Overleaf 1:1 Switch (Toggle) ──────────────────────────────────────────────
function OverleafSwitch({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'cursor-pointer transition-colors',
        'data-[state=checked]:bg-primary',
        'data-[state=unchecked]:bg-muted-foreground/30',
        'h-[22px] w-[40px]'
      )}
    />
  );
}

// ── Overleaf Setting Row (Title, Subtitle, Control) ────────────────────────────
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-8 py-3.5 border-b border-border/30 last:border-b-0">
      <div className="min-w-0 flex-1 pr-4">
        <h4 className="text-sm font-medium text-foreground leading-snug">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

export default function ProjectSettingsModal() {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const pageId = params?.pageId;
  const projectId = params?.projectId || params?.pageId || currentPage?.id;
  const projectTitle = currentPage?.title || 'manuscript';

  const {
    settingsPanelOpen,
    setSettingsPanelOpen,
    engine,
    setEngine,
    texLiveVersion,
    setTexLiveVersion,
    mainFile,
    setMainFile,
    autoCompile,
    setAutoCompile,
    compileMode,
    setCompileMode,
    useCache,
    setUseCache,
    stopOnFirstError,
    setStopOnFirstError,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    lineHeight,
    setLineHeight,
    wordWrap,
    setWordWrap,
    lineNumbers,
    setLineNumbers,
    keybinding,
    setKeybinding,
    editorTheme,
    setEditorTheme,
    spellCheck,
    setSpellCheck,
    spellCheckLanguage,
    setSpellCheckLanguage,
    autoCloseBrackets,
    setAutoCloseBrackets,
    linterEnabled,
    setLinterEnabled,
    autoComplete,
    setAutoComplete,
    nonBlinkingCursor,
    setNonBlinkingCursor,
    showEditorTabs,
    setShowEditorTabs,
    previewEditorTabs,
    setPreviewEditorTabs,
    pdfViewer,
    setPdfViewer,
    notifyComments,
    setNotifyComments,
    notifyUpdates,
    setNotifyUpdates,
  } = useSettingsStore(
    useShallow((s) => ({
      settingsPanelOpen: s.settingsPanelOpen,
      setSettingsPanelOpen: s.setSettingsPanelOpen,
      engine: s.engine,
      setEngine: s.setEngine,
      texLiveVersion: s.texLiveVersion,
      setTexLiveVersion: s.setTexLiveVersion,
      mainFile: s.mainFile,
      setMainFile: s.setMainFile,
      autoCompile: s.autoCompile,
      setAutoCompile: s.setAutoCompile,
      compileMode: s.compileMode,
      setCompileMode: s.setCompileMode,
      useCache: s.useCache,
      setUseCache: s.setUseCache,
      stopOnFirstError: s.stopOnFirstError,
      setStopOnFirstError: s.setStopOnFirstError,
      fontSize: s.fontSize,
      setFontSize: s.setFontSize,
      fontFamily: s.fontFamily,
      setFontFamily: s.setFontFamily,
      lineHeight: s.lineHeight,
      setLineHeight: s.setLineHeight,
      wordWrap: s.wordWrap,
      setWordWrap: s.setWordWrap,
      lineNumbers: s.lineNumbers,
      setLineNumbers: s.setLineNumbers,
      keybinding: s.keybinding,
      setKeybinding: s.setKeybinding,
      editorTheme: s.editorTheme,
      setEditorTheme: s.setEditorTheme,
      spellCheck: s.spellCheck,
      setSpellCheck: s.setSpellCheck,
      spellCheckLanguage: s.spellCheckLanguage,
      setSpellCheckLanguage: s.setSpellCheckLanguage,
      autoCloseBrackets: s.autoCloseBrackets,
      setAutoCloseBrackets: s.setAutoCloseBrackets,
      linterEnabled: s.linterEnabled,
      setLinterEnabled: s.setLinterEnabled,
      autoComplete: s.autoComplete,
      setAutoComplete: s.setAutoComplete,
      nonBlinkingCursor: s.nonBlinkingCursor,
      setNonBlinkingCursor: s.setNonBlinkingCursor,
      showEditorTabs: s.showEditorTabs,
      setShowEditorTabs: s.setShowEditorTabs,
      previewEditorTabs: s.previewEditorTabs,
      setPreviewEditorTabs: s.setPreviewEditorTabs,
      pdfViewer: s.pdfViewer,
      setPdfViewer: s.setPdfViewer,
      notifyComments: s.notifyComments,
      setNotifyComments: s.setNotifyComments,
      notifyUpdates: s.notifyUpdates,
      setNotifyUpdates: s.setNotifyUpdates,
    }))
  );

  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor');

  // Query project files to populate Main Document and Bib files
  const { data: projectFiles } = useQuery({
    ...filesQuery(pageId ?? projectId ?? ''),
    enabled: Boolean(pageId || projectId),
  });

  const { data: parentPage } = useQuery({
    ...pageQuery(pageId ?? ''),
    enabled: Boolean(pageId),
  });

  const { setMainFile: setMainFileMutation } = useFileActions();

  const handleMainFileChange = (newMainFileName: string) => {
    setMainFile(newMainFileName);
    const targetFile = (projectFiles as any[])?.find(
      (f: any) => (f.title || f.name || f.filename) === newMainFileName
    );
    const effectiveProjectId =
      (typeof currentPage?.projectId === 'string' ? currentPage.projectId : (currentPage?.projectId as any)?.id) ||
      projectId ||
      pageId ||
      '';
    if (targetFile && (pageId || projectId)) {
      setMainFileMutation.mutate({ pageId: (pageId || projectId)!, fileId: targetFile.id, projectId: effectiveProjectId });
    } else if ((pageId || projectId) && parentPage && (parentPage.title === newMainFileName || newMainFileName === 'main.tex')) {
      setMainFileMutation.mutate({ pageId: (pageId || projectId)!, fileId: parentPage.id, projectId: effectiveProjectId });
    }
  };

  const texFiles = useMemo(() => {
    const list: string[] = [];
    if (parentPage?.title) {
      const rootTitle = parentPage.title.endsWith('.tex') ? parentPage.title : `${parentPage.title}.tex`;
      list.push(rootTitle);
    }
    if (projectFiles && Array.isArray(projectFiles)) {
      projectFiles.forEach((f: any) => {
        const name = f.title || f.name || f.filename;
        if (typeof name === 'string' && name.toLowerCase().endsWith('.tex') && !list.includes(name)) {
          list.push(name);
        }
      });
    }
    if (list.length === 0) list.push('main.tex');
    return list;
  }, [parentPage?.title, projectFiles]);

  const bibFiles = useMemo(() => {
    const list: string[] = [];
    if (projectFiles && Array.isArray(projectFiles)) {
      projectFiles.forEach((f: any) => {
        const name = f.title || f.name || f.filename;
        if (typeof name === 'string' && name.toLowerCase().endsWith('.bib') && !list.includes(name)) {
          list.push(name);
        }
      });
    }
    if (list.length === 0) list.push('references.bib');
    return list;
  }, [projectFiles]);

  const {
    userWords,
    addWord,
    removeWord,
  } = useSpellingDictionary(undefined, settingsPanelOpen && activeTab === 'editor');

  const {
    register: registerWord,
    handleSubmit: handleSubmitWord,
    reset: resetWord,
    formState: { errors: wordErrors },
  } = useForm<LearnedWordFormValues>({
    resolver: zodResolver(learnedWordSchema),
    defaultValues: { word: '' },
  });

  const handleAddWord = (data: LearnedWordFormValues) => {
    addWord({ word: data.word.toLowerCase(), isProject: false });
    resetWord();
  };

  const handleRemoveWord = (word: string) => {
    removeWord({ word, isProject: false });
  };

  const pdfUrl = useCompilerStore((s) => s.pdfUrl);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  const handleClearCache = async () => {
    const effectiveProjectId =
      (typeof currentPage?.projectId === 'string'
        ? currentPage.projectId
        : (currentPage?.projectId as any)?.id) ||
      projectId ||
      pageId;

    if (!effectiveProjectId) {
      toast.info('No active project found to clear cache.');
      return;
    }

    setIsClearingCache(true);
    try {
      await apiPost(`/api/v1/manuscripts/projects/${effectiveProjectId}/clean-aux`);
      toast.success('Cached files cleared. Next compilation will start fresh from scratch.');
      editorCommandBus.dispatch({ type: 'compiler:trigger', forceSync: true });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:trigger-compile', { detail: { forceSync: true } }));
      }
    } catch {
      try {
        await apiDelete(`/api/v1/manuscripts/projects/${effectiveProjectId}/artifacts`);
        toast.success('Cached files cleared.');
        editorCommandBus.dispatch({ type: 'compiler:trigger', forceSync: true });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('flux:trigger-compile', { detail: { forceSync: true } }));
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to clear cached files');
      }
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleDownloadZip = async () => {
    const effectivePageId = pageId || projectId || '';
    if (!effectivePageId) {
      toast.error('No project available for download');
      return;
    }
    setIsExportingZip(true);
    try {
      toast.loading('Preparing project archive...', { id: 'download-zip' });
      await exportProjectAsZip({
        parentPageId: effectivePageId,
        projectTitle: projectTitle || currentPage?.title || 'project',
      });
      toast.success('Project archive downloaded', { id: 'download-zip' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate ZIP archive', { id: 'download-zip' });
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) {
      toast.error('No compiled PDF available to download. Please recompile first.');
      return;
    }
    const filename = `${(projectTitle || currentPage?.title || 'document').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}.pdf`;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('PDF download started');
  };

  const navTabs = [
    { id: 'editor' as const, label: 'Editor', icon: CodeIconBrackets },
    { id: 'compiler' as const, label: 'Compiler', icon: FileText },
    { id: 'references' as const, label: 'References', icon: BookOpen },
    { id: 'github' as const, label: 'GitHub Sync', icon: GitHubIcon },
    { id: 'appearance' as const, label: 'Appearance', icon: Paintbrush },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % navTabs.length;
      setActiveTab(navTabs[nextIndex].id);
      document.getElementById(`settings-tab-${navTabs[nextIndex].id}`)?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + navTabs.length) % navTabs.length;
      setActiveTab(navTabs[prevIndex].id);
      document.getElementById(`settings-tab-${navTabs[prevIndex].id}`)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveTab(navTabs[0].id);
      document.getElementById(`settings-tab-${navTabs[0].id}`)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveTab(navTabs[navTabs.length - 1].id);
      document.getElementById(`settings-tab-${navTabs[navTabs.length - 1].id}`)?.focus();
    }
  };

  return (
    <Dialog open={settingsPanelOpen} onOpenChange={setSettingsPanelOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[840px] md:max-w-[880px] lg:max-w-[920px] w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-300 rounded-xl text-foreground select-none flex flex-col max-h-[88vh] h-[620px]"
      >
        {/* ── Dialog Header (Clean, seamless, zero divider lines) ─────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 bg-background shrink-0">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
            Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Project and editor preferences configuration
          </DialogDescription>
          <button
            type="button"
            onClick={() => setSettingsPanelOpen(false)}
            aria-label="Close settings"
            className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── 2-Column Split: Sidebar Navigation & Content Panel (No top border) ── */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Navigation Sidebar */}
          <div
            className="w-full sm:w-60 shrink-0 border-b sm:border-b-0 sm:border-r border-border/40 p-2 sm:p-3.5 flex sm:flex-col flex-row items-center sm:items-stretch overflow-x-auto sm:overflow-y-auto bg-muted/15 gap-1"
            role="tablist"
            aria-label="Settings navigation"
          >
            {navTabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`settings-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  tabIndex={isActive ? 0 : -1}
                  aria-selected={isActive}
                  aria-controls={`settings-tabpanel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors motion-reduce:transition-none text-left cursor-pointer w-auto shrink-0 sm:w-full outline-none focus-visible:ring-1 focus-visible:ring-primary',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground/80 hover:text-foreground hover:bg-muted/60 font-normal'
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}

            {/* Download Actions (Overleaf 1:1 Parity) */}
            <div className="h-px bg-border/60 my-1.5 hidden sm:block" />
            <div className="w-px h-5 bg-border/60 mx-1 shrink-0 self-center sm:hidden" />
            <div className="px-3 py-0.5 text-10 font-semibold uppercase tracking-wider text-muted-foreground/70 hidden sm:block">
              Download
            </div>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              aria-label="Download Source ZIP"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors motion-reduce:transition-none text-left cursor-pointer shrink-0 sm:w-full outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
            >
              {isExportingZip ? (
                <Loader2 className="size-4 shrink-0 text-muted-foreground animate-spin motion-reduce:animate-none" />
              ) : (
                <Download className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">Source (ZIP)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!pdfUrl}
              aria-label="Download compiled PDF"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors motion-reduce:transition-none text-left cursor-pointer shrink-0 sm:w-full outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none"
            >
              <FileDown className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">PDF</span>
            </button>

            {/* Project Functions / Actions (Overleaf Parity) */}
            <div className="h-px bg-border/60 my-1.5 hidden sm:block" />
            <div className="w-px h-5 bg-border/60 mx-1 shrink-0 self-center sm:hidden" />
            <div className="px-3 py-0.5 text-10 font-semibold uppercase tracking-wider text-muted-foreground/70 hidden sm:block">
              Actions
            </div>
            <button
              type="button"
              onClick={() => {
                setSettingsPanelOpen(false);
                editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
              }}
              aria-label="Word count"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors motion-reduce:transition-none text-left cursor-pointer shrink-0 sm:w-full outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Word count</span>
            </button>
            <button
              type="button"
              onClick={handleClearCache}
              disabled={isClearingCache}
              aria-label="Clear cached files"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors motion-reduce:transition-none text-left cursor-pointer shrink-0 sm:w-full outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
            >
              {isClearingCache ? (
                <Loader2 className="size-4 shrink-0 text-muted-foreground animate-spin motion-reduce:animate-none" />
              ) : (
                <Trash2 className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{isClearingCache ? 'Clearing...' : 'Clear cache'}</span>
            </button>

            {/* Separator before external links */}
            <div className="h-px bg-border/60 my-1.5 hidden sm:block" />
            <div className="w-px h-5 bg-border/60 mx-1 shrink-0 self-center sm:hidden" />

            {/* Account Settings Link */}
            <Link
              href="/settings"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Account settings in new tab"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors motion-reduce:transition-none group cursor-pointer shrink-0 sm:w-full outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Settings className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
              <span className="truncate">Account</span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground hidden sm:block ml-auto" />
            </Link>

            {/* Subscription Link */}
            <Link
              href="/settings/billing"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Subscription settings in new tab"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors motion-reduce:transition-none group cursor-pointer shrink-0 sm:w-full outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Landmark className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
              <span className="truncate">Billing</span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground hidden sm:block ml-auto" />
            </Link>
          </div>

          {/* Right Content Area */}
          <div
            role="tabpanel"
            id={`settings-tabpanel-${activeTab}`}
            aria-labelledby={`settings-tab-${activeTab}`}
            tabIndex={0}
            className="flex-1 overflow-y-auto px-5 sm:px-8 py-4 sm:py-5 bg-background outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            {/* 1. EDITOR TAB (Matching Overleaf Screenshot 1:1) */}
            {activeTab === 'editor' && (
              <div className="space-y-1">
                <SettingRow
                  title="Auto-complete"
                  description="Suggests code completions while typing"
                >
                  <OverleafSwitch
                    checked={autoComplete}
                    onCheckedChange={setAutoComplete}
                    aria-label="Auto-complete"
                  />
                </SettingRow>

                <SettingRow
                  title="Auto-close brackets"
                  description="Automatically insert closing brackets and parentheses"
                >
                  <OverleafSwitch
                    checked={autoCloseBrackets}
                    onCheckedChange={setAutoCloseBrackets}
                    aria-label="Auto-close brackets"
                  />
                </SettingRow>

                <SettingRow
                  title="Non-blinking cursor"
                  description="Reduces visual distraction by keeping the cursor solid"
                >
                  <OverleafSwitch
                    checked={nonBlinkingCursor}
                    onCheckedChange={setNonBlinkingCursor}
                    aria-label="Non-blinking cursor"
                  />
                </SettingRow>

                <SettingRow
                  title="Code check"
                  description="Enables real-time syntax checking in the editor"
                >
                  <OverleafSwitch
                    checked={linterEnabled}
                    onCheckedChange={setLinterEnabled}
                    aria-label="Code check"
                  />
                </SettingRow>

                <SettingRow
                  title="Open files in tabs"
                  description="Open each file in its own tab"
                >
                  <OverleafSwitch
                    checked={showEditorTabs}
                    onCheckedChange={setShowEditorTabs}
                    aria-label="Open files in tabs"
                  />
                </SettingRow>

                <SettingRow
                  title="Preview editor tabs"
                  description="Tabs open in preview mode until you interact with them"
                >
                  <OverleafSwitch
                    checked={previewEditorTabs}
                    onCheckedChange={setPreviewEditorTabs}
                    aria-label="Preview editor tabs"
                  />
                </SettingRow>

                <SettingRow
                  title="Keybindings"
                  description="Work in Vim or Emacs emulation mode"
                >
                  <Select
                    value={keybinding}
                    onValueChange={(val) => setKeybinding(val as KeybindingMode)}
                  >
                    <SelectTrigger
                      aria-label="Keybindings"
                      className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Keybindings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard" className="cursor-pointer text-xs">
                        None
                      </SelectItem>
                      <SelectItem value="vim" className="cursor-pointer text-xs">
                        Vim
                      </SelectItem>
                      <SelectItem value="emacs" className="cursor-pointer text-xs">
                        Emacs
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="PDF Viewer"
                  description="Choose built-in PDF viewer or native browser viewer"
                >
                  <Select
                    value={pdfViewer}
                    onValueChange={(val) => setPdfViewer(val as 'overleaf' | 'browser')}
                  >
                    <SelectTrigger
                      aria-label="PDF Viewer"
                      className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="PDF Viewer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overleaf" className="cursor-pointer text-xs">
                        Overleaf
                      </SelectItem>
                      <SelectItem value="browser" className="cursor-pointer text-xs">
                        Browser
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Word wrap"
                  description="Wrap long lines of text to fit the editor window"
                >
                  <OverleafSwitch
                    checked={wordWrap}
                    onCheckedChange={setWordWrap}
                    aria-label="Word wrap"
                  />
                </SettingRow>

                <SettingRow
                  title="Line numbers"
                  description="Show or hide line numbers in the editor gutter"
                >
                  <OverleafSwitch
                    checked={lineNumbers}
                    onCheckedChange={setLineNumbers}
                    aria-label="Line numbers"
                  />
                </SettingRow>

                <SettingRow
                  title="Font size"
                  description="Adjust editor text size in pixels"
                >
                  <Select
                    value={String(fontSize || 15)}
                    onValueChange={(val) => setFontSize(Number(val))}
                  >
                    <SelectTrigger
                      aria-label="Font size"
                      className="w-28 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Font size" />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITOR_FONT_SIZES.map((sz) => (
                        <SelectItem key={sz} value={String(sz)} className="cursor-pointer text-xs">
                          {sz}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Font family"
                  description="Select typeface used in the editor"
                >
                  <Select
                    value={fontFamily || 'default'}
                    onValueChange={(val) => setFontFamily(val)}
                  >
                    <SelectTrigger
                      aria-label="Font family"
                      className="w-48 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Font family" />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITOR_FONT_FAMILIES.map((f) => (
                        <SelectItem key={f.id} value={f.id} className="cursor-pointer text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Line height"
                  description="Spacing between lines of text in the editor"
                >
                  <Select
                    value={String(lineHeight || 1.6)}
                    onValueChange={(val) => setLineHeight(Number(val))}
                  >
                    <SelectTrigger
                      aria-label="Line height"
                      className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Line height" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.3" className="cursor-pointer text-xs">
                        Compact (1.3)
                      </SelectItem>
                      <SelectItem value="1.6" className="cursor-pointer text-xs">
                        Normal (1.6)
                      </SelectItem>
                      <SelectItem value="1.9" className="cursor-pointer text-xs">
                        Relaxed (1.9)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                {/* ── Spell Check (Overleaf Parity: Single dropdown with Off & Languages) ── */}
                <SettingRow
                  title="Spell check"
                  description="Choose spell check language or turn off"
                >
                  <Select
                    value={!spellCheck ? 'off' : (spellCheckLanguage || 'en_US')}
                    onValueChange={(val) => {
                      if (val === 'off') {
                        setSpellCheck(false);
                      } else {
                        setSpellCheck(true);
                        setSpellCheckLanguage(val);
                      }
                    }}
                  >
                    <SelectTrigger
                      aria-label="Spell check"
                      className="w-52 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Spell check" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off" className="cursor-pointer text-xs">
                        Off
                      </SelectItem>
                      <SelectItem value="en_US" className="cursor-pointer text-xs">
                        English (United States)
                      </SelectItem>
                      <SelectItem value="en_GB" className="cursor-pointer text-xs">
                        English (United Kingdom)
                      </SelectItem>
                      <SelectItem value="vi_VN" className="cursor-pointer text-xs">
                        Tiếng Việt (Vietnamese)
                      </SelectItem>
                      <SelectItem value="fr_FR" className="cursor-pointer text-xs">
                        Français (French)
                      </SelectItem>
                      <SelectItem value="de_DE" className="cursor-pointer text-xs">
                        Deutsch (German)
                      </SelectItem>
                      <SelectItem value="es_ES" className="cursor-pointer text-xs">
                        Español (Spanish)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                {/* ── Learned Words (Personal Dictionary) ── */}
                {spellCheck && (
                  <div className="pt-4 mt-3 border-t border-border/50">
                    <h4 className="text-sm font-semibold text-foreground mb-1">
                      Learned words
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Words added to your personal dictionary will not be flagged as spelling errors.
                    </p>

                    {/* Add word input form */}
                    <form onSubmit={handleSubmitWord(handleAddWord)} className="flex flex-col gap-1 mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add a custom word..."
                          aria-label="Add a custom word to dictionary"
                          {...registerWord('word')}
                          className="flex-1 h-8 px-2.5 text-xs rounded-md border border-border bg-background outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        />
                        <button
                          type="submit"
                          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1 hover:bg-primary-hover cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                          <Plus className="size-3.5 shrink-0" />
                          <span>Add word</span>
                        </button>
                      </div>
                      {wordErrors.word && (
                        <p className="text-10 text-destructive">{wordErrors.word.message}</p>
                      )}
                    </form>

                    {/* Word Badges */}
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-border/40 rounded-md bg-muted/20">
                      {userWords.length === 0 ? (
                        <span className="text-xs text-muted-foreground/80 italic p-1">
                          No learned words in your personal dictionary yet.
                        </span>
                      ) : (
                        userWords.map((word) => (
                          <span
                            key={`user-${word}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-background border border-border text-foreground group"
                          >
                            <span>{word}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveWord(word)}
                              title={`Remove "${word}" from dictionary`}
                              aria-label={`Remove "${word}" from dictionary`}
                              className="size-3.5 relative rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-destructive after:absolute after:-inset-1.5"
                            >
                              <X className="size-2.5" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. COMPILER TAB */}
            {activeTab === 'compiler' && (
              <div className="space-y-1">
                <SettingRow
                  title="Compiler"
                  description="Select which LaTeX engine compiles your project"
                >
                  <Select
                    value={engine}
                    onValueChange={(val) => setEngine(val as CompilerEngine)}
                  >
                    <SelectTrigger
                      aria-label="Compiler engine"
                      className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Engine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdflatex" className="cursor-pointer text-xs">
                        pdfLaTeX
                      </SelectItem>
                      <SelectItem value="xelatex" className="cursor-pointer text-xs">
                        XeLaTeX
                      </SelectItem>
                      <SelectItem value="lualatex" className="cursor-pointer text-xs">
                        LuaLaTeX
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="TeX Live version"
                  description="The version of TeX Live used to compile your project"
                >
                  <Select
                    value={texLiveVersion}
                    onValueChange={setTexLiveVersion}
                  >
                    <SelectTrigger
                      aria-label="TeX Live version"
                      className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Version" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024" className="cursor-pointer text-xs">
                        2024
                      </SelectItem>
                      <SelectItem value="2023" className="cursor-pointer text-xs">
                        2023
                      </SelectItem>
                      <SelectItem value="2022" className="cursor-pointer text-xs">
                        2022
                      </SelectItem>
                      <SelectItem value="2021" className="cursor-pointer text-xs">
                        2021
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Main document"
                  description="The entrypoint LaTeX document to compile"
                >
                  <Select value={mainFile} onValueChange={handleMainFileChange}>
                    <SelectTrigger
                      aria-label="Main document"
                      className="w-44 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Main file" />
                    </SelectTrigger>
                    <SelectContent>
                      {texFiles.map((file) => (
                        <SelectItem key={file} value={file} className="cursor-pointer text-xs">
                          {file}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Auto-compile"
                  description="Automatically recompile when files change"
                >
                  <OverleafSwitch
                    checked={autoCompile}
                    onCheckedChange={setAutoCompile}
                    aria-label="Auto-compile"
                  />
                </SettingRow>

                <SettingRow
                  title="Fast [draft] compile"
                  description="Draft mode compiles faster by skipping heavy figures and fonts"
                >
                  <OverleafSwitch
                    checked={compileMode === 'draft'}
                    onCheckedChange={(v) => setCompileMode(v ? 'draft' : 'full')}
                    aria-label="Fast [draft] compile"
                  />
                </SettingRow>

                <SettingRow
                  title="Stop on first error"
                  description="Stop compilation immediately when the first LaTeX error occurs"
                >
                  <OverleafSwitch
                    checked={stopOnFirstError}
                    onCheckedChange={setStopOnFirstError}
                    aria-label="Stop on first error"
                  />
                </SettingRow>

                <SettingRow
                  title="Cache auxiliary files"
                  description="Reuse previous build artifacts to accelerate re-compilation"
                >
                  <OverleafSwitch
                    checked={useCache}
                    onCheckedChange={setUseCache}
                    aria-label="Cache auxiliary files"
                  />
                </SettingRow>

                <SettingRow
                  title="Clear cached files"
                  description="Delete auxiliary files (.aux, .bbl, .log) to resolve build errors and compile from scratch"
                >
                  <button
                    type="button"
                    onClick={handleClearCache}
                    disabled={isClearingCache}
                    className="h-8 px-3 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
                  >
                    {isClearingCache ? (
                      <Loader2 className="size-3.5 text-muted-foreground animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    )}
                    <span>{isClearingCache ? 'Clearing...' : 'Clear cached files'}</span>
                  </button>
                </SettingRow>
              </div>
            )}

            {/* 4. REFERENCES TAB */}
            {activeTab === 'references' && (
              <ProjectReferencesTab projectId={projectId} bibFiles={bibFiles} />
            )}

            {/* 5. GITHUB SYNC TAB */}
            {activeTab === 'github' && (
              <ProjectGithubTab projectId={projectId} projectTitle={projectTitle} />
            )}

            {/* 6. APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="space-y-1">
                <SettingRow
                  title="Editor theme"
                  description="Syntax highlighting color theme for the Code editor"
                >
                  <Select
                    value={editorTheme}
                    onValueChange={(val) => setEditorTheme(val as EditorTheme)}
                  >
                    <SelectTrigger
                      aria-label="Editor theme"
                      className="w-48 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITOR_THEMES.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="cursor-pointer text-xs">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Interface theme"
                  description="Light or Dark mode for the surrounding editor interface"
                >
                  <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
                    <SelectTrigger
                      aria-label="Interface theme"
                      className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system" className="cursor-pointer text-xs">
                        System
                      </SelectItem>
                      <SelectItem value="light" className="cursor-pointer text-xs">
                        Light
                      </SelectItem>
                      <SelectItem value="dark" className="cursor-pointer text-xs">
                        Dark
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Font size"
                  description="Size of text in the Code editor"
                >
                  <Select
                    value={String(fontSize || 15)}
                    onValueChange={(val) => setFontSize(Number(val))}
                  >
                    <SelectTrigger
                      aria-label="Font size"
                      className="w-28 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITOR_FONT_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)} className="cursor-pointer text-xs">
                          {size}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Font family"
                  description="Monospace font family for the code editor"
                >
                  <Select value={fontFamily || 'default'} onValueChange={setFontFamily}>
                    <SelectTrigger
                      aria-label="Font family"
                      className="w-48 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                    >
                      <SelectValue placeholder="Font" />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITOR_FONT_FAMILIES.map((f) => (
                        <SelectItem key={f.id} value={f.id} className="cursor-pointer text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
              </div>
            )}

            {/* 6. PROJECT NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div className="space-y-1">
                <SettingRow
                  title="Comments and mentions"
                  description="Receive emails when someone mentions you or replies to your comments"
                >
                  <OverleafSwitch
                    checked={notifyComments}
                    onCheckedChange={setNotifyComments}
                    aria-label="Comments and mentions"
                  />
                </SettingRow>

                <SettingRow
                  title="Project activity summary"
                  description="Receive weekly summaries of changes and collaboration in this project"
                >
                  <OverleafSwitch
                    checked={notifyUpdates}
                    onCheckedChange={setNotifyUpdates}
                    aria-label="Project activity summary"
                  />
                </SettingRow>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
