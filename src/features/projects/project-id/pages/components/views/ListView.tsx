'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  ExternalLink,
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
import { formatDate } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';

interface ListViewProps {
  pages: Page[];
}

export function ListView({ pages }: ListViewProps) {
  const router = useRouter();
  const [sortColumn, setSortColumn] = useState<'title' | 'author' | 'updatedAt' | 'status'>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { deletePage, duplicatePage } = usePageActions();

  const handleSort = (column: 'title' | 'author' | 'updatedAt' | 'status') => {
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
      <ArrowUp className="size-3 text-foreground shrink-0" strokeWidth={1.8} />
    ) : (
      <ArrowDown className="size-3 text-foreground shrink-0" strokeWidth={1.8} />
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
      } else if (sortColumn === 'status') {
        aVal = a.status || 'published';
        bVal = b.status || 'published';
      } else if (sortColumn === 'updatedAt') {
        aVal = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        bVal = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pages, sortColumn, sortDirection]);

  const handleCopyLink = (url: string) => {
    if (typeof window !== 'undefined') {
      const fullUrl = `${window.location.origin}${url}`;
      navigator.clipboard.writeText(fullUrl);
      toast.success('Page link copied to clipboard');
    }
  };

  const handleDelete = (pageId: string, pageTitle: string) => {
    if (window.confirm(`Are you sure you want to delete "${pageTitle}"?`)) {
      deletePage.mutate(pageId);
    }
  };

  return (
    <div className="flex-1 w-full overflow-x-auto select-none scrollbar-none pb-8">
      <table className="w-full min-w-[780px] table-fixed text-left border-collapse">
        {/* Golden Ratio Proportions: 36% Title | 12% Status | 16% Author | 22% Labels | 10% Updated | 4% Actions */}
        <colgroup>
          <col style={{ width: '36%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '4%' }} />
        </colgroup>

        <thead className="sticky top-0 z-10 bg-background select-none">
          <tr className="h-8.5 text-12 font-medium text-muted-foreground border-b border-border">
            {/* Title */}
            <th
              onClick={() => handleSort('title')}
              className="px-4 min-w-[260px] h-8.5 align-middle cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none text-left border-b border-border"
            >
              <div className="flex items-center gap-1.5">
                <span>Page</span>
                <span className="text-11 font-mono text-muted-foreground font-normal">({sortedPages.length})</span>
                {renderSortIndicator('title')}
              </div>
            </th>

            {/* Status */}
            <th
              onClick={() => handleSort('status')}
              className="px-3 min-w-[100px] h-8.5 align-middle cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none text-left border-b border-border"
            >
              <div className="flex items-center gap-1.5">
                <span>Status</span>
                {renderSortIndicator('status')}
              </div>
            </th>

            {/* Author */}
            <th
              onClick={() => handleSort('author')}
              className="px-3 min-w-[140px] h-8.5 align-middle cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none text-left border-b border-border"
            >
              <div className="flex items-center gap-1.5">
                <span>Author</span>
                {renderSortIndicator('author')}
              </div>
            </th>

            {/* Labels */}
            <th className="px-3 min-w-[180px] h-8.5 align-middle text-muted-foreground select-none text-left border-b border-border">
              <span>Labels</span>
            </th>

            {/* Updated Date */}
            <th
              onClick={() => handleSort('updatedAt')}
              className="px-3 min-w-[110px] h-8.5 align-middle cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none text-left border-b border-border"
            >
              <div className="flex items-center gap-1.5">
                <span>Updated</span>
                {renderSortIndicator('updatedAt')}
              </div>
            </th>

            {/* Actions Header */}
            <th className="px-2 min-w-[44px] h-8.5 align-middle text-right border-b border-border" />
          </tr>
        </thead>

        <tbody className="divide-y divide-border/60">
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
            const status = page.status || 'published';

            return (
              <tr
                key={page.id}
                onClick={() => router.push(linkHref)}
                className="cursor-pointer transition-colors duration-150 group select-none h-10 hover:bg-muted/40"
              >
                {/* 1. Title Column */}
                <td className="px-4 h-10 py-0 align-middle min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span
                      className="truncate text-13 font-medium text-foreground"
                      title={page.title}
                    >
                      {page.title}
                    </span>
                    <span className="text-11 font-mono text-muted-foreground/60 shrink-0 font-normal">
                      .tex
                    </span>
                  </div>
                </td>

                {/* 2. Status Column */}
                <td className="px-3 h-10 py-0 align-middle">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-11 font-mono font-medium capitalize",
                      status === 'published'
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        status === 'published' ? "bg-emerald-500" : "bg-amber-500"
                      )}
                    />
                    <span>{status}</span>
                  </span>
                </td>

                {/* 3. Author Column */}
                <td className="px-3 h-10 py-0 align-middle truncate font-normal">
                  <div className="flex items-center gap-2 min-w-0">
                    {authorName ? (
                      <>
                        {page.author?.avatar ? (
                          <img
                            src={page.author.avatar}
                            alt={authorName}
                            className="size-5 rounded-full object-cover shrink-0 ring-1 ring-border/50"
                          />
                        ) : (
                          <span className="size-5 rounded-full bg-muted text-muted-foreground ring-1 ring-border/50 text-11 font-mono font-medium flex items-center justify-center shrink-0">
                            {authorName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="truncate text-13 text-foreground/85 font-normal" title={authorName}>
                          {authorName}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/40 text-12 font-normal">-</span>
                    )}
                  </div>
                </td>

                {/* 4. Labels Column */}
                <td className="px-3 h-10 py-0 align-middle">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {labels.length > 0 ? (
                      labels.slice(0, 2).map((label: any) => {
                        const labelId = label.id ?? label;
                        const labelName = label.name ?? label;
                        const labelColor = label.color ?? '#3b82f6';
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
                            <span
                              className="size-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: labelColor }}
                            />
                            <span className="truncate max-w-[110px]">{labelName}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-muted-foreground/40 text-12 font-normal">-</span>
                    )}
                    {labels.length > 2 && (
                      <span className="inline-flex items-center h-5 text-11 font-mono font-medium text-muted-foreground px-1.5 rounded-sm bg-muted border border-border/50 shrink-0">
                        +{labels.length - 2}
                      </span>
                    )}
                  </div>
                </td>

                {/* 5. Updated Column */}
                <td className="px-3 h-10 py-0 align-middle text-12 font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                  {page.updatedAt ? formatDate(page.updatedAt) : '-'}
                </td>

                {/* 6. Actions Column */}
                <td className="px-2 h-10 py-0 align-middle text-right">
                  <div
                    className="flex items-center justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity outline-none focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                          aria-label={`Options for ${page.title}`}
                        >
                          <MoreHorizontal className="size-3.5 shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 text-xs z-50">
                        <DropdownMenuItem
                          onClick={() => router.push(linkHref)}
                          className="cursor-pointer gap-2"
                        >
                          <ExternalLink className="size-3.5 text-muted-foreground" />
                          <span>Open page</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleCopyLink(linkHref)}
                          className="cursor-pointer gap-2"
                        >
                          <Link2 className="size-3.5 text-muted-foreground" />
                          <span>Copy link</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicatePage.mutate(page.id)}
                          className="cursor-pointer gap-2"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Duplicate</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(page.id, page.title)}
                          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
