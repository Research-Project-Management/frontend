import React from 'react';
import { FileText, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState, type PlaneErrorStateProps } from '@/shared/components/ui/PlaneErrorState';
import type { ProjectSnapshotDetail } from '@/features/editor/domain/types/history.types';

function findSnapshotFile(
  files: ProjectSnapshotDetail['files'] | undefined,
  filePath: string | null,
) {
  if (!files || !filePath) return undefined;
  return files[filePath] || files[`/${filePath}`] || files[filePath.replace(/^\//, '')];
}

function getSnapshotContent(
  entry: ProjectSnapshotDetail['files'][string] | undefined,
): string {
  if (!entry) return '';
  return typeof entry === 'string'
    ? entry
    : entry.content ?? (entry.lines ? entry.lines.join('\n') : '');
}

interface SnapshotFileViewProps {
  snapshot: ProjectSnapshotDetail | null | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  activeFile: string | null;
  version: number | null;
  isRestoring: boolean;
  confirmRestore: boolean;
  onConfirmRestoreChange: (confirm: boolean) => void;
  onRestoreFile: (version: number) => void;
}

const SNAPSHOT_LINE_WIDTHS = [
  '62%',
  '44%',
  '78%',
  '30%',
  '56%',
  '84%',
  '38%',
  '68%',
  '24%',
  '74%',
  '50%',
  '34%',
  '66%',
  '48%',
  '72%',
  '40%',
];

export function SnapshotFileView({
  snapshot,
  isLoading,
  error,
  onRetry,
  activeFile,
  version,
  isRestoring,
  confirmRestore,
  onConfirmRestoreChange,
  onRestoreFile,
}: SnapshotFileViewProps) {
  const fileEntry = findSnapshotFile(snapshot?.files, activeFile);

  if (isLoading) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Skeleton className="size-3.5 rounded-sm shrink-0" />
            <Skeleton className="h-3.5 w-36 rounded-sm" />
            <Skeleton className="h-4 w-8 rounded-sm" />
          </div>
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
        <div className="flex-1 overflow-hidden p-4 space-y-2">
          {SNAPSHOT_LINE_WIDTHS.map((width, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Skeleton className="h-3 w-7 rounded-sm shrink-0 opacity-60" />
              <Skeleton className="h-3.5 rounded-sm" style={{ width }} />
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        <PlaneErrorState
          title="Failed to load snapshot"
          description={version != null ? `Could not load snapshot v${version}.` : 'Could not load snapshot.'}
          error={error as PlaneErrorStateProps['error']}
          action={
            onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry} className="h-8 text-xs cursor-pointer">
                Try again
              </Button>
            ) : undefined
          }
        />
      </main>
    );
  }

  if (!activeFile || !fileEntry) {
    return (
      <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
        <PlaneEmptyState
          variant="document"
          title="Select a file to inspect"
          description={
            version != null
              ? `Choose any file from the left tree to view its content at v${version}.`
              : 'Choose a version and file to inspect its snapshot.'
          }
        />
      </main>
    );
  }

  const lines = getSnapshotContent(fileEntry).split('\n');

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border text-xs shrink-0 select-none gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <span className="font-mono font-semibold text-foreground truncate">{activeFile}</span>
          {version != null && (
            <Badge variant="outline" className="text-10 font-mono h-4 px-1.5">
              v{version}
            </Badge>
          )}
        </div>

        {version != null && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant={confirmRestore ? 'destructive' : 'secondary'}
              size="sm"
              className="h-7 min-h-[28px] px-2.5 text-xs gap-1.5 cursor-pointer font-medium"
              disabled={isRestoring}
              onClick={() => {
                if (confirmRestore) {
                  onRestoreFile(version);
                } else {
                  onConfirmRestoreChange(true);
                }
              }}
            >
              {isRestoring ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RotateCcw className="size-3" />
              )}
              <span>
                {confirmRestore
                  ? `Confirm restore ${activeFile.split('/').pop() || 'file'} to v${version}`
                  : 'Restore this file'}
              </span>
            </Button>
            {confirmRestore && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs cursor-pointer"
                onClick={() => onConfirmRestoreChange(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-background">
        <table className="w-full border-collapse font-mono text-xs leading-5">
          <tbody>
            {lines.map((lineText, idx) => (
              <tr key={idx} className="hover:bg-muted/30">
                <td className="w-12 select-none text-right pr-3 pl-2 py-0.5 text-muted-foreground/60 border-r border-border/50 align-top">
                  {idx + 1}
                </td>
                <td className="px-3 py-0.5 whitespace-pre-wrap break-words text-foreground">
                  {lineText || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
