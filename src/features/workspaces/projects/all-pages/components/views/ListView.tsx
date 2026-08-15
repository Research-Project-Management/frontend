import React from 'react';
import Link from 'next/link';
import { FileText, ChevronRight } from 'lucide-react';

interface ListViewProps {
  pages: any[];
  workspaceId: string;
}

export function ListView({ pages, workspaceId }: ListViewProps) {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Author</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pages.map((page: any) => {
              const projId = typeof page.projectId === 'object' ? page.projectId?._id : page.projectId;
              const mainFileStr = page.mainFile ? (typeof page.mainFile === 'object' ? page.mainFile._id : page.mainFile) : null;
              const fileQuery = mainFileStr ? `?file=${mainFileStr}` : '';
              const linkHref = `/${workspaceId}/projects/${projId}/pages/${page._id}${fileQuery}`;

              return (
                <tr key={page._id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    <Link href={linkHref} className="flex items-center gap-2.5 font-medium text-foreground hover:text-primary transition-colors">
                      <FileText className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      <span className="line-clamp-1">{page.title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {page.updatedAt ? new Date(page.updatedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {page.author?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={linkHref} className="inline-flex items-center justify-center size-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
