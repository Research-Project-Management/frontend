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
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-sm">
        File
      </MenubarTrigger>
      <MenubarContent className="min-w-48 py-1.5 px-1 bg-popover dark:bg-[#1b2432] border-border dark:border-[#2e3c51] text-foreground dark:text-slate-200 shadow-xl rounded-md z-[9999]">
        <MenubarItem
          onClick={handleNewFile}
          className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
        >
          New file
        </MenubarItem>
        <MenubarItem
          onClick={handleNewFolder}
          className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
        >
          New folder
        </MenubarItem>
        <MenubarItem
          onClick={handleUploadFile}
          className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
        >
          Upload file
        </MenubarItem>
        <MenubarItem
          onClick={handleMakeCopy}
          className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
        >
          Make a copy
        </MenubarItem>

        <MenubarSeparator className="my-1 border-t border-border/60 dark:border-[#2e3c51]" />

        <MenubarItem
          onClick={toggleHistory}
          className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
        >
          Show version history
        </MenubarItem>
        <MenubarItem
          onClick={handleWordCount}
          className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
        >
          Word count
        </MenubarItem>

        <MenubarSeparator className="my-1 border-t border-border/60 dark:border-[#2e3c51]" />

        <MenubarItem
          onClick={() => setIsTemplateModalOpen(true)}
          className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
        >
          Submit
        </MenubarItem>

        <MenubarSeparator className="my-1 border-t border-border/60 dark:border-[#2e3c51]" />

        <MenubarSub>
          <MenubarSubTrigger className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] data-[state=open]:bg-accent dark:data-[state=open]:bg-[#253246] dark:text-slate-200 font-normal outline-none">
            Download
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-56 py-1.5 px-1 bg-popover dark:bg-[#1b2432] border-border dark:border-[#2e3c51] text-foreground dark:text-slate-200 shadow-xl rounded-md z-[9999]">
            <MenubarItem
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
            >
              Download as source (.zip)
            </MenubarItem>
            <MenubarItem
              onClick={handleDownloadPdf}
              disabled={!pdfUrl}
              className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
            >
              Download as PDF
            </MenubarItem>
            <MenubarItem
              onClick={handleExportWord}
              className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
            >
              Export as Word document (.docx)
            </MenubarItem>
            <MenubarItem
              onClick={handleExportMarkdown}
              className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
            >
              Export as Markdown (.md)
            </MenubarItem>
            <MenubarItem
              onClick={handleExportHtml}
              className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
            >
              Export as HTML (.html)
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        <MenubarItem
          onClick={() => setSettingsPanelOpen(true)}
          className="px-3 py-1.5 text-xs cursor-pointer rounded-sm hover:bg-accent focus:bg-accent dark:hover:bg-[#253246] dark:focus:bg-[#253246] dark:text-slate-200 font-normal outline-none"
        >
          Settings
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
