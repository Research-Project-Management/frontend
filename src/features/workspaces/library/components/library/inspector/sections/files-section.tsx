'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FileText, BookOpen, Download, ExternalLink, HardDrive } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { API_BASE_URL } from '@/shared/constants';
import type { Paper } from '@/features/workspaces/library/types/library.types';

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
  const hasFile = Boolean(paper.fileUrl);

  const resolvedUrl = paper.fileUrl?.startsWith('/api/files/')
    ? `${API_BASE_URL}${paper.fileUrl}`
    : paper.fileUrl;

  const handleOpenReader = () => {
    router.push(`/${workspaceUrl}/library/papers/${paper._id}/reader`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Attachments & Files
        </span>
      </div>

      {hasFile ? (
        <div className="space-y-3">
          <div className="p-3 bg-muted/30 rounded-lg border border-border/40 flex items-start gap-3">
            <div className="size-9 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <FileText className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-medium text-foreground truncate" title={paper.filename || 'Paper PDF'}>
                {paper.filename || `${paper.title || 'Paper'}.pdf`}
              </h4>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                <span>{formatSize(paper.size)}</span>
                <span>•</span>
                <span className="uppercase">{paper.mimeType?.split('/')[1] || 'PDF'}</span>
              </div>
            </div>
          </div>

          {/* Prominent Open in Reader CTA */}
          <Button
            onClick={handleOpenReader}
            className="w-full h-9 text-xs font-medium gap-2 shadow-sm"
          >
            <BookOpen className="size-4" />
            Open PDF in Reader
          </Button>
        </div>
      ) : (
        <div className="py-6 text-center text-muted-foreground text-xs bg-muted/10 rounded-lg border border-dashed border-border/40">
          No PDF attachment linked to this reference.
        </div>
      )}
    </div>
  );
}
