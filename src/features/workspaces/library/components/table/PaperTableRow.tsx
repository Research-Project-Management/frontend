'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  FileText,
  Copy,
  Trash2,
  BookOpen,
  Folder,
  Quote,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import {
  convertToBibTeX,
  formatCiteCommand,
  formatApaCitation,
  formatIeeeCitation,
  normalizeAuthors,
} from '../../utils/library.util';
import type { Paper, Collection } from '../../types/library.types';

interface PaperTableRowProps {
  paper: Paper;
  collection?: Collection | null;
  isSelected: boolean;
  isActive: boolean;
  showCollection?: boolean;
  showLastRead?: boolean;
  onSelect: (paper: Paper) => void;
  onToggleCheck: (paperId: string, e: React.MouseEvent) => void;
  onDelete: (paperId: string) => void;
}

function formatLastReadDate(dateString?: string | null): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export default function PaperTableRow({
  paper,
  collection,
  isSelected,
  isActive,
  showCollection = true,
  showLastRead = false,
  onSelect,
  onToggleCheck,
  onDelete,
}: PaperTableRowProps) {
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams();
  const pId = paper.id || '';

  const handleDoubleClick = () => {
    if (pId) {
      router.push(`/${workspaceUrl}/library/papers/${pId}`);
    } else {
      onSelect(paper);
    }
  };

  const hasFile = Boolean(paper.fileUrl || (paper as any)?.primaryFile?.url);

  const handleCopyCite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const citeCmd = formatCiteCommand(paper);
    navigator.clipboard.writeText(citeCmd);
    toast.success(`Copied ${citeCmd} to clipboard`);
  };

  const handleCopyBibtex = (e: React.MouseEvent) => {
    e.stopPropagation();
    const bibtex = convertToBibTeX(paper);
    navigator.clipboard.writeText(bibtex);
    toast.success('BibTeX copied to clipboard');
  };

  const handleCopyApa = (e: React.MouseEvent) => {
    e.stopPropagation();
    const apa = formatApaCitation(paper);
    navigator.clipboard.writeText(apa);
    toast.success('APA 7th citation copied to clipboard');
  };

  const handleCopyIeee = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ieee = formatIeeeCitation(paper);
    navigator.clipboard.writeText(ieee);
    toast.success('IEEE citation copied to clipboard');
  };

  const isRawArxiv = /^\d{4}\.\d{4,5}(v\d+)?$/i.test(paper.title || '');
  const authors = normalizeAuthors(paper.authors, (paper as any).creators);
  const authorDisplay =
    authors.length > 0
      ? authors.length === 1
        ? authors[0]
        : authors.length === 2
        ? `${authors[0]} & ${authors[1]}`
        : `${authors[0]} et al.`
      : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <tr
          role="row"
          tabIndex={0}
          aria-selected={isSelected || isActive}
          onClick={() => onSelect(paper)}
          onDoubleClick={handleDoubleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleDoubleClick();
            } else if (e.key === ' ') {
              e.preventDefault();
              onSelect(paper);
            }
          }}
          className={cn(
            'group border-b border-border/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring transition-colors cursor-pointer select-none text-sm h-10',
            isActive && 'bg-accent/70 text-foreground font-medium',
            isSelected && !isActive && 'bg-accent/30'
          )}
        >
          {/* Checkbox column */}
          <td className="w-10 px-2.5 py-1.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center">
              <Checkbox
                checked={isSelected}
                onClick={(e) => onToggleCheck(pId, e)}
                aria-label={`Select ${paper.title}`}
                className="size-3.5 rounded border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary cursor-pointer"
              />
            </div>
          </td>

          {/* Title Column (with inline PDF indicator & collection tag) */}
          <td className="px-3 py-1.5 align-middle min-w-[240px] flex-1">
            <div className="flex items-center gap-2 min-w-0">
              {hasFile && (
                <span
                  title={paper.filename ? `PDF: ${paper.filename}` : "PDF Document Attached"}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-semibold tracking-wider bg-muted/70 text-foreground border border-border/60 shrink-0 select-none leading-none"
                >
                  PDF
                </span>
              )}
              {isRawArxiv && !hasFile && (
                <span
                  title="arXiv Preprint"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-semibold tracking-wider bg-muted/70 text-muted-foreground border border-border/60 shrink-0 select-none leading-none"
                >
                  arXiv
                </span>
              )}
              <span
                className={cn(
                  'truncate font-medium text-foreground transition-colors text-sm',
                  isActive && 'font-semibold',
                  isRawArxiv && 'font-mono text-xs'
                )}
                title={paper.title}
              >
                {paper.title || 'Untitled Paper'}
              </span>
              {showCollection && collection && (
                <span
                  className="hidden sm:inline-flex items-center gap-1 text-micro font-medium px-1.5 py-0.5 text-muted-foreground bg-muted/50 rounded shrink-0 border border-border/40 truncate max-w-[120px]"
                  title={`In collection: ${collection.name}`}
                >
                  <Folder className="size-3 shrink-0" />
                  <span className="truncate">{collection.name}</span>
                </span>
              )}
            </div>
          </td>

          {/* Authors Column */}
          <td className="px-3 py-1.5 align-middle w-[240px] max-w-[320px]">
            <span
              className="truncate block text-muted-foreground font-normal text-xs"
              title={paper.authors?.join(', ')}
            >
              {authorDisplay ? (
                authorDisplay
              ) : (
                <span className="opacity-40">—</span>
              )}
            </span>
          </td>

          {/* Last Read Column */}
          {showLastRead && (
            <td className="px-3 py-1.5 align-middle w-[200px] max-w-[240px]">
              <span
                className="truncate block text-muted-foreground font-normal text-xs font-mono tabular-nums"
                title={paper.lastReadAt || paper.accessedAt || paper.updatedAt || paper.createdAt || ''}
              >
                {formatLastReadDate(paper.lastReadAt || paper.accessedAt || paper.updatedAt || paper.createdAt)}
              </span>
            </td>
          )}

          {/* Hover Quick Action Dropdown Column */}
          <td className="w-10 px-2 py-1.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <DropdownMenu>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
                          aria-label="More actions"
                        >
                          <MoreVertical className="size-4 text-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs py-1 px-2">
                      More actions
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent align="end" sideOffset={4} className="w-48 p-1 rounded-lg border border-border bg-popover text-popover-foreground z-50 text-sm shadow-none">
                  <DropdownMenuItem
                    onClick={handleDoubleClick}
                    className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none"
                  >
                    <BookOpen className="size-4 text-foreground" />
                    <span>Open in reader</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCopyCite}
                    className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none"
                  >
                    <Quote className="size-4 text-foreground" />
                    <span>Copy LaTeX \cite</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCopyBibtex}
                    className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none"
                  >
                    <Copy className="size-4 text-foreground" />
                    <span>Copy BibTeX</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCopyApa}
                    className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none"
                  >
                    <FileText className="size-4 text-foreground" />
                    <span>Copy APA citation</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCopyIeee}
                    className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none"
                  >
                    <FileText className="size-4 text-foreground" />
                    <span>Copy IEEE citation</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(pId)}
                    className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none"
                  >
                    <Trash2 className="size-4 text-foreground" />
                    <span>Move to trash</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </td>
        </tr>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48 p-1 rounded-lg border border-border bg-popover text-popover-foreground z-50 text-sm shadow-none">
        <ContextMenuItem onClick={handleDoubleClick} className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none">
          <BookOpen className="size-4 text-foreground" />
          <span>Open in reader</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyCite} className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none">
          <Quote className="size-4 text-foreground" />
          <span>Copy LaTeX \cite</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyBibtex} className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none">
          <Copy className="size-4 text-foreground" />
          <span>Copy BibTeX</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyApa} className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none">
          <FileText className="size-4 text-foreground" />
          <span>Copy APA citation</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyIeee} className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none">
          <FileText className="size-4 text-foreground" />
          <span>Copy IEEE citation</span>
        </ContextMenuItem>
        {paper.doi && (
          <ContextMenuItem
            onClick={() => {
              navigator.clipboard.writeText(`https://doi.org/${paper.doi}`);
              toast.success('DOI URL copied to clipboard');
            }}
            className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none"
          >
            <ExternalLink className="size-4 text-foreground" />
            <span>Copy DOI</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() => onDelete(pId)}
          className="gap-2.5 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none"
        >
          <Trash2 className="size-4 text-foreground" />
          <span>Move to trash</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
