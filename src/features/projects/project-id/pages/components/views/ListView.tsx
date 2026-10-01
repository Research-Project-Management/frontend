'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import type { Page } from '../../types/page.types';
import { formatDate } from '@/shared/lib/utils';

interface ListViewProps {
  pages: Page[];
}

export function ListView({ pages }: ListViewProps) {
  const router = useRouter();
  const [sortColumn, setSortColumn] = useState<'title' | 'author' | 'updatedAt'>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: 'title' | 'author' | 'updatedAt') => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'title' ? 'asc' : 'desc');
    }
  };

  const renderSortIndicator = (key: string) => {
    if (sortColumn !== key) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp className="size-3 text-foreground ml-1 shrink-0" strokeWidth={1.5} />
    ) : (
      <ArrowDown className="size-3 text-foreground ml-1 shrink-0" strokeWidth={1.5} />
    );
  };

  const sortedPages = useMemo(() => {
    return [...pages].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      if (sortColumn === 'title') {
        aVal = a.title?.toLowerCase() || '';
        bVal = b.title?.toLowerCase() || '';
      } else if (sortColumn === 'author') {
        aVal = a.author?.name?.toLowerCase() || '';
        bVal = b.author?.name?.toLowerCase() || '';
      } else if (sortColumn === 'updatedAt') {
        aVal = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        bVal = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pages, sortColumn, sortDirection]);

  return (
    <div className="flex-1 w-full overflow-x-auto select-none">
      <table className="w-full min-w-[680px] table-fixed text-left border-collapse">
        <colgroup>
          <col />
          <col style={{ width: '160px' }} />
          <col style={{ width: '180px' }} />
          <col style={{ width: '130px' }} />
          <col style={{ width: '50px' }} />
        </colgroup>

        <thead className="sticky top-0 z-10 bg-background select-none">
          <tr className="h-[34px] text-foreground font-medium text-xs border-b border-border">
            {/* Title */}
            <th
              onClick={() => handleSort('title')}
              className="px-4 h-[34px] py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span>Title</span>
                {renderSortIndicator('title')}
              </div>
            </th>

            {/* Author (Creator) */}
            <th
              onClick={() => handleSort('author')}
              className="px-3 h-[34px] py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span>Author</span>
                {renderSortIndicator('author')}
              </div>
            </th>

            {/* Labels */}
            <th className="px-3 h-[34px] py-0 align-middle font-medium text-foreground select-none text-left bg-background border-b border-border text-xs">
              <span>Labels</span>
            </th>

            {/* Updated Date */}
            <th
              onClick={() => handleSort('updatedAt')}
              className="px-3 h-[34px] py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span>Updated</span>
                {renderSortIndicator('updatedAt')}
              </div>
            </th>

            {/* Actions Header */}
            <th className="px-3 h-[34px] py-0 align-middle text-right bg-background border-b border-border text-xs" />
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {sortedPages.map((page) => {
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
            const labels = (page.labels as any[]) || [];
            const authorName = page.author?.name;

            return (
              <tr
                key={page.id}
                onClick={() => router.push(linkHref)}
                className="cursor-pointer transition-colors duration-75 group select-none text-13 h-[38px] hover:bg-muted/60"
              >
                {/* Title */}
                <td className="px-4 h-[38px] py-0 align-middle min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                    <span
                      className="truncate text-13 font-medium text-foreground group-hover:text-primary transition-colors"
                      title={page.title}
                    >
                      {page.title}
                    </span>
                  </div>
                </td>

                {/* Author */}
                <td className="px-3 h-[38px] py-0 align-middle truncate text-13 text-foreground font-normal">
                  <div className="flex items-center gap-1.5 truncate">
                    {authorName ? (
                      <>
                        {page.author?.avatar ? (
                          <img
                            src={page.author.avatar}
                            alt={authorName}
                            className="size-4 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <span className="size-4 rounded-full bg-muted-foreground/20 text-[10px] font-medium flex items-center justify-center shrink-0">
                            {authorName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="truncate text-foreground/80">{authorName}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/50 font-normal">—</span>
                    )}
                  </div>
                </td>

                {/* Labels */}
                <td className="px-3 h-[38px] py-0 align-middle">
                  <div className="flex items-center gap-1 overflow-hidden">
                    {labels.length > 0 ? (
                      labels.slice(0, 2).map((label: any) => (
                        <span
                          key={label.id ?? label}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium border shrink-0"
                          style={{
                            backgroundColor: `${label.color ?? '#3b82f6'}15`,
                            borderColor: `${label.color ?? '#3b82f6'}35`,
                            color: label.color ?? '#3b82f6',
                          }}
                        >
                          <span
                            className="size-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: label.color ?? '#3b82f6' }}
                          />
                          <span className="truncate max-w-[70px]">{label.name ?? label}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground/50 font-normal">—</span>
                    )}
                    {labels.length > 2 && (
                      <span className="text-[10px] font-mono text-muted-foreground px-1 py-0.5 rounded bg-muted shrink-0">
                        +{labels.length - 2}
                      </span>
                    )}
                  </div>
                </td>

                {/* Updated */}
                <td className="px-3 h-[38px] py-0 align-middle text-12 font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                  {page.updatedAt ? formatDate(page.updatedAt) : '—'}
                </td>

                {/* Action (subtle hover Chevron like Library) */}
                <td className="px-3 h-[38px] py-0 align-middle text-right">
                  <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ListView;
