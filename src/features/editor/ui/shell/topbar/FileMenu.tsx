'use client';

/**
 * FileMenu.tsx
 *
 * Topbar File Dropdown Menu (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/FileMenu.tsx`
 */

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSub, MenubarSubTrigger, MenubarSubContent, MenubarSeparator } from '@/shared/components/ui/menubar';
import { usePageStore } from '@/features/editor/store/editor.store';
import { useCompileStore } from '@/features/editor/store/compiler.store';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { useLayoutStore } from '@/features/editor/store/layout.store';
import { useProjectExport } from '@/features/editor/ui/hooks/use-export';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { Download, FileArchive, FileText, FileCode, Archive } from 'lucide-react';
import { duplicateProjectApi } from '@/features/projects/shell/services/project.service';
import { extractProjectId } from '@/features/editor/domain/types';

export function FileMenu({ value = 'file' }: { value?: string } = {}) {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const { getContent } = useEditorInstance();
  const pdfUrl = useCompileStore((s) => s.pdfUrl);
  const setIsTemplateModalOpen = useSettingsStore((s) => s.setIsTemplateModalOpen);
  const [isZipping, setIsZipping] = useState(false);

  const handleNewFile = () => {
    useLayoutStore.getState().setActiveSidebarTab('files');
    useLayoutStore.getState().setSidebarLeftOpen(true);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'new-file' } });
  };

  const handleNewFolder = () => {
    useLayoutStore.getState().setActiveSidebarTab('files');
    useLayoutStore.getState().setSidebarLeftOpen(true);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'new-folder' });
  };

  const handleUploadFile = () => {
    useLayoutStore.getState().setActiveSidebarTab('files');
    useLayoutStore.getState().setSidebarLeftOpen(true);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'upload' } });
  };

  const handleTemplateGallery = () => {
    setIsTemplateModalOpen(true);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'template-gallery' });
  };

  const {
    downloadPdf,
    downloadCopy,
    exportZip,
    exportArxiv,
    exportWord,
    exportMarkdown,
    exportHtml,
  } = useProjectExport();
  const router = useRouter();
  const [isCopying, setIsCopying] = useState(false);

  const handleMakeCopy = async () => {
    const effectiveProjId = params?.projectId || extractProjectId(currentPage);
    if (effectiveProjId) {
      const toastId = toast.loading('Duplicating project...');
      setIsCopying(true);
      try {
        const res = (await duplicateProjectApi(effectiveProjId)) as {
          project?: { id?: string };
          id?: string;
        } | null;
        const newProjId = res?.project?.id || res?.id;
        toast.success('Project duplicated successfully!', { id: toastId });
        if (newProjId) {
          router.push(`/projects/${newProjId}/pages`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to duplicate project, downloading backup file instead.';
        toast.error(message, { id: toastId });
        downloadCopy(getContent(), activeFilePage?.title || currentPage?.title);
      } finally {
        setIsCopying(false);
      }
    } else {
      downloadCopy(getContent(), activeFilePage?.title || currentPage?.title);
    }
  };


  const handleDownloadPdf = () => {
    downloadPdf(pdfUrl, currentPage?.title);
  };

  const handleDownloadZip = () => {
    const rootId = params?.pageId || params?.projectId || currentPage?.id;
    if (!rootId) return;
    exportZip({
      parentPageId: rootId,
      projectTitle: currentPage?.title,
      currentContent: getContent(),
      activeFileId: activeFilePage?.id,
      activeFileTitle: activeFilePage?.title,
    });
  };

  const handleDownloadArxiv = () => {
    const rootId = params?.pageId || params?.projectId || currentPage?.id;
    if (!rootId) return;
    exportArxiv({
      parentPageId: rootId,
      projectTitle: currentPage?.title,
      currentContent: getContent(),
      activeFileId: activeFilePage?.id,
      activeFileTitle: activeFilePage?.title,
    });
  };

  const handleExportWord = () => {
    const docId = params?.pageId || params?.projectId || currentPage?.id;
    exportWord({
      pageId: docId || '',
      projectTitle: currentPage?.title,
    });
  };

  const handleExportMarkdown = () => {
    const docId = params?.pageId || params?.projectId || currentPage?.id;
    exportMarkdown({
      pageId: docId || '',
      projectTitle: currentPage?.title,
      fallbackContent: getContent(),
    });
  };

  const handleExportHtml = () => {
    const content = getContent();
    exportHtml({
      content,
      projectTitle: currentPage?.title,
    });
  };

  return (
    <MenubarMenu value={value}>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary select-none transition-colors">
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
                <span className="text-11 text-muted-foreground whitespace-nowrap">Tải toàn bộ mã nguồn LaTeX & thư viện</span>
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
                <span className="text-11 text-muted-foreground whitespace-nowrap">Gói chuẩn hóa cho arXiv / tạp chí</span>
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
                  {pdfUrl ? 'Tệp PDF đã biên dịch mới nhất' : 'Cần biên dịch tài liệu trước'}
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
