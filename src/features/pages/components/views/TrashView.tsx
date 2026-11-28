'use client';

import React, { useState } from 'react';
import { FileText, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { formatDate } from '@/shared/lib/utils';
import { usePageActions } from '@/features/pages/hooks/use-page';
import type { Page } from '@/features/pages/types/page.types';

interface TrashViewProps {
  pages: Page[];
}

export const TrashView = React.memo(function TrashView({ pages }: TrashViewProps) {
  const { restorePage, purgePage } = usePageActions();
  const [pendingPurge, setPendingPurge] = useState<{ id: string; title: string } | null>(null);

  return (
    <>
      <div className="flex-1 w-full overflow-x-auto select-none pb-8">
        <table className="w-full min-w-[680px] table-fixed text-left border-collapse">
          <colgroup>
            <col style={{ width: '44%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="h-8 text-12 font-medium text-muted-foreground border-b border-border">
              <th className="px-4 h-8 align-middle text-left border-b border-border">Page</th>
              <th className="px-3 h-8 align-middle text-left border-b border-border">Author</th>
              <th className="px-3 h-8 align-middle text-left border-b border-border">Deleted</th>
              <th className="px-4 h-8 align-middle text-right border-b border-border">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {pages.map((page) => (
              <tr key={page.id} className="h-11 hover:bg-muted/40 transition-colors">
                <td className="px-4 py-0 align-middle min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span className="truncate text-13 font-medium text-foreground" title={page.title}>
                      {page.title}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-0 align-middle text-12 text-muted-foreground truncate">
                  {page.author?.name || 'Author'}
                </td>
                <td className="px-3 py-0 align-middle text-12 text-muted-foreground">
                  {page.deletedAt || page.updatedAt
                    ? formatDate(page.deletedAt || page.updatedAt || '')
                    : '—'}
                </td>
                <td className="px-4 py-0 align-middle text-right">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={restorePage.isPending}
                      onClick={() => restorePage.mutate(page.id)}
                      className="h-7 px-2.5 text-12 gap-1.5 cursor-pointer shadow-none"
                    >
                      <RotateCcw className="size-3.5" strokeWidth={1.5} />
                      Restore
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={purgePage.isPending}
                      onClick={() => setPendingPurge({ id: page.id, title: page.title })}
                      className="h-7 px-2.5 text-12 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.5} />
                      Delete permanently
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={Boolean(pendingPurge)}
        onOpenChange={(open) => {
          if (!open) setPendingPurge(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingPurge?.title}&rdquo; and all of its documents and files will be permanently
              removed and cannot be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingPurge) {
                  purgePage.mutate(pendingPurge.id);
                  setPendingPurge(null);
                }
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
