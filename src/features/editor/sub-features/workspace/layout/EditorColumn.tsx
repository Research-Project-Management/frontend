'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { FileCode2 } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui';
import Tabs from '../../../components/editor/Tabs';
import { ImagePanel } from './ImagePanel';
import { useActiveDocument } from '../../../hooks/use-core';
import { useCollaborationStream } from '../../../hooks/use-collaboration';

const Editor = dynamic(() => import('../../../components/editor/Editor'), { ssr: false });

function EmptyEditorState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none bg-background">
      <div className="size-14 rounded-lg bg-muted border border-border flex items-center justify-center">
        <FileCode2 className="size-7 text-muted-foreground/50 shrink-0" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">No file open</p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          Select a document from the Files explorer or create a new file to start writing.
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-full w-full flex flex-col bg-background animate-in fade-in duration-300">
      <div className="h-10 border-b border-border bg-secondary/40 flex items-center gap-2 px-3">
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <div className="flex-1" />
        <Skeleton className="h-5 w-5 rounded-sm" />
        <Skeleton className="h-5 w-5 rounded-sm" />
      </div>
      <div className="h-10 border-b border-border bg-background flex items-center gap-px px-2">
        {[100, 120, 80].map((w, i) => (
          <Skeleton key={i} className="h-6 rounded-md" style={{ width: w }} />
        ))}
      </div>
      <div className="flex-1 bg-[var(--editor-bg,hsl(var(--background)))] p-5 space-y-2.5">
        {Array.from({ length: 22 }).map((_, i) => {
          const widths = ['65%', '45%', '80%', '30%', '55%', '85%', '40%', '70%', '25%', '75%', '50%', '35%'];
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-7 text-right">
                <Skeleton className="h-3 w-4 ml-auto opacity-40" />
              </span>
              <Skeleton className="h-3.5 rounded-sm" style={{ width: widths[i % widths.length] }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EditorColumn() {
  const { isLoading, activePage, isAssetTab, displayPage, pageId, fileId, selectedAsset } =
    useActiveDocument();

  // Stream real-time events for active sub-file if different from root page
  const childPageId = displayPage?.id && displayPage.id !== pageId ? displayPage.id : null;
  useCollaborationStream(undefined, childPageId);

  if (isLoading) return <LoadingSkeleton />;

  if (!activePage) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-muted-foreground text-sm">Page not found</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden flex flex-col bg-background">
      {pageId && <Tabs rootPageId={pageId} activeFileId={fileId ?? activePage.id ?? ''} />}
      <div className="flex-1 overflow-hidden">
        {isAssetTab ? (
          <ImagePanel asset={selectedAsset!} />
        ) : displayPage ? (
          <Editor page={displayPage as any} />
        ) : (
          <EmptyEditorState />
        )}
      </div>
    </div>
  );
}
