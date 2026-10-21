'use client';

/**
 * ProjectSettingsModal.tsx / OverleafMenuDrawer
 *
 * Authentic 1:1 Overleaf Menu Drawer (UI Shell Layer).
 * Location: `features/editor/ui/modals/project-settings/ProjectSettingsModal.tsx`
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { duplicateProjectApi } from '@/features/projects/shell/services/project.service';
import {
  X,
  Archive,
  FileArchive,
  FileDown,
  Copy,
  Check,
  Calculator,
  Loader2,
  ArrowLeft,
  BookOpen,
  SpellCheck,
  GitBranch,
  Cloud,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { GitHubIcon } from '@/shared/components/icons/IntegrationIcons';

import {
  useSettingsStore,
  usePageStore,
  useCompileStore,
  editorCommandBus,
} from '@/features/editor/core';
import { filesQuery, pageQuery } from '@/features/editor/ui/hooks/document.queries';
import { usePageActions } from '@/features/editor/ui/hooks/usePageActions';
import { useProjectExport } from '@/features/editor/ui/hooks/useExport';
import { useGithubSync } from '@/features/editor/ui/hooks/useGithubSync';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';

import {
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
} from './settings-common';
import { ProjectGithubTab } from './ProjectGithubTab';
import { ProjectReferencesTab } from './ProjectReferencesTab';
import { ProjectDictionaryTab } from './ProjectDictionaryTab';
import { ProjectCompilerSection } from './ProjectCompilerSection';

export { EDITOR_FONT_FAMILIES, EDITOR_FONT_SIZES };

type MenuView = 'menu' | 'github' | 'references' | 'dictionary';

export function ProjectSettingsModal() {
  const queryClient = useQueryClient();
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const storeProjectId = usePageStore((s) => s.projectId);
  const { getContent } = useEditorInstance();
  const pdfUrl = useCompileStore((s) => s.pdfUrl);

  const pageId = params?.pageId || storeParentPageId || currentPage?.id;
  const rawProjectId = params?.projectId || params?.pageId || storeProjectId || currentPage?.id;
  const effectiveProjectId =
    extractProjectId(currentPage) ||
    rawProjectId ||
    '';
  const projectTitle = currentPage?.title || 'manuscript';

  // Settings Store state
  const settingsPanelOpen = useSettingsStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useSettingsStore((s) => s.setSettingsPanelOpen);
  const settingsActiveTab = useSettingsStore((s) => s.settingsActiveTab);
  const setSettingsActiveTab = useSettingsStore((s) => s.setSettingsActiveTab);
  const setMainFile = useSettingsStore((s) => s.setMainFile);

  // Sub-view navigation
  const [currentView, setCurrentView] = useState<MenuView>('menu');

  useEffect(() => {
    if (settingsActiveTab === 'github') {
      setCurrentView('github');
    } else if (settingsActiveTab === 'references') {
      setCurrentView('references');
    } else {
      setCurrentView('menu');
    }
  }, [settingsActiveTab, settingsPanelOpen]);

  useEffect(() => {
    const unsub = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'project-settings') {
        const targetView = (cmd.payload?.view as MenuView) || (cmd.payload?.initialTab as MenuView) || 'menu';
        if (targetView === 'github' || targetView === 'references' || targetView === 'dictionary') {
          setCurrentView(targetView);
          if (targetView === 'github') setSettingsActiveTab('github');
          else if (targetView === 'references') setSettingsActiveTab('references');
        } else {
          setCurrentView('menu');
          setSettingsActiveTab('editor');
        }
        setSettingsPanelOpen(true);
      }
    });
    return unsub;
  }, [setSettingsActiveTab, setSettingsPanelOpen]);

  // Project export hook
  const { downloadPdf, exportZip, exportArxiv, isExporting } = useProjectExport();

  // GitHub Sync status
  const { linkData: githubLinkData } = useGithubSync({
    projectId: effectiveProjectId,
    projectTitle,
  });

  // Query project files to populate Main Document and Bib files
  const { data: projectFiles } = useQuery({
    ...filesQuery(pageId ?? effectiveProjectId),
    enabled: Boolean((pageId || effectiveProjectId) && settingsPanelOpen),
  });

  const { data: parentPage } = useQuery({
    ...pageQuery(pageId ?? ''),
    enabled: Boolean(pageId && settingsPanelOpen),
  });

  const { setMainFile: setMainFileMutation } = usePageActions();

  const handleMainFileChange = (newMainFileName: string) => {
    setMainFile(newMainFileName);
    const filesList = (projectFiles || []) as Array<{ id: string; title?: string; name?: string; filename?: string }>;
    const targetFile = filesList.find(
      (f) => (f.title || f.name || f.filename) === newMainFileName
    );
    if (targetFile && (pageId || effectiveProjectId)) {
      setMainFileMutation.mutate({
        pageId: (pageId || effectiveProjectId),
        fileId: targetFile.id,
        projectId: effectiveProjectId,
      });
    } else if ((pageId || effectiveProjectId) && parentPage && (parentPage.title === newMainFileName || newMainFileName === 'main.tex')) {
      setMainFileMutation.mutate({
        pageId: (pageId || effectiveProjectId),
        fileId: parentPage.id,
        projectId: effectiveProjectId,
      });
    }
  };

  const texFiles = useMemo(() => {
    const list: string[] = [];
    if (parentPage?.title) {
      const rootTitle = parentPage.title.endsWith('.tex') ? parentPage.title : `${parentPage.title}.tex`;
      list.push(rootTitle);
    }
    if (projectFiles && Array.isArray(projectFiles)) {
      (projectFiles as Array<{ title?: string; name?: string; filename?: string }>).forEach((f) => {
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
      (projectFiles as Array<{ title?: string; name?: string; filename?: string }>).forEach((f) => {
        const name = f.title || f.name || f.filename;
        if (typeof name === 'string' && name.toLowerCase().endsWith('.bib') && !list.includes(name)) {
          list.push(name);
        }
      });
    }
    if (list.length === 0) list.push('references.bib');
    return list;
  }, [projectFiles]);

  // Git clone copy feedback
  const [copiedGitUrl, setCopiedGitUrl] = useState(false);
  const [gitToken, setGitToken] = useState<string | null>(null);
  const [gitTokensList, setGitTokensList] = useState<Array<{ id: string; label: string; prefix: string; createdAt: string; lastUsedAt: string | null }>>([]);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [copiedGitToken, setCopiedGitToken] = useState(false);
  const [gitRepoInfo, setGitRepoInfo] = useState<{ cloneUrl?: string; branch?: string } | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  useEffect(() => {
    if (!effectiveProjectId || !settingsPanelOpen) return;
    manuscriptService.git.getRepoInfo(effectiveProjectId)
      .then((info) => {
        if (info) {
          setGitRepoInfo(info);
          if (Array.isArray(info.tokens)) {
            setGitTokensList(info.tokens);
          }
        }
      })
      .catch(() => {});

    manuscriptService.git.listTokens()
      .then((res) => {
        if (res && Array.isArray(res.tokens)) {
          setGitTokensList(res.tokens);
        }
      })
      .catch(() => {});
  }, [effectiveProjectId, settingsPanelOpen]);

  const gitCloneUrl = gitRepoInfo?.cloneUrl || (typeof window !== 'undefined'
    ? `${window.location.origin}/git/${effectiveProjectId || 'project'}.git`
    : `https://git.flux.app/git/${effectiveProjectId || 'project'}.git`);

  const handleCopyGitUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`git clone ${gitCloneUrl}`);
      setCopiedGitUrl(true);
      toast.success('Git clone command copied to clipboard!', { id: 'copy-git-url' });
      setTimeout(() => setCopiedGitUrl(false), 2000);
    }
  };

  const handleCreateGitToken = async () => {
    setIsCreatingToken(true);
    try {
      const res = await manuscriptService.git.createToken(`Token ${new Date().toLocaleDateString()}`);
      const rawToken =
        typeof res?.token === 'string'
          ? res.token
          : (res?.token as unknown as { token?: string })?.token || '';
      setGitToken(rawToken);
      toast.success('Git Access Token generated successfully!', { id: 'git-token-action' });
      const updated = await manuscriptService.git.listTokens().catch(() => null);
      if (updated && Array.isArray(updated.tokens)) {
        setGitTokensList(updated.tokens);
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to generate Git Token', { id: 'git-token-action' });
    } finally {
      setIsCreatingToken(false);
    }
  };

  const handleRevokeGitToken = async (tokenId: string) => {
    setRevokingTokenId(tokenId);
    try {
      await manuscriptService.git.revokeToken(tokenId);
      setGitTokensList((prev) => prev.filter((t) => t.id !== tokenId));
      toast.success('Git Access Token revoked', { id: 'git-token-revoke' });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to revoke Git Token', { id: 'git-token-revoke' });
    } finally {
      setRevokingTokenId(null);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!effectiveProjectId) {
      toast.info('No active project found to save as template.', { id: 'save-template' });
      return;
    }
    setIsSavingTemplate(true);
    const toastId = toast.loading('Saving project as custom template...');
    try {
      await manuscriptService.templates.createCustom({
        projectId: effectiveProjectId,
        name: `${projectTitle} Template`,
        description: `Custom template saved from ${projectTitle}`,
        category: 'Academic',
      });
      queryClient.invalidateQueries({ queryKey: ['manuscript-templates'] });
      toast.success('Project saved to Template Gallery!', { id: toastId });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to save custom template', { id: toastId });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleCopyGitToken = () => {
    if (gitToken && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(gitToken);
      setCopiedGitToken(true);
      toast.success('Git Token copied to clipboard!', { id: 'copy-git-token' });
      setTimeout(() => setCopiedGitToken(false), 2000);
    }
  };

  // Copy Project (Overleaf Parity: Menu Drawer -> Project Functions -> Copy Project)
  const router = useRouter();
  const [isCopyingProject, setIsCopyingProject] = useState(false);
  const handleMakeCopy = async () => {
    if (!effectiveProjectId) {
      toast.info('No active project found to duplicate.', { id: 'duplicate-project' });
      return;
    }
    const toastId = toast.loading('Duplicating project...');
    setIsCopyingProject(true);
    try {
      const res = (await duplicateProjectApi(effectiveProjectId)) as { project?: { id?: string }; id?: string } | null;
      const newProjId = res?.project?.id || res?.id;
      toast.success('Project duplicated successfully!', { id: toastId });
      setSettingsPanelOpen(false);
      if (newProjId) {
        router.push(`/projects/${newProjId}/pages`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate project';
      toast.error(message, { id: toastId });
    } finally {
      setIsCopyingProject(false);
    }
  };

  // Cache clearing
  const [isClearingCache, setIsClearingCache] = useState(false);
  const handleClearCache = async () => {
    if (!effectiveProjectId) {
      toast.info('No active project found to clear cache.', { id: 'clear-cache' });
      return;
    }

    setIsClearingCache(true);
    try {
      const res = await manuscriptService.compiler.cleanAuxFiles(effectiveProjectId);
      if (res && res.success === false) {
        throw new Error('Failed to clear cached files');
      }
      toast.success('Cached files cleared. You can recompile whenever ready.', { id: 'clear-cache' });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to clear cached files', { id: 'clear-cache' });
    } finally {
      setIsClearingCache(false);
    }
  };

  // 1-Click Downloads
  const handleDownloadZip = () => {
    const rootId = pageId || effectiveProjectId || currentPage?.id;
    if (!rootId) {
      toast.info('No active project found to export.', { id: 'export-zip' });
      return;
    }
    exportZip({
      parentPageId: rootId,
      projectTitle,
      currentContent: getContent(),
      activeFileId: activeFilePage?.id,
      activeFileTitle: activeFilePage?.title,
    });
  };

  const handleDownloadArxiv = () => {
    const rootId = pageId || effectiveProjectId || currentPage?.id;
    if (!rootId) {
      toast.info('No active project found to export.', { id: 'export-arxiv' });
      return;
    }
    exportArxiv({
      parentPageId: rootId,
      projectTitle,
      currentContent: getContent(),
      activeFileId: activeFilePage?.id,
      activeFileTitle: activeFilePage?.title,
    });
  };

  const handleDownloadPdf = () => {
    downloadPdf(pdfUrl, projectTitle);
  };

  const handleOpenWordCount = () => {
    setSettingsPanelOpen(false);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
  };

  return (
    <Sheet open={settingsPanelOpen} onOpenChange={setSettingsPanelOpen}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-full sm:w-[420px] max-w-[420px] p-0 flex flex-col bg-sidebar border-r border-border text-foreground select-none overflow-hidden z-50 shadow-overlay"
      >
        {/* ── Menu Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {currentView !== 'menu' && (
              <button
                type="button"
                onClick={() => {
                  setCurrentView('menu');
                  setSettingsActiveTab('editor');
                }}
                aria-label="Back to Menu"
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
              >
                <ArrowLeft className="size-4 shrink-0" />
              </button>
            )}
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold tracking-tight text-foreground leading-tight flex items-center gap-1.5">
                {currentView === 'menu' && 'Menu'}
                {currentView === 'github' && 'GitHub Sync'}
                {currentView === 'references' && 'Reference Integrations'}
                {currentView === 'dictionary' && 'Personal Dictionary'}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate max-w-[260px]">
                {currentView === 'menu' ? projectTitle : 'Configure settings & integrations'}
              </SheetDescription>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSettingsPanelOpen(false)}
            aria-label="Close menu"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1.5 after:content-['']"
          >
            <X className="size-4 shrink-0" />
          </button>
        </div>

        {/* ── Sub-view: GitHub ───────────────────────────────────────────────── */}
        {currentView === 'github' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <ProjectGithubTab projectId={effectiveProjectId} projectTitle={projectTitle} />
          </div>
        )}

        {/* ── Sub-view: References ───────────────────────────────────────────── */}
        {currentView === 'references' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <ProjectReferencesTab projectId={effectiveProjectId} bibFiles={bibFiles} />
          </div>
        )}

        {/* ── Sub-view: Personal Dictionary ──────────────────────────────────── */}
        {currentView === 'dictionary' && <ProjectDictionaryTab />}

        {/* ── Primary Overleaf Menu Body ─────────────────────────────────────── */}
        {currentView === 'menu' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6 text-foreground">
            {/* 1. DOWNLOAD SECTION */}
            <section aria-labelledby="menu-download-heading">
              <h3
                id="menu-download-heading"
                className="text-[11px] font-semibold text-muted-foreground px-1 mb-2.5"
              >
                Download
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isExporting}
                  aria-label="Download Source (.zip)"
                  className="flex flex-col items-center justify-center p-2.5 rounded-md border border-border bg-card/50 hover:bg-muted/70 hover:border-foreground/30 transition-colors cursor-pointer group text-center"
                >
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center mb-1">
                    {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
                  </div>
                  <span className="text-xs font-medium text-foreground">Source</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">.zip archive</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadArxiv}
                  disabled={isExporting}
                  aria-label="Download arXiv submission (.zip)"
                  className="flex flex-col items-center justify-center p-2.5 rounded-md border border-border bg-card/50 hover:bg-muted/70 hover:border-foreground/30 transition-colors cursor-pointer group text-center"
                >
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center mb-1">
                    {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <FileArchive className="size-3.5" />}
                  </div>
                  <span className="text-xs font-medium text-foreground">arXiv</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Submission .zip</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  aria-label="Download PDF"
                  className="flex flex-col items-center justify-center p-2.5 rounded-md border border-border bg-card/50 hover:bg-muted/70 hover:border-foreground/30 transition-colors cursor-pointer group text-center"
                >
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center mb-1">
                    <FileDown className="size-3.5" />
                  </div>
                  <span className="text-xs font-medium text-foreground">PDF</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Compiled output</span>
                </button>
              </div>
            </section>

            {/* 2. SYNC SECTION */}
            <section aria-labelledby="menu-sync-heading" className="space-y-2">
              <h3
                id="menu-sync-heading"
                className="text-[11px] font-semibold text-muted-foreground px-1 mb-2.5"
              >
                Sync
              </h3>

              {/* GitHub */}
              <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-md bg-foreground/5 flex items-center justify-center shrink-0">
                    <GitHubIcon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-foreground truncate">
                        {githubLinkData?.link?.repoFullName || 'GitHub'}
                      </p>
                      {githubLinkData?.link?.branch && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                          {githubLinkData.link.branch}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {githubLinkData?.link
                        ? (githubLinkData.link.lastSyncedAt
                            ? `Last synced: ${new Date(githubLinkData.link.lastSyncedAt).toLocaleString()}`
                            : 'Linked & ready to sync')
                        : 'Sync repository & commits'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentView('github')}
                  className="h-7 text-xs px-2.5 cursor-pointer shrink-0"
                >
                  {githubLinkData?.link ? 'Manage' : 'Configure'}
                </Button>
              </div>

              {/* Git Clone URL & Smart-HTTP */}
              <div className="p-2.5 rounded-md border border-border bg-card/40 space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-foreground">Git Clone URL</span>
                  {gitRepoInfo?.branch && (
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {gitRepoInfo.branch}
                    </span>
                  )}
                  <span className="text-[10px] font-medium text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-sm ml-auto">
                    Smart-HTTP
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2 py-1">
                  <code className="text-[11px] font-mono text-muted-foreground truncate flex-1 select-all">
                    git clone {gitCloneUrl}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyGitUrl}
                    className="h-6 min-h-[26px] px-2 text-[11px] cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
                  >
                    {copiedGitUrl ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                    <span className="ml-1">{copiedGitUrl ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <div className="pt-1 border-t border-border/40 text-[11px] text-muted-foreground space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Authentication: HTTP Basic (Password = Git Token)</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateGitToken}
                      disabled={isCreatingToken}
                      className="min-h-[26px] h-6 px-2.5 text-[11px] cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
                    >
                      {isCreatingToken ? 'Generating...' : 'Generate Git Token'}
                    </Button>
                  </div>
                  {gitToken && (
                    <div className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-md px-2 py-1">
                      <code className="font-mono text-[10px] text-foreground truncate flex-1 select-all">
                        {gitToken}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyGitToken}
                        className="min-h-[26px] h-6 px-2 text-[11px] cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
                      >
                        {copiedGitToken ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                      </Button>
                    </div>
                  )}
                  {gitTokensList.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {gitTokensList.slice(0, 3).map((tok) => (
                        <div
                          key={tok.id}
                          className="flex items-center justify-between text-[10px] bg-background/60 border border-border/60 rounded px-2 py-0.5"
                        >
                          <span className="truncate font-mono text-foreground">
                            {tok.label} ({tok.prefix}…)
                          </span>
                          <button
                            type="button"
                            disabled={revokingTokenId === tok.id}
                            onClick={() => handleRevokeGitToken(tok.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer ml-2 shrink-0 relative after:absolute after:-inset-1.5 after:content-[''] py-0.5"
                            aria-label={`Revoke ${tok.label}`}
                          >
                            {revokingTokenId === tok.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dropbox */}
              <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    <Cloud className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Dropbox</p>
                    <p className="text-[11px] text-muted-foreground">Two-way folder sync</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
                  Available
                </span>
              </div>
            </section>

            {/* 3. PROJECT FUNCTIONS (Copy Project & Word Count) */}
            <section aria-labelledby="menu-wordcount-heading" className="space-y-2">
              <h3
                id="menu-wordcount-heading"
                className="text-[11px] font-semibold text-muted-foreground px-1 mb-2.5"
              >
                Project Functions
              </h3>

              {/* Copy Project */}
              <button
                type="button"
                onClick={handleMakeCopy}
                disabled={isCopyingProject}
                aria-label="Copy Project"
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card hover:border-foreground/30 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    {isCopyingProject ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Copy Project</p>
                    <p className="text-[11px] text-muted-foreground">Duplicate this project into a new one</p>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium group-hover:underline">
                  {isCopyingProject ? 'Copying...' : 'Duplicate →'}
                </span>
              </button>

              {/* Save as Custom Template */}
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                disabled={isSavingTemplate}
                aria-label="Save as Template"
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card hover:border-foreground/30 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    {isSavingTemplate ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Save as Template</p>
                    <p className="text-[11px] text-muted-foreground">Publish to reusable custom templates</p>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium group-hover:underline">
                  {isSavingTemplate ? 'Saving...' : 'Save →'}
                </span>
              </button>

              {/* Word Count */}
              <button
                type="button"
                onClick={handleOpenWordCount}
                aria-label="Run Word Count"
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card hover:border-foreground/30 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    <Calculator className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Word Count</p>
                    <p className="text-[11px] text-muted-foreground">Count words & headers with TeXcount</p>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium group-hover:underline">
                  Analyze →
                </span>
              </button>
            </section>

            {/* 4. SETTINGS SECTION */}
            <ProjectCompilerSection
              texFiles={texFiles}
              bibFiles={bibFiles}
              onMainFileChange={handleMainFileChange}
              onClearCache={handleClearCache}
              isClearingCache={isClearingCache}
            />

            {/* 5. INTEGRATIONS & TOOLS */}
            <section aria-labelledby="menu-tools-heading" className="space-y-2 pt-2 border-t border-border">
              <h3
                id="menu-tools-heading"
                className="text-[11px] font-semibold text-muted-foreground px-1 mb-2.5"
              >
                Integrations & Tools
              </h3>

              {/* Reference Managers (Zotero & Mendeley) */}
              <button
                type="button"
                onClick={() => setCurrentView('references')}
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    <BookOpen className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">References</p>
                    <p className="text-[11px] text-muted-foreground">Zotero & Mendeley bibliography sync</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              {/* Personal Dictionary */}
              <button
                type="button"
                onClick={() => setCurrentView('dictionary')}
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    <SpellCheck className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Personal Dictionary</p>
                    <p className="text-[11px] text-muted-foreground">Manage learned spellcheck words</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              {/* Keyboard Shortcuts */}
              <button
                type="button"
                onClick={() => {
                  setSettingsPanelOpen(false);
                  editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'shortcuts' });
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    <Sliders className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Keyboard Shortcuts</p>
                    <p className="text-[11px] text-muted-foreground">Hotkey cheat sheet & keybindings</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export const OverleafMenuDrawer = ProjectSettingsModal;
export default ProjectSettingsModal;
