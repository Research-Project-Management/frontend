import React from 'react';
import { FileText, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
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
  activeFile: string | null;
  version: number | null;
  isRestoring: boolean;
  confirmRestore: boolean;
  onConfirmRestoreChange: (confirm: boolean) => void;
  onRestoreFile: (version: number) => void;
}

export function SnapshotFileView({
  snapshot,
  isLoading,
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
      <main className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground text-xs gap-2 min-w-0">
        <Loader2 className="size-6 animate-spin text-primary" />
        <span>Loading snapshot v{version}...</span>
      </main>
    );
  }

  if (!activeFile || !fileEntry) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground text-xs p-6 text-center min-w-0">
        <FileText className="size-6 mb-2 opacity-40" strokeWidth={1.5} />
        <p className="font-medium text-foreground">Select a file to inspect</p>
        <p className="text-[11px] mt-0.5">
          Choose any file from the left tree to view its content at v{version}.
        </p>
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
