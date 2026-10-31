'use client';

import React, { useState } from 'react';
import {
  Trash2,
  Loader2,
  ShieldAlert,
  ExternalLink,
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileJson,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { Item } from '@/features/library/domain/types/core.types';
import type { ReaderDocument } from '@/features/library/domain/types/reader.schema';
import { getRetractionInfo, safeHttpUrl } from '@/features/library/domain/system-views.policy';
import {
  useReaderClipboard,
  useReaderFileDownload,
} from '@/features/library/core/coordinator/reader/use-reader';
import { useExportItemCitationQuery } from '@/features/library/sdk/queries/extraction.queries';

export interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  itemName?: React.ReactNode;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  buttonVariant?: 'blue' | 'red' | 'primary' | 'destructive';
}

export function DeleteModal({
  open,
  onOpenChange,
  title = 'Move to trash',
  description = 'Are you sure you want to move this item to the trash? Items can be restored from the Trash at any time.',
  itemName,
  children,
  onConfirm,
  isDeleting = false,
  confirmLabel = 'Move to trash',
  cancelLabel = 'Cancel',
  icon,
  buttonVariant = 'red',
}: DeleteModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const isRed = buttonVariant === 'red' || buttonVariant === 'destructive';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isDeleting) return; onOpenChange(v); }}>
      <DialogContent
        className="sm:max-w-[520px] p-6 rounded-lg border border-border bg-background shadow-raised-200"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-row items-start gap-3.5 space-y-0 text-left">
          <div
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
              isRed
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary'
            )}
          >
            {icon || <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />}
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-1 text-12 text-foreground leading-normal">
                {description}
              </DialogDescription>
            )}

            {children}

            {itemName && !children && (
              <div className="mt-2.5 px-2.5 py-1.5 rounded-md bg-muted border border-border text-12 text-foreground truncate font-normal leading-normal">
                {itemName}
              </div>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="mt-5 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="h-8 px-3 text-13 font-medium cursor-pointer rounded-md hover:bg-muted"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isRed ? 'destructive' : 'default'}
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="h-8 px-3 text-13 font-medium cursor-pointer rounded-md"
          >
            {isDeleting ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin shrink-0" />
                <span>Processing...</span>
              </span>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface RetractionNoticeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item;
  canEdit?: boolean;
  onDismiss?: () => void | Promise<void>;
  isDismissing?: boolean;
}

export function RetractionNoticeModal({
  open,
  onOpenChange,
  item,
  canEdit = false,
  onDismiss,
  isDismissing = false,
}: RetractionNoticeModalProps) {
  const retractionInfo = getRetractionInfo(item);
  const noticeUrl = safeHttpUrl(
    retractionInfo.noticeUrl ||
      (item.doi ? `https://doi.org/${item.doi}` : undefined),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isDismissing) return; onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[480px] p-6 gap-4">
        <DialogHeader className="p-0 pb-0.5 text-left">
          <DialogTitle className="text-16 font-semibold text-foreground tracking-tight">
            Retraction Notice
          </DialogTitle>
          <DialogDescription className="sr-only">
            Retraction notice and citation warning details for this publication
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-12">
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-destructive/25 bg-destructive/10 text-destructive">
            <ShieldAlert
              className="size-4 shrink-0 mt-0.5 text-destructive"
              strokeWidth={1.75}
            />
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-12 font-semibold text-destructive leading-snug">
                This publication has been retracted
              </p>
              <p className="text-11 text-muted-foreground leading-normal">
                Flagged by Retraction Watch and Crossref academic integrity
                databases.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted border border-border p-3 space-y-1">
            <span className="text-10 uppercase tracking-wider font-semibold text-muted-foreground block">
              Publication
            </span>
            <p className="text-12 font-medium text-foreground leading-snug break-words">
              {item.title || 'Untitled Document'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-11">
            <div className="rounded-lg border border-border bg-muted p-2.5">
              <span className="text-muted-foreground block text-10 font-medium">
                Status / Nature
              </span>
              <span className="font-medium text-destructive capitalize mt-0.5 block">
                {retractionInfo.nature
                  ? retractionInfo.nature.replace(/_/g, ' ')
                  : 'Retraction'}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted p-2.5">
              <span className="text-muted-foreground block text-10 font-medium">
                Retraction Date
              </span>
              <span className="font-mono text-foreground font-medium mt-0.5 block">
                {retractionInfo.date || 'Unspecified'}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
            <div className="text-11 font-semibold text-destructive tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span>Official Reason</span>
            </div>
            <p className="text-12 text-foreground leading-relaxed break-words font-sans">
              {retractionInfo.formattedReason}
            </p>

            {noticeUrl && (
              <div className="pt-2 border-t border-destructive/15">
                <a
                  href={noticeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-11 font-medium text-destructive hover:underline transition-colors"
                >
                  <span>
                    {retractionInfo.noticeUrl
                      ? 'View publisher retraction notice'
                      : 'View publication DOI link'}
                  </span>
                  <ExternalLink
                    className="size-3 shrink-0"
                    strokeWidth={1.75}
                  />
                </a>
              </div>
            )}
          </div>

          <div className="text-11 text-muted-foreground bg-muted rounded-lg p-2.5 border border-border leading-relaxed">
            <span className="font-semibold text-foreground">
              Citation Warning:
            </span>{' '}
            Including retracted papers in your bibliography may compromise the
            validity of your research results.
          </div>
        </div>

        <DialogFooter className="p-0 pt-2 flex items-center justify-between sm:justify-between border-0">
          {canEdit && onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDismissing}
              onClick={async () => {
                try {
                  await onDismiss();
                  onOpenChange(false);
                } catch {
                  // Handled by caller mutation error toast
                }
              }}
              className="text-12 font-medium h-8 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
            >
              {isDismissing ? 'Removing flag...' : 'Remove retraction flag'}
            </Button>
          ) : <div />}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDismissing}
            onClick={() => onOpenChange(false)}
            className="text-12 font-medium h-8 px-4 cursor-pointer"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface PaperBibtexDialogProps {
  paper: ReaderDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaperBibtexDialog({
  paper,
  open,
  onOpenChange,
}: PaperBibtexDialogProps) {
  const [format, setFormat] = useState<'bibtex' | 'ris'>('bibtex');
  const { copy, isCopied } = useReaderClipboard();
  const { download } = useReaderFileDownload();

  const { data: exportRes, isLoading } = useExportItemCitationQuery(
    paper?.projectId || 'user',
    paper?.id,
    format,
    { enabled: open && Boolean(paper?.id) },
  );
  const remoteContent = exportRes?.content ?? null;

  const citationKey = paper?.citationKey || paper?.id || 'citation';
  const fallbackString = format === 'bibtex' ? paper?.bibtex || '' : '';
  const contentString =
    remoteContent ||
    fallbackString ||
    (isLoading ? 'Loading citation from server...' : '');

  const handleCopy = async () => {
    if (!contentString || isLoading) return;
    await copy(contentString, format === 'bibtex' ? 'BibTeX' : 'RIS');
  };

  const handleDownload = () => {
    if (!contentString || isLoading) return;
    const ext = format === 'bibtex' ? 'bib' : 'ris';
    const mime =
      format === 'bibtex'
        ? 'application/x-bibtex'
        : 'application/x-research-info-systems';
    download(
      `${citationKey || 'citation'}.${ext}`,
      contentString,
      `${mime};charset=utf-8`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border border-border bg-background shadow-raised-200 rounded-lg font-sans">
        <DialogHeader className="p-4 pb-3 border-b border-border bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-background flex items-center justify-center text-foreground border border-border">
                <FileJson
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                  Citation Export
                </DialogTitle>
                <DialogDescription className="text-12 text-muted-foreground line-clamp-1">
                  {paper.title || 'Academic reference'}
                </DialogDescription>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Citation format"
              className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border"
            >
              <button
                type="button"
                role="tab"
                aria-selected={format === 'bibtex'}
                onClick={() => setFormat('bibtex')}
                className={cn(
                  'px-2.5 py-1 text-12 font-medium rounded-sm transition-colors cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  format === 'bibtex'
                    ? 'bg-background text-foreground font-medium border border-border-subtle'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                BibTeX
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={format === 'ris'}
                onClick={() => setFormat('ris')}
                className={cn(
                  'px-2.5 py-1 text-12 font-medium rounded-sm transition-colors cursor-pointer relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  format === 'ris'
                    ? 'bg-background text-foreground font-medium border border-border-subtle'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                RIS
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 bg-background">
          <div className="relative group">
            <pre className="p-3.5 bg-muted border border-border rounded-md font-mono text-11 overflow-x-auto max-h-[340px] text-foreground leading-relaxed select-all">
              {contentString}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-border bg-background">
          <div className="flex items-center gap-2">
            <span className="text-11 text-muted-foreground font-mono">
              Key: <strong className="text-foreground">@{citationKey}</strong>
            </span>
            <button
              type="button"
              onClick={async () => {
                await copy(`@${citationKey}`, `@${citationKey}`);
              }}
              title="Copy Citation Key"
              aria-label="Copy citation key"
              className="text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-sm cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Copy className="size-3" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || (!remoteContent && !fallbackString)}
              onClick={handleCopy}
              className="h-8 px-3 text-12 font-medium gap-1.5 border-border bg-background text-foreground hover:bg-muted cursor-pointer rounded-md focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none relative before:absolute before:-inset-1 md:before:hidden"
            >
              {isCopied() ? (
                <Check
                  className="size-3.5 text-primary shrink-0"
                  strokeWidth={1.5}
                />
              ) : (
                <Copy
                  className="size-3.5 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
              )}
              <span>{isCopied() ? 'Copied' : 'Copy'}</span>
            </Button>
            <Button
              size="sm"
              disabled={isLoading || (!remoteContent && !fallbackString)}
              onClick={handleDownload}
              className="h-8 px-3 text-12 font-medium gap-1.5 cursor-pointer rounded-md focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none relative before:absolute before:-inset-1 md:before:hidden"
            >
              <Download className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span>Download .{format === 'bibtex' ? 'bib' : 'ris'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const BibtexModal = PaperBibtexDialog;

export default DeleteModal;
