'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FileText, BookOpen, Download, Paperclip } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { API_BASE_URL } from '@/config/env';
import type { Paper, PaperAttachment } from '@/features/workspaces/library/types/library.types';

interface FilesSectionProps {
  paper: Paper;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesSection({ paper }: FilesSectionProps) {
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams();
  const paperId = paper.id;
  const hasPrimaryFile = Boolean(paper.fileUrl);
  const attachments: PaperAttachment[] = paper.attachments || [];

  // Filter out any attachment that represents the primary file
  const supplementaryAttachments = attachments.filter((att) => {
    if ((att as any).isPrimary || att.attachmentType === 'primary_pdf' || (att as any).type === 'primary') return false;
    if (
      paper.fileUrl &&
      att.url &&
      (att.url === paper.fileUrl ||
        att.url.endsWith(paper.fileUrl) ||
        paper.fileUrl.endsWith(att.url))
    ) {
      return false;
    }
    if (paper.filename && att.filename && att.filename === paper.filename) {
      return false;
    }
    return true;
  });

  const resolveFileUrl = (url?: string) => {
    if (!url) return '';
    return url.startsWith('/api/files/') ? `${API_BASE_URL}${url}` : url;
  };

  const handleOpenReader = () => {
    if (paperId) {
      router.push(`/${workspaceUrl}/library/papers/${paperId}`);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">
          Attachments
        </h3>
      </div>

      {/* Primary Document PDF */}
      {hasPrimaryFile ? (
        <div className="space-y-3">
          <div className="p-3 bg-muted/30 hover:bg-muted/40 rounded-lg border border-border/40 flex items-start gap-3 transition-colors">
            <div className="size-8 rounded-md bg-muted border border-border/60 flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="size-4 text-foreground/70" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs font-normal px-2 py-0.5">
                  Primary
                </Badge>
                {paper.provenance?.isOpenAccess && (
                  <Badge variant="outline" className="text-xs font-normal px-2 py-0.5 text-emerald-600 border-emerald-500/30">
                    OA
                  </Badge>
                )}
              </div>
              <h4 className="text-sm font-medium text-foreground truncate mt-1" title={paper.filename || 'Paper PDF'}>
                {paper.filename || `${paper.title || 'Paper'}.pdf`}
              </h4>
              <div className="flex items-center gap-2 mt-1 text-xs font-mono text-muted-foreground">
                <span>{formatSize(paper.size)}</span>
                <span>•</span>
                <span className="uppercase">{paper.mimeType?.split('/')[1] || 'PDF'}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleOpenReader}
              className="w-full h-8.5 text-xs font-medium gap-2 shadow-none cursor-pointer"
            >
              <BookOpen className="size-3.5" />
              <span>Open in Fullscreen Reader</span>
            </Button>

            {paper.fileUrl && (
              <a
                href={resolveFileUrl(paper.fileUrl)}
                target="_blank"
                rel="noopener noreferrer"
                download={paper.filename || `${paper.title || 'paper'}.pdf`}
                className="w-full"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs font-medium gap-2 cursor-pointer shadow-none"
                >
                  <Download className="size-3.5" />
                  <span>Download Primary PDF</span>
                </Button>
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-muted-foreground text-xs bg-muted/10 rounded-lg border border-dashed border-border/40">
          No primary PDF attached to this reference.
        </div>
      )}

      {/* Supplementary Attachments List */}
      {supplementaryAttachments.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/20">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Supplementary Files
          </h3>
          <div className="space-y-1.5">
            {supplementaryAttachments.map((att) => {
              const attName = att.filename || 'Attachment';
              const attUrl = att.url;
              return (
                <div
                  key={att.id}
                  className="p-2.5 bg-muted/20 hover:bg-muted/30 rounded-lg border border-border/30 flex items-center justify-between gap-2 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate text-foreground font-medium text-xs" title={attName}>
                      {attName}
                    </span>
                    {att.size && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({formatSize(att.size)})
                      </span>
                    )}
                  </div>
                  {attUrl && (
                    <a
                      href={resolveFileUrl(attUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={attName}
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted shrink-0"
                      title="Download attachment"
                    >
                      <Download className="size-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
