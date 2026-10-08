'use client';

/**
 * ProjectSettingsModal.tsx
 *
 * Canonical Project Settings Modal (Overleaf 1:1 Parity).
 * Location: `features/editor/ui/modals/ProjectSettingsModal.tsx`
 *
 * Organizes project settings into modular tabs:
 * - Editor: Keybindings, font, indentation, linter, spell check & custom dictionary
 * - Compiler: TeX Live version, main entrypoint, LaTeX compiler engine, aux cache
 * - References: Zotero & Mendeley reference integrations
 * - GitHub: Git synchronization & remote repository management
 * - Appearance: Syntax color theme, dark/light interface mode, typography
 * - Notifications: Email digests and mention alert preferences
 */

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Settings,
  Download,
  FileDown,
  Loader2,
  Trash2,
  ExternalLink,
  BookOpen,
  Paintbrush,
  Bell,
  Landmark,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import {
  useSettingsStore,
  usePageStore,
  useCompilerStore,
} from '@/features/editor/store';
import { filesQuery, pageQuery, useFileActions } from '@/features/editor/ui/hooks/use-core';
import { useQuery } from '@tanstack/react-query';
import { editorCommandBus } from '@/features/editor/coordinators';
import { apiPost, apiDelete } from '@/shared/lib/api';
import { exportProjectAsZip } from '@/features/editor/coordinators/services/archive-export.service';
import { GitHubIcon } from '@/shared/components/icons';

import {
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
  type SettingsTab,
  CodeIconBrackets,
  ProjectEditorTab,
  ProjectCompilerTab,
  ProjectReferencesTab,
  ProjectGithubTab,
  ProjectAppearanceTab,
  ProjectNotificationsTab,
} from './project-settings';

export { EDITOR_FONT_FAMILIES, EDITOR_FONT_SIZES };

export default function ProjectSettingsModal() {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const pageId = params?.pageId;
  const projectId = params?.projectId || params?.pageId || currentPage?.id;
  const projectTitle = currentPage?.title || 'manuscript';

  const settingsPanelOpen = useSettingsStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useSettingsStore((s) => s.setSettingsPanelOpen);
  const mainFile = useSettingsStore((s) => s.mainFile);
  const setMainFile = useSettingsStore((s) => s.setMainFile);

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
        {/* ── Dialog Header ─────────────────────────────────────────────────── */}
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

        {/* ── 2-Column Split: Sidebar Navigation & Content Panel ───────────── */}
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
            {/* 1. EDITOR TAB */}
            {activeTab === 'editor' && (
              <ProjectEditorTab active={settingsPanelOpen && activeTab === 'editor'} />
            )}

            {/* 2. COMPILER TAB */}
            {activeTab === 'compiler' && (
              <ProjectCompilerTab
                texFiles={texFiles}
                mainFile={mainFile}
                onMainFileChange={handleMainFileChange}
                onClearCache={handleClearCache}
                isClearingCache={isClearingCache}
              />
            )}

            {/* 3. REFERENCES TAB */}
            {activeTab === 'references' && (
              <ProjectReferencesTab projectId={projectId} bibFiles={bibFiles} />
            )}

            {/* 4. GITHUB TAB */}
            {activeTab === 'github' && (
              <ProjectGithubTab projectId={projectId} projectTitle={projectTitle} />
            )}

            {/* 5. APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <ProjectAppearanceTab />
            )}

            {/* 6. PROJECT NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <ProjectNotificationsTab />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
