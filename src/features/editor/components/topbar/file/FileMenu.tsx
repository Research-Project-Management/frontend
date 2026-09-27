import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from "@/shared/components/ui";
import { usePageStore, useCompileStore, useSettingsStore } from '@/features/editor/store';
import { getExportFilename, exportProjectAsZip } from '@/features/editor/utils';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';

export default function FileMenu() {
  const params = useParams<{ pageId?: string }>();
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

  const handleMakeCopy = () => {
    const src = getContent();
    const title = (activeFilePage?.title || currentPage?.title || 'document').replace(/\.tex$/, '');
    const filename = `${title}_copy.tex`;
    const blob = new Blob([src], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Created copy: ${filename}`);
  };

  const handleWordCount = () => {
    const src = getContent();
    const withoutComments = src.replace(/%.*$/gm, '');
    const textOnly = withoutComments
      .replace(/\\(section|subsection|subsubsection|paragraph|caption|textbf|textit|emph)\*?\{([^}]*)\}/g, '$2')
      .replace(/\\[a-zA-Z]+(\[[^\]]*\])?/g, ' ')
      .replace(/[{}$]/g, ' ')
      .trim();

    const words = textOnly ? textOnly.split(/\s+/).filter(Boolean).length : 0;
    const chars = textOnly.length;
    const lines = src.split('\n').length;

    toast.info(`Document statistics: ${words.toLocaleString()} words · ${chars.toLocaleString()} characters · ${lines} lines`);
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) {
      toast.error('Please compile the PDF first.');
      return;
    }
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = getExportFilename(currentPage?.title, 'pdf');
    a.click();
  };

  const handleDownloadZip = async () => {
    const rootId = params?.pageId || currentPage?.id;
    if (!rootId) return;
    setIsZipping(true);
    try {
      await exportProjectAsZip({
        parentPageId: rootId,
        projectTitle: currentPage?.title,
        currentContent: getContent(),
        activeFileId: activeFilePage?.id,
        activeFileTitle: activeFilePage?.title,
      });
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-sm">
        File
      </MenubarTrigger>
      <MenubarContent className="min-w-56 text-xs z-[9999]">
        <MenubarItem onClick={handleNewFile}>
          New file
        </MenubarItem>
        <MenubarItem onClick={handleNewFolder}>
          New folder
        </MenubarItem>
        <MenubarItem onClick={handleUploadFile}>
          Upload file
        </MenubarItem>
        <MenubarItem onClick={handleMakeCopy}>
          Make a copy
        </MenubarItem>
        <MenubarItem onClick={toggleHistory}>
          Show version history
        </MenubarItem>
        <MenubarItem onClick={handleWordCount}>
          Word count
        </MenubarItem>
        <MenubarItem onClick={() => setIsTemplateModalOpen(true)}>
          Submit
        </MenubarItem>
        <MenubarSub>
          <MenubarSubTrigger>
            Download
          </MenubarSubTrigger>
          <MenubarSubContent className="text-xs min-w-48">
            <MenubarItem onClick={handleDownloadZip} disabled={isZipping}>
              Source (.zip)
            </MenubarItem>
            <MenubarItem onClick={handleDownloadPdf} disabled={!pdfUrl}>
              PDF
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarItem onClick={() => setSettingsPanelOpen(true)}>
          Settings
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

