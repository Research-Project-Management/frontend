'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Link2,
  Copy,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { usePageActions } from '../../hooks/use-page';
import type { Page } from '../../types/page.types';
import { formatDate } from "@/shared/lib/utils";
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';

interface CardProps {
  page: Page;
  onEdit?: (page: Page) => void;
}

function extractSnippet(content?: any): string | null {
  if (!content) return null;
  const rawText =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.join(' ')
        : typeof content === 'object' && content.text
          ? content.text
          : '';
  if (!rawText) return null;

  // Clean LaTeX syntax for human-readable abstract preview
  const cleaned = rawText
    .replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/i, '$1')
    .replace(/%.*$/gm, '')
    .replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, (match: string) => {
      const argMatch = match.match(/\{([^}]*)\}/);
      return argMatch ? argMatch[1] : ' ';
    })
    .replace(/[\\{}$_#^~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length > 0 ? (cleaned.length > 110 ? cleaned.slice(0, 110) + '…' : cleaned) : null;
}

export function Card({ page, onEdit }: CardProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { deletePage, duplicatePage } = usePageActions();

  const projId =
    typeof page.projectId === 'object' && page.projectId !== null && 'id' in page.projectId
      ? (page.projectId.id as string)
      : (page.projectId as string);
  const mainFileStr = page.mainFile
    ? typeof page.mainFile === 'object' && page.mainFile !== null && 'id' in page.mainFile
      ? (page.mainFile.id as string)
      : (page.mainFile as string)
    : null;
  const fileQuery = mainFileStr ? `?file=${mainFileStr}` : '';
  const linkHref = `/projects/${projId}/pages/${page.id}${fileQuery}`;
  const authorName = page.author?.name;
  const snippet = page.description || extractSnippet(page.content);
  const status = page.status || 'published';
  const labels = (page.labels as any[]) || [];

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      const fullUrl = `${window.location.origin}${linkHref}`;
      navigator.clipboard.writeText(fullUrl);
      toast.success('Page link copied to clipboard');
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    duplicatePage.mutate(page.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${page.title}"?`)) {
      deletePage.mutate(page.id);
    }
  };

  return (
    <div
      onClick={() => router.push(linkHref)}
      className="group/card relative flex flex-col rounded-md border border-border bg-card text-card-foreground hover:border-foreground/30 transition-colors duration-150 cursor-pointer overflow-hidden select-none"
    >
      {/* ── Document Cover / LaTeX Paper Sheet Preview ── */}
      <div className="relative aspect-[16/9] w-full bg-canvas border-b border-border p-3.5 flex flex-col justify-between overflow-hidden select-none">
        {page.pdfThumbnail ? (
          <img
            src={page.pdfThumbnail}
            alt={page.title}
            className="w-full h-full object-cover rounded-sm"
          />
        ) : (
          /* Academic Manuscript Sheet Surface (No nested card border or shadow) */
          <div className="w-full h-full flex flex-col justify-between select-none">
            {/* Paper Header: LaTeX badge & title bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-11 font-mono font-medium text-muted-foreground">
                    <FileText className="size-3 text-muted-foreground" strokeWidth={1.5} />
                    <span>LaTeX</span>
                  </div>
                  <span
                    className={cn(
                      "text-11 font-mono font-medium px-1.5 py-0.5 rounded-sm capitalize",
                      status === 'published'
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-warning/10 text-warning border border-warning/20"
                    )}
                  >
                    {status}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-3/4 bg-foreground/15 rounded-full" />
              <div className="h-1 w-1/2 bg-foreground/10 rounded-full" />
            </div>

            {/* Paper Dual Column Abstract/Body Simulation */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="h-0.5 w-full bg-muted-foreground/20 rounded-full" />
                <div className="h-0.5 w-5/6 bg-muted-foreground/15 rounded-full" />
                <div className="h-0.5 w-full bg-muted-foreground/20 rounded-full" />
                <div className="h-0.5 w-3/4 bg-muted-foreground/15 rounded-full" />
              </div>
              <div className="space-y-1">
                <div className="h-0.5 w-full bg-muted-foreground/20 rounded-full" />
                <div className="h-0.5 w-4/5 bg-muted-foreground/15 rounded-full" />
                <div className="h-0.5 w-full bg-muted-foreground/20 rounded-full" />
                <div className="h-0.5 w-2/3 bg-muted-foreground/15 rounded-full" />
              </div>
            </div>
          </div>
        )}

        {/* Quick Action Menu Button (Top Right on Hover) */}
        <div
          className={cn(
            "absolute top-2 right-2 transition-opacity z-10",
            isMenuOpen ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none relative before:absolute before:-inset-2 md:before:hidden",
                  isMenuOpen
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-label={`Options for ${page.title}`}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-12 shadow-overlay">
              <DropdownMenuItem
                onClick={() => router.push(linkHref)}
                className="cursor-pointer gap-2 text-12"
              >
                <ExternalLink className="size-3.5 text-muted-foreground" />
                <span>Open page</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit?.(page);
                }}
                className="cursor-pointer gap-2 text-12"
              >
                <Pencil className="size-3.5 text-muted-foreground" />
                <span>Edit page</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleCopyLink}
                className="cursor-pointer gap-2 text-12"
              >
                <Link2 className="size-3.5 text-muted-foreground" />
                <span>Copy link</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDuplicate}
                className="cursor-pointer gap-2 text-12"
              >
                <Copy className="size-3.5 text-muted-foreground" />
                <span>Duplicate</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="cursor-pointer gap-2 text-12 text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Card Content Body ── */}
      <div className="p-3.5 flex flex-col gap-2 flex-1 justify-between">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-semibold text-13 leading-snug text-foreground group-hover/card:text-foreground transition-colors line-clamp-1"
              title={page.title}
            >
              {page.title}
            </h3>
          </div>

          <p className="text-12 text-muted-foreground line-clamp-2 leading-relaxed min-h-[2rem]">
            {snippet || 'Academic LaTeX manuscript page.'}
          </p>
        </div>

        {/* Labels / Tags row (single horizontal row, never stacking awkwardly) */}
        {labels.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-hidden flex-nowrap py-0.5">
            {labels.slice(0, 2).map((label: any) => {
              const labelId = label.id ?? label;
              const labelName = label.name ?? label;
              const labelColor = label.color ?? '#0969DA';
              return (
                <span
                  key={labelId}
                  className="inline-flex items-center gap-1 h-5 px-1.5 rounded-sm text-11 font-medium border shrink-0 transition-colors"
                  style={{
                    backgroundColor: `${labelColor}12`,
                    borderColor: `${labelColor}30`,
                    color: labelColor,
                  }}
                  title={labelName}
                >
                  <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: labelColor }} />
                  <span className="truncate max-w-[90px]">{labelName}</span>
                </span>
              );
            })}
            {labels.length > 2 && (
              <span className="inline-flex items-center h-5 text-11 font-mono font-medium text-muted-foreground px-1.5 rounded-sm bg-muted border border-border/60 shrink-0">
                +{labels.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Card Footer: Author + Formatted Date */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-11 text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0 max-w-[130px]">
            {page.author?.avatar ? (
              <img
                src={page.author.avatar}
                alt={authorName || ''}
                className="size-4.5 rounded-full object-cover shrink-0 ring-1 ring-border/50"
              />
            ) : (
              <span className="size-4.5 rounded-full bg-muted text-muted-foreground ring-1 ring-border/50 text-10 font-mono font-medium flex items-center justify-center shrink-0">
                {(authorName || 'A').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-foreground/80 font-medium">{authorName || 'Anonymous'}</span>
          </div>

          <span className="font-mono text-11 tabular-nums text-muted-foreground shrink-0">
            {page.updatedAt ? formatDate(page.updatedAt) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Card;
