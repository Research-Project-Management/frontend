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
  onSelect: (paper: Paper) => void;
  onToggleCheck: (paperId: string, e: React.MouseEvent) => void;
  onDelete: (paperId: string) => void;
}

export default function PaperTableRow({
  paper,
  collection,
  isSelected,
  isActive,
  showCollection = true,
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
            'group border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer select-none text-sm h-10',
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
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0 select-none"
                >
                  PDF
                </span>
              )}
              {isRawArxiv && !hasFile && (
                <span
                  title="arXiv Preprint"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border/60 shrink-0 select-none"
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
                  className="hidden sm:inline-flex items-center gap-1 text-xs px-1.5 py-0.5 text-muted-foreground bg-muted/60 rounded shrink-0 border border-border/40 truncate max-w-[120px]"
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
              className="truncate block text-muted-foreground font-normal text-sm"
              title={paper.authors?.join(', ')}
            >
              {authorDisplay ? (
                authorDisplay
              ) : isRawArxiv ? (
                <span className="text-xs text-muted-foreground/70 italic font-mono">arXiv preprint</span>
              ) : (
                <span className="opacity-40">—</span>
              )}
            </span>
          </td>

          {/* Hover Quick Action Dropdown Column */}
          <td className="w-10 px-2 py-1.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
                    title="More actions"
                    aria-label="More actions"
                  >
                    <MoreVertical className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1 text-xs rounded-lg shadow-lg border border-border">
                  <DropdownMenuItem
                    onClick={handleDoubleClick}
                    className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted"
                  >
                    <BookOpen className="size-3.5 text-muted-foreground" />
                    <span>Open in Reader</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCopyCite}
                    className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted"
                  >
                    <Quote className="size-3.5 text-muted-foreground" />
                    <span>Copy LaTeX <code className="font-mono text-[10.5px] bg-muted px-1 rounded">\cite</code></span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCopyBibtex}
                    className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted"
                  >
                    <Copy className="size-3.5 text-muted-foreground" />
                    <span>Copy BibTeX Entry</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCopyApa}
                    className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted"
                  >
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span>Copy APA 7th Citation</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCopyIeee}
                    className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted"
                  >
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span>Copy IEEE Citation</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(pId)}
                    className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted"
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                    <span>Move to Trash</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </td>
        </tr>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56 p-1 text-xs rounded-lg shadow-xl border border-border">
        <ContextMenuItem onClick={handleDoubleClick} className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted">
          <BookOpen className="size-3.5 text-muted-foreground" />
          <span>Open in Reader</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyCite} className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted">
          <Quote className="size-3.5 text-muted-foreground" />
          <span>Copy LaTeX <code className="font-mono text-[10.5px] bg-muted px-1 rounded">\cite</code></span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyBibtex} className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted">
          <Copy className="size-3.5 text-muted-foreground" />
          <span>Copy BibTeX Entry</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyApa} className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted">
          <FileText className="size-3.5 text-muted-foreground" />
          <span>Copy APA 7th Citation</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyIeee} className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted">
          <FileText className="size-3.5 text-muted-foreground" />
          <span>Copy IEEE Citation</span>
        </ContextMenuItem>
        {paper.doi && (
          <ContextMenuItem
            onClick={() => {
              navigator.clipboard.writeText(`https://doi.org/${paper.doi}`);
              toast.success('DOI URL copied to clipboard');
            }}
            className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" />
            <span>Copy DOI URL</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() => onDelete(pId)}
          className="gap-2.5 text-xs font-normal text-foreground cursor-pointer rounded-md hover:bg-muted focus:bg-muted"
        >
          <Trash2 className="size-3.5 text-muted-foreground" />
          <span>Move to Trash</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
