'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FileText, Copy, Trash2, BookOpen, Folder, Quote, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { convertToBibTeX, formatCiteCommand, formatApaCitation, formatIeeeCitation } from '../../utils/library.util';
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

  return (
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
          <span
            className={cn(
              'truncate font-medium text-foreground transition-colors text-sm',
              isActive && 'font-semibold'
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
      <td className="px-3 py-1.5 align-middle w-[200px] max-w-[240px]">
        <span
          className="truncate block text-muted-foreground font-normal text-xs"
          title={paper.authors?.join(', ')}
        >
          {paper.authors?.length ? paper.authors.join(', ') : <span className="opacity-40">—</span>}
        </span>
      </td>

      {/* Year Column */}
      <td className="px-3 py-1.5 align-middle w-[72px] whitespace-nowrap text-muted-foreground font-mono tabular-nums text-xs">
        {paper.year ? paper.year : <span className="opacity-40">—</span>}
      </td>

      {/* Journal / Venue Column */}
      <td className="px-3 py-1.5 align-middle w-[180px] max-w-[220px]">
        <span
          className="truncate block text-muted-foreground font-normal italic text-xs"
          title={paper.journal || paper.publisher || ''}
        >
          {paper.journal || paper.publisher || <span className="opacity-40 not-italic">—</span>}
        </span>
      </td>

      {/* Hover Quick Action Buttons Column */}
      <td className="w-20 px-2 py-1.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {/* Quick Copy \cite */}
          <button
            onClick={handleCopyCite}
            className="flex size-6 items-center justify-center rounded text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Copy \cite{key}"
            aria-label="Copy \cite{key}"
          >
            <Quote className="size-3.5 text-foreground" />
          </button>

          {/* Quick Copy BibTeX */}
          <button
            onClick={handleCopyBibtex}
            className="flex size-6 items-center justify-center rounded text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Copy BibTeX"
            aria-label="Copy BibTeX"
          >
            <Copy className="size-3.5 text-foreground" />
          </button>

          {/* More Citation Formats Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex size-6 items-center justify-center rounded text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
                title="More citation actions"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-3.5 text-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 text-xs">
              <DropdownMenuItem onClick={handleCopyCite} className="gap-2 cursor-pointer">
                <Quote className="size-3.5 text-primary" />
                <span>Copy LaTeX <code className="font-mono text-[10.5px] bg-muted px-1 rounded">\cite</code></span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyBibtex} className="gap-2 cursor-pointer">
                <Copy className="size-3.5 text-amber-500" />
                <span>Copy BibTeX Entry</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyApa} className="gap-2 cursor-pointer">
                <FileText className="size-3.5 text-blue-500" />
                <span>Copy APA 7th Citation</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyIeee} className="gap-2 cursor-pointer">
                <FileText className="size-3.5 text-emerald-500" />
                <span>Copy IEEE Citation</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDoubleClick} className="gap-2 cursor-pointer">
                <BookOpen className="size-3.5 text-foreground" />
                <span>Open in Reader</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(pId)}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                <span>Move to Trash</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}
