'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DiffEditor } from '@monaco-editor/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { versionService } from '@/features/editor/services/history.service';
import { useSettingsStore } from '@/features/editor/store';
import type { PageVersion } from '@/features/editor/types';
import { GitCompare, RotateCcw, Loader2, Calendar, User, Columns2, Rows2 } from 'lucide-react';

interface HistoryDiffModalProps {
  open: boolean;
  onClose: () => void;
  pageId: string;
  version: PageVersion | null;
  currentContent: string;
  onRestore?: (versionId: string) => void;
}

export function HistoryDiffModal({
  open,
  onClose,
  pageId,
  version,
  currentContent,
  onRestore,
}: HistoryDiffModalProps) {
  const { editorTheme } = useSettingsStore();
  const [renderSideBySide, setRenderSideBySide] = React.useState(true);

  const {
    data: versionDetail,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['page-version-detail', pageId, version?.id],
    queryFn: () =>
      version ? versionService.getById(pageId, version.id) : null,
    enabled: !!version && open,
  });

  const snapshotText = versionDetail?.content ?? '';

  const stats = React.useMemo(() => {
    if (!versionDetail) return null;
    const origCount = snapshotText ? snapshotText.split('\n').length : 0;
    const modCount = currentContent ? currentContent.split('\n').length : 0;
    const diff = modCount - origCount;
    return { origCount, modCount, diff };
  }, [snapshotText, currentContent, versionDetail]);

  if (!version) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[88vh] p-0 flex flex-col gap-0 overflow-hidden border border-border bg-background shadow-2xl">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between shrink-0 bg-muted/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <GitCompare className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold flex items-center gap-2 truncate">
                <span>Diff Comparison: {version.label || 'Snapshot'}</span>
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                  {version.fileName || 'document.tex'}
                </Badge>
                {stats && stats.diff !== 0 && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-mono shrink-0 ${
                      stats.diff > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {stats.diff > 0 ? `+${stats.diff}` : stats.diff} lines
                  </Badge>
                )}
              </DialogTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(version.createdAt).toLocaleString()}
                </span>
                {version.savedBy?.name && (
                  <span className="flex items-center gap-1">
                    <User className="size-3" />
                    {version.savedBy.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs cursor-pointer"
              onClick={() => setRenderSideBySide((v) => !v)}
              title={renderSideBySide ? 'Switch to Inline unified view' : 'Switch to Side-by-Side view'}
            >
              {renderSideBySide ? (
                <Columns2 className="size-3.5 text-primary" />
              ) : (
                <Rows2 className="size-3.5 text-primary" />
              )}
              <span className="hidden md:inline">
                {renderSideBySide ? 'Side-by-Side' : 'Inline'}
              </span>
            </Button>

            <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground mr-2 border-r border-border pr-3">
              <span className="size-2 rounded-full bg-red-500/80" />
              <span>Snapshot</span>
              <span className="mx-1 text-muted-foreground/40">vs</span>
              <span className="size-2 rounded-full bg-emerald-500/80" />
              <span>Current</span>
            </div>

            {onRestore && (
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 text-xs cursor-pointer shadow-sm"
                onClick={() => {
                  onRestore(version.id);
                  onClose();
                }}
              >
                <RotateCcw className="size-3.5" />
                Restore Snapshot
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 w-full min-h-0 relative bg-background">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 z-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs">Loading snapshot content...</span>
            </div>
          ) : isError ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-destructive">
              Failed to load snapshot details.
            </div>
          ) : (
            <DiffEditor
              height="100%"
              original={snapshotText}
              modified={currentContent}
              language="latex"
              theme={editorTheme === 'dark' ? 'latex-dark' : 'latex-light'}
              options={{
                readOnly: true,
                renderSideBySide,
                automaticLayout: true,
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                diffWordWrap: 'on',
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
