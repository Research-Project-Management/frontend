'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Archive, Loader2 } from 'lucide-react';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarShortcut } from "@/shared/components/ui";
import { usePageStore } from '@/features/editor/store/page.store';
import { useCompileStore } from '@/features/editor/store/compile.store';
import { getExportFilename } from '@/features/editor/utils/topbar.util';
import { exportProjectAsZip } from '@/features/editor/utils/export-zip.util';

export default function FileMenu() {
  const router = useRouter();
  const params = useParams<{ pageId?: string }>();
  const { getEditorContent, compileRef, currentPage, activeFilePage } = usePageStore();
  const { compileStatus, pdfUrl } = useCompileStore();
  const [isZipping, setIsZipping] = useState(false);

  const isCompiling = compileStatus !== 'idle' && compileStatus !== 'done' && compileStatus !== 'error';

  const handleDownloadSource = () => {
    const src = getEditorContent.current?.() ?? '';
    const blob = new Blob([src], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFilename(currentPage?.title, 'tex');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) return;
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
        currentContent: getEditorContent.current?.(),
        activeFileId: activeFilePage?.id,
        activeFileTitle: activeFilePage?.title,
      });
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted data-[state=open]:bg-muted cursor-pointer rounded-sm">
        File
      </MenubarTrigger>
      <MenubarContent className="min-w-52 text-xs z-[9999]">
        <MenubarItem
          onClick={() => compileRef.current?.()}
          disabled={isCompiling}
        >
          Compile PDF
          <MenubarShortcut>Ctrl+Enter</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={handleDownloadZip} disabled={isZipping}>
          {isZipping ? (
            <Loader2 className="size-3.5 animate-spin mr-2 shrink-0" />
          ) : (
            <Archive className="size-3.5 mr-2 shrink-0 text-primary" />
          )}
          Download Project (.zip)
          <MenubarShortcut>Ctrl+Shift+D</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleDownloadSource}>
          Download Source (.tex)
        </MenubarItem>
        <MenubarItem onClick={handleDownloadPdf} disabled={!pdfUrl}>
          Download PDF
          <MenubarShortcut>Ctrl+D</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={() => router.push('/projects')}>
          Close Project
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

