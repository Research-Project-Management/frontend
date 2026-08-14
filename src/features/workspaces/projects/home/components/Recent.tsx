'use client';

import React from 'react';
import { Section } from './layouts/section';
import { Loader2, Folder, FileText, File } from 'lucide-react';
import { useRecentItems } from '../hooks/use-home';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default function Recent() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { data: items = [], isLoading } = useRecentItems();

  return (
    <Section title='Recent'>
      {isLoading ? (
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='w-6 h-6 animate-spin text-primary' />
        </div>
      ) : items && items.length > 0 ? (
        <div className='grid gap-2'>
          {items.map((item) => {
            const linkTo =
              item.type === 'project'
                ? `/${workspaceId}/projects/${item.id}/overview`
                : item.type === 'page' && item.project
                  ? `/${workspaceId}/projects/${item.project._id}/pages/${item.id}`
                  : item.type === 'file' && item.project
                    ? `/${workspaceId}/projects/${item.project._id}/storage`
                    : `/${workspaceId}/storage`;

            const Icon =
              item.type === 'project'
                ? Folder
                : item.type === 'page'
                  ? FileText
                  : File;

            return (
              <Link
                key={item.id}
                href={linkTo}
                className='flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:bg-muted/60 hover:border-border/40 transition-colors duration-200 group cursor-pointer'
              >
                <Icon className='size-4 text-muted-foreground group-hover:text-primary transition-colors' />
                <span className='text-sm font-medium text-foreground truncate flex-1'>
                  {item.title || item.name}
                </span>
                {item.updatedAt && (
                  <span className='text-xs text-muted-foreground whitespace-nowrap'>
                    {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className='p-8 bg-muted/20 border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground'>
          No recent items
        </div>
      )}
    </Section>
  );
}
