'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FileText, BookOpen, Trash2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { API_BASE_URL } from '@/shared/constants';
import type { Paper, Collection } from '../../../types/library.types';

interface PaperTableRowProps {
  paper: Paper;
  collection: Collection | null;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (paper: Paper) => void;
  onToggleCheck: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string) => void;
  showCollection?: boolean;
}

function formatDateAdded(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function PaperTableRow({
  paper,
  collection,
  isSelected,
  isActive,
  onSelect,
  onToggleCheck,
  onDelete,
  showCollection = true,
}: PaperTableRowProps) {
  const { workspaceId: workspaceUrl } = useParams();
  const router = useRouter();
  const hasFile = Boolean(paper.fileUrl);

  const handleDoubleClick = () => {
    if (paper._id) {
      router.push(`/${workspaceUrl}/library/papers/${paper._id}/reader`);
    }
  };

  const handleCopyBibtex = (e: React.MouseEvent) => {
    e.stopPropagation();
    const citeKey = paper.citationKey || (paper.authors?.[0] ? `${paper.authors[0].toLowerCase().split(' ').pop()}${paper.year || '2024'}` : 'ref1');
    const bibtex = `@article{${citeKey},
  title = {${paper.title || ''}},
  author = {${paper.authors?.join(' and ') || ''}},
  journal = {${paper.journal || paper.publisher || ''}},
  year = {${paper.year || ''}},
  doi = {${paper.doi || ''}}
}`;
    navigator.clipboard.writeText(bibtex);
    toast.success('BibTeX copied to clipboard');
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
        'group border-b border-border/40 hover:bg-accent/40 transition-colors cursor-pointer select-none text-xs h-10',
        isActive && 'bg-accent/60 text-foreground font-medium',
        isSelected && !isActive && 'bg-primary/5'
      )}
    >
      {/* Checkbox column */}
      <td className="w-12 px-3 py-2 text-center align-middle" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onClick={(e) => onToggleCheck(paper._id, e)}
            aria-label={`Select ${paper.title}`}
            className="size-4 rounded border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
      </td>

      {/* Attachment Icon Column */}
      <td className="w-8 px-1 py-2 text-center align-middle">
        <div className="flex items-center justify-center">
          {hasFile ? (
            <div
              className="size-5 rounded flex items-center justify-center bg-red-500/10 text-red-600 dark:text-red-400"
              title="PDF Attached"
            >
              <FileText className="size-3.5" />
            </div>
          ) : (
            <span className="text-muted-foreground/30 text-[11px]">—</span>
          )}
        </div>
      </td>

      {/* Title Column */}
      <td className="px-3 py-2 align-middle min-w-[200px] max-w-[400px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              'truncate font-medium text-foreground hover:text-primary transition-colors',
              isActive && 'font-semibold'
            )}
            title={paper.title}
          >
            {paper.title || 'Untitled Paper'}
          </span>
          {paper.itemType && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0 hidden xl:inline-block">
              {paper.itemType}
            </span>
          )}
        </div>
      </td>

      {/* Authors Column */}
      <td className="px-3 py-2 align-middle w-[220px] max-w-[220px]">
        <span
          className="truncate block text-muted-foreground font-normal"
          title={paper.authors?.join(', ')}
        >
          {paper.authors?.length ? paper.authors.join(', ') : <span className="opacity-40">—</span>}
        </span>
      </td>

      {/* Year Column */}
      <td className="px-3 py-2 align-middle w-[70px] whitespace-nowrap text-muted-foreground font-mono tabular-nums">
        {paper.year ? paper.year : <span className="opacity-40">—</span>}
      </td>

      {/* Journal / Venue Column */}
      <td className="px-3 py-2 align-middle w-[180px] max-w-[180px]">
        <span
          className="truncate block text-muted-foreground font-normal italic"
          title={paper.journal || paper.publisher || ''}
        >
          {paper.journal || paper.publisher || <span className="opacity-40 not-italic">—</span>}
        </span>
      </td>

      {/* Collection Badge Column (optional) */}
      {showCollection && (
        <td className="px-3 py-2 align-middle w-[130px] max-w-[130px]">
          {collection ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium max-w-full overflow-hidden border"
              style={{
                backgroundColor: `${collection.color || '#3370ff'}12`,
                color: collection.color || '#3370ff',
                borderColor: `${collection.color || '#3370ff'}30`,
              }}
              title={collection.name}
            >
              <span className="truncate">{collection.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </td>
      )}

      {/* Date Added Column */}
      <td className="px-3 py-2 align-middle w-[110px] whitespace-nowrap text-muted-foreground text-[11px]">
        {formatDateAdded(paper.createdAt)}
      </td>

      {/* Hover Quick Action Buttons Column */}
      <td className="w-16 px-2 py-2 align-middle text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {/* Quick Copy BibTeX */}
          <button
            onClick={handleCopyBibtex}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Copy BibTeX"
            aria-label="Copy BibTeX"
          >
            <Copy className="size-3.5" />
          </button>

          {/* Quick Open Reader */}
          <button
            onClick={handleDoubleClick}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Open in Reader"
            aria-label="Open in Reader"
          >
            <BookOpen className="size-3.5" />
          </button>

          {/* Quick Delete */}
          <button
            onClick={() => onDelete(paper._id)}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete paper"
            aria-label="Delete paper"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
