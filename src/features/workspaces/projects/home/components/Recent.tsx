'use client';

import React from 'react';
import { Section } from './layouts/section';
import { Loader2, Folder, FileText, File } from 'lucide-react';
import { useRecentItems } from '../hooks/use-home';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/shared/components/ui";
import { ChevronDown } from "lucide-react";
import type { RecentItemUser } from '../types/home.types';

export default function Recent() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { data: items = [], isLoading } = useRecentItems();

  const filterAction = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background text-xs font-medium text-foreground transition-colors cursor-pointer">
          All
          <ChevronDown className="size-3.5 text-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-36 rounded-md bg-popover"
      >
        <DropdownMenuItem className="text-sm cursor-pointer">All</DropdownMenuItem>
        <DropdownMenuItem className="text-sm cursor-pointer">Work Items</DropdownMenuItem>
        <DropdownMenuItem className="text-sm cursor-pointer">Pages</DropdownMenuItem>
        <DropdownMenuItem className="text-sm cursor-pointer">Projects</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Section title='Recents' action={filterAction}>
      {isLoading ? (
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='w-6 h-6 animate-spin text-primary shrink-0' />
        </div>
      ) : items && items.length > 0 ? (
        <div className='grid gap-2'>
          {items.map((item) => {
            const linkTo =
              item.type === 'project'
                ? `/${workspaceId}/projects/${item.id}/overview`
                : item.type === 'page' && item.project
                  ? `/${workspaceId}/projects/${item.project.id}/pages/${item.id}`
                  : item.type === 'file' && item.project
                    ? `/${workspaceId}/projects/${item.project.id}/storage`
                    : `/${workspaceId}/storage`;

            const Icon =
              item.type === 'project'
                ? Folder
                : item.type === 'page'
                  ? FileText
                  : File;

            return (
              <div
                key={item.id}
                className='group relative flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors duration-150 cursor-pointer'
              >
                {/* Icon / Emoji directly on row without box */}
                {item.emoji ? (
                  <span className="text-sm leading-none shrink-0 select-none">{item.emoji}</span>
                ) : (
                  <Icon className='size-4 shrink-0 text-foreground transition-colors' />
                )}
                
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className='text-11 font-medium text-muted-foreground shrink-0 min-w-12 truncate'>
                    {item.project?.identifier || item.project?.name?.substring(0, 6) || (typeof workspaceId === 'string' ? workspaceId.substring(0, 6) : '')}
                  </span>
                  <Link
                    href={linkTo}
                    className='text-13 font-medium text-foreground truncate transition-colors before:absolute before:inset-0 shrink-0'
                  >
                    {item.title || item.name}
                  </Link>
                  <span className='text-xs font-normal text-muted-foreground whitespace-nowrap shrink-0'>
                    {item.updatedAt ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : ''}
                  </span>
                </div>

                <div className="flex items-center -space-x-1 shrink-0 ml-auto">
                  {(Array.isArray(item.users) ? item.users : (item.updatedBy ? [item.updatedBy] : [])).slice(0, 2).map((user: RecentItemUser, i: number) => (
                    <Avatar key={user.id || i} className="size-5 rounded-full border border-background">
                      <AvatarImage src={user.avatar || user.image || undefined} />
                      <AvatarFallback className="bg-muted text-9 font-medium text-foreground">
                        {((user.name || user.email || 'U') as string).substring(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className='p-8 bg-muted border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground'>
          No recent items
        </div>
      )}
    </Section>
  );
}
