import React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { Page } from '../../types/page.types';
import { formatDate } from '@/shared/utils/format';

interface CardProps {
  page: Page;
  workspaceId: string;
}

export function Card({ page, workspaceId }: CardProps) {
  const projId = typeof page.projectId === 'object' && page.projectId !== null && 'id' in page.projectId
    ? (page.projectId.id as string)
    : (page.projectId as string);
  const mainFileStr = page.mainFile
    ? typeof page.mainFile === 'object' && page.mainFile !== null && 'id' in page.mainFile
      ? (page.mainFile.id as string)
      : (page.mainFile as string)
    : null;
  const fileQuery = mainFileStr ? `?file=${mainFileStr}` : '';

  return (
    <Link
      href={`/${workspaceId}/projects/${projId}/pages/${page.id}${fileQuery}`}
      className="group flex flex-col rounded-lg border border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:border-primary transition-all overflow-hidden"
    >
      <div className="aspect-[4/3] bg-muted/30 border-b border-border flex items-center justify-center overflow-hidden">
        {page.pdfThumbnail ? (
          <img src={page.pdfThumbnail} alt={page.title} className="w-full h-full object-cover" />
        ) : (
          <FileText className="size-10 text-muted-foreground/30 group-hover:text-foreground/60 transition-colors" />
        )}
      </div>
      <div className="p-4 flex flex-col gap-1.5">
        <h3 className="font-semibold text-sm line-clamp-1 transition-colors">
          {page.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{page.updatedAt ? formatDate(page.updatedAt) : '—'}</span>
          <span className="truncate max-w-[100px] text-right">{page.author?.name || '—'}</span>
        </div>
      </div>
    </Link>
  );
}
