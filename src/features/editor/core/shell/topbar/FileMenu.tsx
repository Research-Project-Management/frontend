'use client';

/**
 * FileMenu.tsx
 *
 * Topbar File Dropdown Menu (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/FileMenu.tsx`
 */

import React from 'react';
import { useParams } from 'next/navigation';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSub, MenubarSubTrigger, MenubarSubContent, MenubarSeparator } from '@/shared/components/ui/menubar';
import { usePageStore } from '../../store/editor.store';
import { useSettingsStore } from '../../store/settings.store';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import { useWorkspaceStore } from '../../store/workspace.store';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { editorCommandBus } from '../../bus/command-bus';
import { Download, FileArchive, FileText, FileCode, Archive, Calculator, Settings, History } from 'lucide-react';
import { GitHubIcon } from '@/shared/components/icons';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { useProjectTitleActions } from './useProjectTitleActions';

export function FileMenu({ value = 'file' }: { value?: string } = {}) {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const { getContent } = useEditorInstance();
  const pdfUrl = useCompileStore((s) => s.pdfUrl);
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const storeProjectId = usePageStore((s) => s.projectId);

  const effectiveProjectId =
    params?.projectId ||
    extractProjectId(currentPage) ||
    storeProjectId ||
    '';

  const {
    isCopying,
    isExporting: isZipping,
    handleMakeCopy,
    handleDownloadPdf,
    handleDownloadZip,
    handleDownloadArxiv,
    handleExportWord,
    handleExportMarkdown,
    handleExportHtml,
  } = useProjectTitleActions({
    effectiveProjectId,
    displayTitle: currentPage?.title || 'Untitled Project',
    currentPage,
    activeFilePage,
    getContent,
    pdfUrl,
    fallbackRootId: params?.pageId,
  });

  const handleGithubSync = () => {
    editorCommandBus.dispatch({
      type: 'dialog:open',
      dialog: 'project-settings',
      payload: { tab: 'github', view: 'github' },
    });
  };

  const handleNewFile = () => {
    useWorkspaceStore.getState().setActiveSidebarTab('files');
    useWorkspaceStore.getState().setSidebarLeftOpen(true);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'new-file' } });
  };

  const handleNewFolder = () => {
    useWorkspaceStore.getState().setActiveSidebarTab('files');
    useWorkspaceStore.getState().setSidebarLeftOpen(true);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'new-folder' });
  };

  const handleUploadFile = () => {
    useWorkspaceStore.getState().setActiveSidebarTab('files');
    useWorkspaceStore.getState().setSidebarLeftOpen(true);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'upload' } });
  };

  const handleTemplateGallery = () => {
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'template-gallery' });
  };

  const handleWordCount = () => {
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
  };

  const handleProjectSettings = () => {
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'project-settings' });
  };

  return (
    <MenubarMenu value={value}>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-border select-none transition-colors">
        File
      </MenubarTrigger>
      <MenubarContent className="min-w-56 text-xs select-none">
        <MenubarItem
          onClick={handleNewFile}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">New file</span>
        </MenubarItem>
        <MenubarItem
          onClick={handleNewFolder}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">New folder</span>
        </MenubarItem>
        <MenubarItem
          onClick={handleUploadFile}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">Upload file</span>
        </MenubarItem>
        <MenubarItem
          onClick={handleMakeCopy}
          disabled={isCopying}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">{isCopying ? 'Duplicating project...' : 'Make a copy'}</span>
        </MenubarItem>

        <MenubarItem
          onClick={handleTemplateGallery}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">Template gallery</span>
        </MenubarItem>

        <MenubarSeparator />

        <MenubarItem
          onClick={() => useSettingsStore.getState().setIsHistoryOpen(true)}
          className="cursor-pointer flex items-center gap-2"
        >
          <History className="size-3.5 text-foreground/80 shrink-0" />
          <span className="whitespace-nowrap">Version history</span>
        </MenubarItem>

        <MenubarItem
          onClick={handleWordCount}
          className="cursor-pointer flex items-center gap-2"
        >
          <Calculator className="size-3.5 text-foreground/80 shrink-0" />
          <span className="whitespace-nowrap">Word count</span>
        </MenubarItem>

        <MenubarItem
          onClick={handleProjectSettings}
          className="cursor-pointer flex items-center gap-2"
        >
          <Settings className="size-3.5 text-foreground/80 shrink-0" />
          <span className="whitespace-nowrap">Project settings</span>
        </MenubarItem>

        <MenubarSeparator />

        <MenubarItem
          onClick={handleGithubSync}
          className="cursor-pointer flex items-center gap-2"
        >
          <GitHubIcon className="size-3.5 text-foreground/80 shrink-0" />
          <span className="whitespace-nowrap">GitHub Sync</span>
        </MenubarItem>

        <MenubarSeparator />

        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer flex items-center justify-between">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Download className="size-3.5 text-muted-foreground shrink-0" />
              <span>Download</span>
            </span>
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-[280px] text-xs select-none">
            <MenubarItem
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="cursor-pointer flex items-center gap-2"
            >
              <FileArchive className="size-3.5 text-foreground/80 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium whitespace-nowrap">Download Source (.zip)</span>
                <span className="text-11 text-muted-foreground whitespace-nowrap">Download all LaTeX source files & assets</span>
              </div>
            </MenubarItem>
            <MenubarItem
              onClick={handleDownloadArxiv}
              disabled={isZipping}
              className="cursor-pointer flex items-center gap-2"
            >
              <Archive className="size-3.5 text-foreground/80 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium whitespace-nowrap">Download arXiv submission (.zip)</span>
                <span className="text-11 text-muted-foreground whitespace-nowrap">Standardized package for arXiv / journal submission</span>
              </div>
            </MenubarItem>
            <MenubarItem
              onClick={handleDownloadPdf}
              disabled={!pdfUrl}
              className="cursor-pointer flex items-center gap-2"
            >
              <FileText className="size-3.5 text-foreground/80 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium whitespace-nowrap">Download PDF</span>
                <span className="text-11 text-muted-foreground whitespace-nowrap">
                  {pdfUrl ? 'Latest compiled PDF document' : 'Compile document first'}
                </span>
              </div>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              onClick={handleExportWord}
              className="cursor-pointer flex items-center gap-2"
            >
              <FileText className="size-3.5 text-foreground/80 shrink-0" />
              <span className="whitespace-nowrap">Export as Word document (.docx)</span>
            </MenubarItem>
            <MenubarItem
              onClick={handleExportMarkdown}
              className="cursor-pointer flex items-center gap-2"
            >
              <FileCode className="size-3.5 text-foreground/80 shrink-0" />
              <span className="whitespace-nowrap">Export as Markdown (.md)</span>
            </MenubarItem>
            <MenubarItem
              onClick={handleExportHtml}
              className="cursor-pointer flex items-center gap-2"
            >
              <FileCode className="size-3.5 text-foreground/80 shrink-0" />
              <span className="whitespace-nowrap">Export as HTML (.html)</span>
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
      </MenubarContent>
    </MenubarMenu>
  );
}

export default FileMenu;
