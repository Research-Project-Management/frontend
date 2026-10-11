'use client';

/**
 * ProjectSettingsModal.tsx / OverleafMenuDrawer
 *
 * Authentic 1:1 Overleaf Menu Drawer (UI Shell Layer).
 * Location: `features/editor/ui/modals/ProjectSettingsModal.tsx`
 *
 * Implements the iconic Overleaf slide-out left Menu drawer:
 * 1. DOWNLOAD: Source (.zip archive) and compiled PDF (.pdf) with 1-click downloads.
 * 2. SYNC: GitHub integration, Git clone URL with 1-click copy, and cloud sync status.
 * 3. WORD COUNT: TeXcount deep manuscript word/heading analysis dialog trigger.
 * 4. SETTINGS: Overleaf compiler, TeX Live, main document, spell check, auto-compile,
 *    keybindings (Vim/Emacs), font typography, theme, and aux cache cleanup.
 * 5. EXTENSIONS: Deep sub-views for GitHub configuration, Zotero/Mendeley references,
 *    and personal dictionary words.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { duplicateProjectApi } from '@/features/projects/shell/services/project.service';
import {
  X,
  Archive,
  FileDown,
  Copy,
  Check,
  Calculator,
  Settings,
  Trash2,
  Loader2,
  ArrowLeft,
  BookOpen,
  SpellCheck,
  GitBranch,
  Cloud,
  ChevronRight,
  Plus,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { GitHubIcon } from '@/shared/components/icons';

import {
  useSettingsStore,
  type CompilerEngine,
  type KeybindingMode,
  type EditorTheme,
} from '@/features/editor/store/settings.store';
import { usePageStore } from '@/features/editor/store/editor.store';
import { useCompileStore } from '@/features/editor/store/compiler.store';
import { filesQuery, pageQuery } from '@/features/editor/ui/hooks/document.queries';
import { useFileActions } from '@/features/editor/ui/hooks/use-file-actions';
import { useProjectExport } from '@/features/editor/ui/hooks/use-export';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { useSpellingDictionary } from '@/features/editor/ui/hooks/use-spelling';
import { extractProjectId } from '@/features/editor/domain/types';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { apiPost, apiDelete } from '@/shared/lib/api';
import { manuscriptService } from '@/features/editor/sdk/manuscript';

import {
  SettingRow,
  OverleafSwitch,
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
} from './project-settings/settings-common';
import { ProjectGithubTab } from './project-settings/ProjectGithubTab';
import { ProjectReferencesTab } from './project-settings/ProjectReferencesTab';

export { EDITOR_FONT_FAMILIES, EDITOR_FONT_SIZES };

type MenuView = 'menu' | 'github' | 'references' | 'dictionary';

export function ProjectSettingsModal() {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const storeProjectId = usePageStore((s) => s.projectId);
  const { getContent } = useEditorInstance();
  const pdfUrl = useCompileStore((s) => s.pdfUrl);

  const pageId = params?.pageId;
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

  const engine = useSettingsStore((s) => s.engine);
  const setEngine = useSettingsStore((s) => s.setEngine);
  const texLiveVersion = useSettingsStore((s) => s.texLiveVersion || '2024');
  const setTexLiveVersion = useSettingsStore((s) => s.setTexLiveVersion);
  const mainFile = useSettingsStore((s) => s.mainFile);
  const setMainFile = useSettingsStore((s) => s.setMainFile);
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const setAutoCompile = useSettingsStore((s) => s.setAutoCompile);
  const autoCloseBrackets = useSettingsStore((s) => s.autoCloseBrackets);
  const setAutoCloseBrackets = useSettingsStore((s) => s.setAutoCloseBrackets);
  const linterEnabled = useSettingsStore((s) => s.linterEnabled);
  const setLinterEnabled = useSettingsStore((s) => s.setLinterEnabled);
  const keybinding = useSettingsStore((s) => s.keybinding);
  const setKeybinding = useSettingsStore((s) => s.setKeybinding);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const editorTheme = useSettingsStore((s) => s.editorTheme);
  const setEditorTheme = useSettingsStore((s) => s.setEditorTheme);
  const pdfViewer = useSettingsStore((s) => s.pdfViewer);
  const setPdfViewer = useSettingsStore((s) => s.setPdfViewer);
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);
  const setStopOnFirstError = useSettingsStore((s) => s.setStopOnFirstError);
  const compileMode = useSettingsStore((s) => s.compileMode);
  const setCompileMode = useSettingsStore((s) => s.setCompileMode);
  const spellCheck = useSettingsStore((s) => s.spellCheck);
  const setSpellCheck = useSettingsStore((s) => s.setSpellCheck);
  const spellCheckLanguage = useSettingsStore((s) => s.spellCheckLanguage || 'en-US');
  const setSpellCheckLanguage = useSettingsStore((s) => s.setSpellCheckLanguage);
  const mainBibFile = useSettingsStore((s) => s.mainBibFile);
  const setMainBibFile = useSettingsStore((s) => s.setMainBibFile);
  const referenceSearchStyle = useSettingsStore((s) => s.referenceSearchStyle);
  const setReferenceSearchStyle = useSettingsStore((s) => s.setReferenceSearchStyle);

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

  // Project export hook
  const { downloadPdf, exportZip, isExporting } = useProjectExport();

  // Query project files to populate Main Document and Bib files
  const { data: projectFiles } = useQuery({
    ...filesQuery(pageId ?? effectiveProjectId),
    enabled: Boolean((pageId || effectiveProjectId) && settingsPanelOpen),
  });

  const { data: parentPage } = useQuery({
    ...pageQuery(pageId ?? ''),
    enabled: Boolean(pageId && settingsPanelOpen),
  });

  const { setMainFile: setMainFileMutation } = useFileActions();

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
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [copiedGitToken, setCopiedGitToken] = useState(false);
  const [gitRepoInfo, setGitRepoInfo] = useState<{ cloneUrl?: string; branch?: string } | null>(null);

  useEffect(() => {
    if (!effectiveProjectId) return;
    manuscriptService.git.getRepoInfo(effectiveProjectId)
      .then((info) => {
        if (info) setGitRepoInfo(info);
      })
      .catch(() => {});
  }, [effectiveProjectId]);

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
      setGitToken(res.token);
      toast.success('Git Access Token generated successfully!', { id: 'git-token-action' });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Failed to generate Git Token', { id: 'git-token-action' });
    } finally {
      setIsCreatingToken(false);
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
      await apiPost(`/api/v1/manuscripts/projects/${effectiveProjectId}/clean-aux`);
      toast.success('Cached files cleared. You can recompile whenever ready.', { id: 'clear-cache' });
    } catch {
      try {
        await apiDelete(`/api/v1/manuscripts/projects/${effectiveProjectId}/artifacts`);
        toast.success('Cached files cleared. You can recompile whenever ready.', { id: 'clear-cache' });
      } catch (err: unknown) {
        toast.error((err as Error)?.message || 'Failed to clear cached files', { id: 'clear-cache' });
      }
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

  const handleDownloadPdf = () => {
    downloadPdf(pdfUrl, projectTitle);
  };

  const handleOpenWordCount = () => {
    setSettingsPanelOpen(false);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
  };

  // Personal spelling dictionary
  const { userWords, addWord, removeWord } = useSpellingDictionary(
    undefined,
    currentView === 'dictionary'
  );
  const [newDictionaryWord, setNewDictionaryWord] = useState('');

  const handleAddDictionaryWord = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDictionaryWord.trim().toLowerCase();
    if (!trimmed) return;
    addWord({ word: trimmed, isProject: false });
    setNewDictionaryWord('');
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
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <X className="size-4 shrink-0" />
          </button>
        </div>

        {/* ── Sub-view: GitHub ───────────────────────────────────────────────── */}
        {currentView === 'github' && (
          <div className="flex-1 overflow-y-auto p-5">
            <ProjectGithubTab projectId={effectiveProjectId} projectTitle={projectTitle} />
          </div>
        )}

        {/* ── Sub-view: References ───────────────────────────────────────────── */}
        {currentView === 'references' && (
          <div className="flex-1 overflow-y-auto p-5">
            <ProjectReferencesTab projectId={effectiveProjectId} bibFiles={bibFiles} />
          </div>
        )}

        {/* ── Sub-view: Personal Dictionary ──────────────────────────────────── */}
        {currentView === 'dictionary' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Learned Words</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Words added to your personal spellcheck dictionary won't be flagged as spelling errors.
              </p>
            </div>

            <form onSubmit={handleAddDictionaryWord} className="flex gap-2">
              <Input
                value={newDictionaryWord}
                onChange={(e) => setNewDictionaryWord(e.target.value)}
                placeholder="Add new word..."
                className="h-8 text-xs bg-background"
              />
              <Button type="submit" size="sm" className="h-8 px-3 text-xs shrink-0 cursor-pointer">
                <Plus className="size-3.5 mr-1" />
                Add
              </Button>
            </form>

            <div className="flex flex-wrap gap-1.5 pt-2 max-h-[300px] overflow-y-auto">
              {userWords && userWords.length > 0 ? (
                userWords.map((word) => (
                  <Badge
                    key={word}
                    variant="secondary"
                    className="flex items-center gap-1 text-xs py-1 px-2.5 font-normal"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => removeWord({ word, isProject: false })}
                      className="hover:text-destructive cursor-pointer ml-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">
                  No learned words yet. Words you add from spellcheck suggestions will appear here.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Primary Overleaf Menu Body ─────────────────────────────────────── */}
        {currentView === 'menu' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-foreground">
            {/* 1. DOWNLOAD SECTION */}
            <section aria-labelledby="menu-download-heading">
              <h3
                id="menu-download-heading"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2.5"
              >
                Download
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isExporting}
                  aria-label="Download Source (.zip)"
                  className="flex flex-col items-center justify-center p-3 rounded-md border border-border bg-card/50 hover:bg-muted/70 hover:border-foreground/30 transition-colors cursor-pointer group text-center"
                >
                  <div className="size-8 rounded-md bg-muted text-foreground flex items-center justify-center mb-1.5">
                    {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
                  </div>
                  <span className="text-xs font-medium text-foreground">Source</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">.zip archive</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  aria-label="Download PDF"
                  className="flex flex-col items-center justify-center p-3 rounded-md border border-border bg-card/50 hover:bg-muted/70 hover:border-foreground/30 transition-colors cursor-pointer group text-center"
                >
                  <div className="size-8 rounded-md bg-muted text-foreground flex items-center justify-center mb-1.5">
                    <FileDown className="size-4" />
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
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2.5"
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
                    <p className="text-xs font-medium text-foreground">GitHub</p>
                    <p className="text-[11px] text-muted-foreground truncate">Sync repository & commits</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentView('github')}
                  className="h-7 text-xs px-2.5 cursor-pointer"
                >
                  Configure
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
                    className="h-6 px-2 text-[11px] cursor-pointer"
                  >
                    {copiedGitUrl ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                    <span className="ml-1">{copiedGitUrl ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <div className="pt-1 border-t border-border/40 text-[11px] text-muted-foreground space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>Xác thực: HTTP Basic (Password = Git Token)</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateGitToken}
                      disabled={isCreatingToken}
                      className="h-5 px-2 text-[10px] cursor-pointer"
                    >
                      {isCreatingToken ? 'Đang tạo...' : 'Tạo Git Token'}
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
                        className="h-5 px-1.5 text-[10px] cursor-pointer"
                      >
                        {copiedGitToken ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                      </Button>
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
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2.5"
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
            <section aria-labelledby="menu-settings-heading" className="space-y-1">
              <h3
                id="menu-settings-heading"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2.5"
              >
                Settings
              </h3>

              {/* Compiler */}
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
                    className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
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
                    <SelectItem value="latex" className="cursor-pointer text-xs">
                      LaTeX
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* TeX Live Version */}
              <SettingRow
                title="TeX Live version"
                description="The version of TeX Live used to compile"
              >
                <Select
                  value={texLiveVersion}
                  onValueChange={setTexLiveVersion}
                >
                  <SelectTrigger
                    aria-label="TeX Live version"
                    className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024" className="cursor-pointer text-xs">2024</SelectItem>
                    <SelectItem value="2023" className="cursor-pointer text-xs">2023</SelectItem>
                    <SelectItem value="2022" className="cursor-pointer text-xs">2022</SelectItem>
                    <SelectItem value="2021" className="cursor-pointer text-xs">2021</SelectItem>
                    <SelectItem value="2020" className="cursor-pointer text-xs">2020</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Main Document */}
              <SettingRow
                title="Main document"
                description="The root .tex document passed to the compiler"
              >
                <Select
                  value={mainFile || texFiles[0] || 'main.tex'}
                  onValueChange={handleMainFileChange}
                >
                  <SelectTrigger
                    aria-label="Main document"
                    className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Select entrypoint" />
                  </SelectTrigger>
                  <SelectContent>
                    {texFiles.map((fn) => (
                      <SelectItem key={fn} value={fn} className="cursor-pointer text-xs">
                        {fn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Main Bibliography File (Overleaf Parity) */}
              <SettingRow
                title="Main bibliography file"
                description="The primary .bib file used for citation autocomplete & reference search"
              >
                <Select
                  value={mainBibFile || 'auto'}
                  onValueChange={setMainBibFile}
                >
                  <SelectTrigger
                    aria-label="Main bibliography file"
                    className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Select bib file" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" className="cursor-pointer text-xs">
                      Auto-detect
                    </SelectItem>
                    {bibFiles.map((fn) => (
                      <SelectItem key={fn} value={fn} className="cursor-pointer text-xs">
                        {fn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Reference Search Style (Overleaf Parity) */}
              <SettingRow
                title="Reference search style"
                description="Citation format for searching and referencing entries"
              >
                <Select
                  value={referenceSearchStyle || 'author-year'}
                  onValueChange={(val) => setReferenceSearchStyle(val as 'author-year' | 'numeric' | 'alphanumeric')}
                >
                  <SelectTrigger
                    aria-label="Reference search style"
                    className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="author-year" className="cursor-pointer text-xs">
                      Author-Year
                    </SelectItem>
                    <SelectItem value="numeric" className="cursor-pointer text-xs">
                      Numeric ([1])
                    </SelectItem>
                    <SelectItem value="alphanumeric" className="cursor-pointer text-xs">
                      Alphanumeric ([Knu84])
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Spell Check */}
              <SettingRow
                title="Spell check"
                description="Spell check language for LaTeX text"
              >
                <Select
                  value={spellCheck ? spellCheckLanguage : 'off'}
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
                    aria-label="Spell check language"
                    className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off" className="cursor-pointer text-xs">Off</SelectItem>
                    <SelectItem value="en-US" className="cursor-pointer text-xs">English (US)</SelectItem>
                    <SelectItem value="en-GB" className="cursor-pointer text-xs">English (UK)</SelectItem>
                    <SelectItem value="vi" className="cursor-pointer text-xs">Tiếng Việt</SelectItem>
                    <SelectItem value="fr" className="cursor-pointer text-xs">Français</SelectItem>
                    <SelectItem value="de" className="cursor-pointer text-xs">Deutsch</SelectItem>
                    <SelectItem value="es" className="cursor-pointer text-xs">Español</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Auto-compile */}
              <SettingRow
                title="Auto-compile"
                description="Automatically compile on document changes"
              >
                <OverleafSwitch
                  checked={autoCompile}
                  onCheckedChange={setAutoCompile}
                  aria-label="Auto-compile toggle"
                />
              </SettingRow>

              {/* Auto-close brackets */}
              <SettingRow
                title="Auto-close brackets"
                description="Automatically insert matching brackets and quotes"
              >
                <OverleafSwitch
                  checked={autoCloseBrackets}
                  onCheckedChange={setAutoCloseBrackets}
                  aria-label="Auto-close brackets toggle"
                />
              </SettingRow>

              {/* Code check (Linter) */}
              <SettingRow
                title="Code check"
                description="Inline syntax linting and LaTeX warnings"
              >
                <OverleafSwitch
                  checked={linterEnabled}
                  onCheckedChange={setLinterEnabled}
                  aria-label="Code check toggle"
                />
              </SettingRow>

              {/* Keybindings */}
              <SettingRow
                title="Keybindings"
                description="Keyboard navigation and shortcut behavior"
              >
                <Select
                  value={keybinding}
                  onValueChange={(val) => setKeybinding(val as KeybindingMode)}
                >
                  <SelectTrigger
                    aria-label="Editor keybinding"
                    className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Keybinding" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard" className="cursor-pointer text-xs">Standard</SelectItem>
                    <SelectItem value="vim" className="cursor-pointer text-xs">Vim</SelectItem>
                    <SelectItem value="emacs" className="cursor-pointer text-xs">Emacs</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Font Size */}
              <SettingRow
                title="Font size"
                description="Editor editor font size in pixels"
              >
                <Select
                  value={String(fontSize)}
                  onValueChange={(val) => setFontSize(Number(val))}
                >
                  <SelectTrigger
                    aria-label="Font size"
                    className="w-24 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITOR_FONT_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)} className="cursor-pointer text-xs">
                        {s}px
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Font Family */}
              <SettingRow
                title="Font family"
                description="Monospace typeface for code editing"
              >
                <Select
                  value={fontFamily || 'default'}
                  onValueChange={setFontFamily}
                >
                  <SelectTrigger
                    aria-label="Font family"
                    className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Font" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITOR_FONT_FAMILIES.map((f) => (
                      <SelectItem key={f.id} value={f.id} className="cursor-pointer text-xs">
                        {f.label.split(' ')[0]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Line Height */}
              <SettingRow
                title="Line height"
                description="Vertical spacing between lines of code"
              >
                <Select
                  value={String(lineHeight || 1.5)}
                  onValueChange={(val) => setLineHeight(Number(val))}
                >
                  <SelectTrigger
                    aria-label="Line height"
                    className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Line height" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.2" className="cursor-pointer text-xs">Compact</SelectItem>
                    <SelectItem value="1.5" className="cursor-pointer text-xs">Normal</SelectItem>
                    <SelectItem value="1.8" className="cursor-pointer text-xs">Comfortable</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Editor Theme */}
              <SettingRow
                title="Editor theme"
                description="Code editor syntax highlighting color theme"
              >
                <Select
                  value={editorTheme}
                  onValueChange={(val) => setEditorTheme(val as EditorTheme)}
                >
                  <SelectTrigger
                    aria-label="Editor theme"
                    className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latex-light" className="cursor-pointer text-xs">LaTeX Light</SelectItem>
                    <SelectItem value="latex-dark" className="cursor-pointer text-xs">LaTeX Dark</SelectItem>
                    <SelectItem value="monokai" className="cursor-pointer text-xs">Monokai</SelectItem>
                    <SelectItem value="dracula" className="cursor-pointer text-xs">Dracula</SelectItem>
                    <SelectItem value="solarized-light" className="cursor-pointer text-xs">Solarized Light</SelectItem>
                    <SelectItem value="solarized-dark" className="cursor-pointer text-xs">Solarized Dark</SelectItem>
                    <SelectItem value="github-light" className="cursor-pointer text-xs">GitHub Light</SelectItem>
                    <SelectItem value="github-dark" className="cursor-pointer text-xs">GitHub Dark</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* PDF Viewer */}
              <SettingRow
                title="PDF viewer"
                description="Document viewer engine"
              >
                <Select
                  value={pdfViewer}
                  onValueChange={(val) => setPdfViewer(val as 'overleaf' | 'browser')}
                >
                  <SelectTrigger
                    aria-label="PDF viewer"
                    className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
                  >
                    <SelectValue placeholder="Viewer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overleaf" className="cursor-pointer text-xs">Overleaf</SelectItem>
                    <SelectItem value="browser" className="cursor-pointer text-xs">Native</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Draft Mode (Fast compile) - Overleaf Parity */}
              <SettingRow
                title="Draft mode"
                description="Speeds up compilation by skipping image inclusion"
              >
                <OverleafSwitch
                  checked={compileMode === 'draft'}
                  onCheckedChange={(checked) => setCompileMode(checked ? 'draft' : 'full')}
                  aria-label="Draft mode toggle"
                />
              </SettingRow>

              {/* Stop on First Error */}
              <SettingRow
                title="Stop on first error"
                description="Halt compiler immediately on fatal TeX error"
              >
                <OverleafSwitch
                  checked={stopOnFirstError}
                  onCheckedChange={setStopOnFirstError}
                  aria-label="Stop on first error toggle"
                />
              </SettingRow>

              {/* Clear Cached Files */}
              <SettingRow
                title="Clear cached files"
                description="Remove auxiliary build files (.aux, .bbl)"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className="h-8 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                >
                  {isClearingCache ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="size-3.5 mr-1.5" />
                  )}
                  Clear cache
                </Button>
              </SettingRow>
            </section>

            {/* 5. INTEGRATIONS & TOOLS */}
            <section aria-labelledby="menu-tools-heading" className="space-y-2 pt-2 border-t border-border">
              <h3
                id="menu-tools-heading"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2.5"
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
