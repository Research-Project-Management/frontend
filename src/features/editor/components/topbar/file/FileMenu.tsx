'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarSeparator,
} from "@/shared/components/ui";
import { usePageStore, useCompileStore, useSettingsStore } from '@/features/editor/store';
import { useProjectExport } from '@/features/editor/hooks/use-export';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { duplicateProjectApi } from '@/features/projects/shell/services/project.service';

export default function FileMenu() {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const { getContent } = useEditorInstance();
  const pdfUrl = useCompileStore((s) => s.pdfUrl);
  const setSettingsPanelOpen = useSettingsStore((s) => s.setSettingsPanelOpen);
  const setIsTemplateModalOpen = useSettingsStore((s) => s.setIsTemplateModalOpen);
  const [isZipping, setIsZipping] = useState(false);

  const handleNewFile = () => {
    useSettingsStore.getState().setActiveSidebarPanel('Files');
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'new-file' } });
    EditorEventBus.emit('flux:open-add-files', { initialTab: 'new-file' });
  };

  const handleNewFolder = () => {
    useSettingsStore.getState().setActiveSidebarPanel('Files');
    EditorEventBus.emit('flux:new-folder');
  };

  const handleUploadFile = () => {
    useSettingsStore.getState().setActiveSidebarPanel('Files');
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'upload' } });
    EditorEventBus.emit('flux:open-add-files', { initialTab: 'upload' });
  };

  const handleDeletedFiles = () => {
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'deleted-files' });
    EditorEventBus.emit('flux:open-deleted-files');
  };

  const handleTemplateGallery = () => {
    setIsTemplateModalOpen(true);
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'template-gallery' });
    EditorEventBus.emit('flux:open-template-gallery');
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
    const projId = params?.projectId || (currentPage as any)?.projectId;
    const effectiveProjId = typeof projId === 'object' ? projId?.id : projId;
    if (effectiveProjId) {
      const toastId = toast.loading('Duplicating project...');
      setIsCopying(true);
      try {
        const res = await duplicateProjectApi(effectiveProjId);
        const newProjId = (res as any)?.project?.id || (res as any)?.id;
        toast.success('Project duplicated successfully!', { id: toastId });
        if (newProjId) {
          router.push(`/projects/${newProjId}/pages`);
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to duplicate project, downloading backup file instead.', { id: toastId });
        downloadCopy(getContent(), activeFilePage?.title || currentPage?.title);
      } finally {
        setIsCopying(false);
      }
    } else {
      downloadCopy(getContent(), activeFilePage?.title || currentPage?.title);
    }
  };

  const handleWordCount = () => {
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
    EditorEventBus.emit('flux:open-word-count');
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
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md">
        File
      </MenubarTrigger>
      <MenubarContent className="min-w-48 text-xs">
        <MenubarItem
          onClick={handleNewFile}
          className="cursor-pointer"
        >
          New file
        </MenubarItem>
        <MenubarItem
          onClick={handleNewFolder}
          className="cursor-pointer"
        >
          New folder
        </MenubarItem>
        <MenubarItem
          onClick={handleUploadFile}
          className="cursor-pointer"
        >
          Upload file
        </MenubarItem>
        <MenubarItem
          onClick={handleMakeCopy}
          disabled={isCopying}
          className="cursor-pointer"
        >
          {isCopying ? 'Duplicating project...' : 'Make a copy'}
        </MenubarItem>

        <MenubarItem
          onClick={handleDeletedFiles}
          className="cursor-pointer"
        >
          Deleted files
        </MenubarItem>
        <MenubarItem
          onClick={handleWordCount}
          onSelect={handleWordCount}
          className="cursor-pointer"
        >
          Word count
        </MenubarItem>

        <MenubarSeparator />

        <MenubarItem
          onClick={handleTemplateGallery}
          className="cursor-pointer"
        >
          Template gallery
        </MenubarItem>

        <MenubarSeparator />

        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            Download
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-56 text-xs">
            <MenubarItem
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="cursor-pointer"
            >
              Download as source (.zip)
            </MenubarItem>
            <MenubarItem
              onClick={handleDownloadArxiv}
              disabled={isZipping}
              className="cursor-pointer"
            >
              Download as arXiv submission (.zip)
            </MenubarItem>
            <MenubarItem
              onClick={handleDownloadPdf}
              disabled={!pdfUrl}
              className="cursor-pointer"
            >
              Download as PDF
            </MenubarItem>
            <MenubarItem
              onClick={handleExportWord}
              className="cursor-pointer"
            >
              Export as Word document (.docx)
            </MenubarItem>
            <MenubarItem
              onClick={handleExportMarkdown}
              className="cursor-pointer"
            >
              Export as Markdown (.md)
            </MenubarItem>
            <MenubarItem
              onClick={handleExportHtml}
              className="cursor-pointer"
            >
              Export as HTML (.html)
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        <MenubarItem
          onClick={() => setSettingsPanelOpen(true)}
          className="cursor-pointer"
        >
          Settings
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
