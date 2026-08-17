'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from '@/shared/components/ui';
import { usePageStore } from '@/features/editor/store/page.store';
import { useCompileStore } from '@/features/editor/store/compile.store';
import { getExportFilename } from '@/features/editor/utils/topbar.util';

export default function FileMenu() {
  const router = useRouter();
  const { getEditorContent, compileRef, currentPage } = usePageStore();
  const { compileStatus, pdfUrl } = useCompileStore();

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

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground cursor-pointer rounded-sm">
        File
      </MenubarTrigger>
      <MenubarContent className="min-w-48 text-xs z-[9999]">
        <MenubarItem
          onClick={() => compileRef.current?.()}
          disabled={isCompiling}
        >
          Compile PDF
          <MenubarShortcut>Ctrl+Enter</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={handleDownloadSource}>
          Download Source (.tex)
        </MenubarItem>
        <MenubarItem onClick={handleDownloadPdf} disabled={!pdfUrl}>
          Download PDF
          <MenubarShortcut>Ctrl+D</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={() => router.push('/ws')}>
          Close Project
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
