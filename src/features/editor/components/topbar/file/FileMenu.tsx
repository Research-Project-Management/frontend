'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
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

export default function FileMenu() {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const { currentPage, activeFilePage } = usePageStore();
  const { getContent } = useEditorInstance();
  const { pdfUrl } = useCompileStore();
  const { setSettingsPanelOpen, toggleHistory, setIsTemplateModalOpen } = useSettingsStore();
  const [isZipping, setIsZipping] = useState(false);

  const handleNewFile = () => {
    EditorEventBus.emit('flux:new-file');
  };

  const handleNewFolder = () => {
    EditorEventBus.emit('flux:new-folder');
  };

  const handleUploadFile = () => {
    EditorEventBus.emit('flux:upload-file');
  };

  const {
    downloadPdf,
    downloadCopy,
    exportZip,
    exportWord,
    exportMarkdown,
    exportHtml,
  } = useProjectExport();

  const handleMakeCopy = () => {
    downloadCopy(getContent(), activeFilePage?.title || currentPage?.title);
  };

  const handleWordCount = () => {
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
      <MenubarContent className="min-w-48 text-xs z-[9999]">
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
          className="cursor-pointer"
        >
          Make a copy
        </MenubarItem>

        <MenubarSeparator />

        <MenubarItem
          onClick={toggleHistory}
          className="cursor-pointer"
        >
          Show version history
        </MenubarItem>
        <MenubarItem
          onClick={handleWordCount}
          className="cursor-pointer"
        >
          Word count
        </MenubarItem>

        <MenubarSeparator />

        <MenubarItem
          onClick={() => setIsTemplateModalOpen(true)}
          className="cursor-pointer"
        >
          Submit
        </MenubarItem>

        <MenubarSeparator />

        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            Download
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-56 text-xs z-[9999]">
            <MenubarItem
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="cursor-pointer"
            >
              Download as source (.zip)
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
