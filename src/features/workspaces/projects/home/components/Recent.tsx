'use client';

import React from 'react';
import { Section } from './layouts/section';
import { Loader2, Folder, FileText, File } from 'lucide-react';
import { useRecentItems } from '../hooks/use-home';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/shared/components/ui";
import { ChevronDown } from "lucide-react";

export default function Recent() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { data: items = [], isLoading } = useRecentItems();

  const filterAction = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/50 bg-background text-xs font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer">
          All
          <ChevronDown className="size-3.5 text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-36 rounded-lg bg-popover"
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
              <div
                key={item.id}
                className='group relative flex items-center gap-4 px-3 py-2.5 rounded-lg bg-transparent hover:bg-muted transition-colors duration-200'
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground transition-colors">
                  <Icon className='size-3.5' />
                </div>
                
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className='text-[13px] font-medium text-muted-foreground uppercase w-16 shrink-0 truncate'>
                    {item.project?.name?.substring(0, 5) || workspaceId.substring(0, 5)}
                  </span>
                  <Link
                    href={linkTo}
                    className='text-sm font-semibold text-foreground truncate transition-colors before:absolute before:inset-0 max-w-[200px]'
                  >
                    {item.title || item.name}
                  </Link>
                  <span className='text-xs font-medium text-muted-foreground whitespace-nowrap'>
                    {item.updatedAt ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : ''}
                  </span>
                </div>

                <div className="flex items-center -space-x-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {(item.users || (item.updatedBy ? [item.updatedBy] : [])).slice(0, 3).map((user: any, i: number) => (
                    <Avatar key={i} className="size-6 border-2 border-background">
                      <AvatarImage src={user.avatar || user.image} />
                      <AvatarFallback className="bg-muted text-[10px] font-medium text-foreground">
                        {(user.name || user.email || 'U').substring(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
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
