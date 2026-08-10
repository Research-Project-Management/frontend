'use client';

import { useParams, useRouter } from 'next/navigation';
import { BookOpen, FileText, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';
import { API_BASE_URL as API_URL } from '@/shared/constants';
import type { Paper, Collection } from '@/features/workspaces/library/types/library.types';

export function PaperTableRow({
  paper,
  collection,
  onDelete,
  isSelected,
  onSelect,
  showCollection = true,
}: {
  paper: Paper;
  collection: Collection | null;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: (p: Paper) => void;
  showCollection?: boolean;
}) {
  const { workspaceId: workspaceUrl } = useParams();
  const router = useRouter();
  const resolvedUrl = paper.fileUrl?.startsWith('/api/files/')
    ? `${API_URL}${paper.fileUrl}`
    : paper.fileUrl;

  const handleDoubleClick = () => {
    if (resolvedUrl) {
      router.push(`/${workspaceUrl}/library/papers/${paper._id}/reader`);
    }
  };

  return (
    <tr
      onDoubleClick={handleDoubleClick}
      className={cn(
        'group border-b border-border/40 hover:bg-muted/40 transition-colors cursor-pointer',
        isSelected && 'bg-muted/60'
      )}
    >
      <td className='py-3.5 pr-4 align-middle overflow-hidden max-w-[200px] select-none'>
        <span
          className='text-[11.5px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap block font-normal'
          title={paper.authors.join(', ')}
        >
          {paper.authors.length > 0 ? paper.authors.join(', ') : <span className='opacity-30'>—</span>}
        </span>
      </td>

      <td className='py-3.5 pr-3 align-middle w-[60px] text-[11.5px] whitespace-nowrap text-muted-foreground font-medium select-none'>
        {paper.year ?? <span className='opacity-30'>—</span>}
      </td>

      <td className='py-3.5 pr-3 align-middle w-[150px] overflow-hidden select-none'>
        <span
          className='text-[11.5px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap block italic'
          title={paper.journal || paper.publisher || ''}
        >
          {paper.journal || paper.publisher || <span className='opacity-30'>—</span>}
        </span>
      </td>

      {showCollection && (
        <td className='py-3.5 pr-2 align-middle w-[120px] overflow-hidden select-none'>
          {collection ? (
            <span
              className='inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-semibold max-w-full overflow-hidden border transition-all duration-200'
              style={{
                backgroundColor: `${collection.color || '#3370ff'}0a`,
                color: collection.color || '#3370ff',
                borderColor: `${collection.color || '#3370ff'}1e`,
              }}
            >
              <span className='truncate'>{collection.name}</span>
            </span>
          ) : (
            <span className='text-xs text-muted-foreground/30 select-none'>—</span>
          )}
        </td>
      )}

      <td className='py-3.5 pr-4 align-middle w-[60px] select-none'>
        <div className='flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
          {resolvedUrl && (
            <Link
              href={`/${workspaceUrl}/library/papers/${paper._id}/reader`}
              onClick={(e) => e.stopPropagation()}
              className='flex size-7 items-center justify-center rounded-md text-zinc-400 hover:text-primary hover:bg-primary/10 transition-all duration-200'
              title='Open Reader'
            >
              <BookOpen className='size-3.5' />
            </Link>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(paper._id); }}
            className='flex size-7 items-center justify-center rounded-md text-zinc-400 hover:text-destructive hover:bg-destructive/10 transition-all duration-200'
            title='Delete'
          >
            <Trash2 className='size-3.5' />
          </button>
        </div>
      </td>
    </tr>
  );
}
