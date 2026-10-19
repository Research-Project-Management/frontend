'use client';

import React, { useState, useMemo } from 'react';
import { Section } from './layouts/section';
import { Loader2, Folder, FileText, File, ChevronDown } from 'lucide-react';
import { useRecentItems } from '../hooks/use-home';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/components/ui/dropdown-menu";
import { useAuth } from '@/features/auth/hooks/use-auth';
import type { RecentItem, RecentItemUser } from '../types/home.types';

export default function Recent() {
  const { data: realItems = [], isLoading } = useRecentItems();
  const { user: currentUser } = useAuth();
  const [filter, setFilter] = useState<'all' | 'work-items' | 'pages' | 'projects'>('all');

  const currentUserObj: RecentItemUser = useMemo(() => ({
    id: currentUser?.id || 'me',
    name: currentUser?.name || currentUser?.email || 'You',
    email: currentUser?.email || null,
    avatar: currentUser?.avatar || (currentUser as { image?: string | null } | undefined)?.image || null,
  }), [currentUser]);

  const items = useMemo(() => {
    // Normalize real items from API with fallbacks, filtering out 'untitled' placeholder items
    const normalizedReal = (realItems || [])
      .filter((item) => {
        const title = (item.title || item.name || '').trim().toLowerCase();
        return title !== '' && !title.includes('untitled');
      })
      .map((item) => ({
        ...item,
        title: item.title || item.name || 'Project',
        updatedAt: item.updatedAt || new Date().toISOString(),
        users: (Array.isArray(item.users) && item.users.length > 0)
          ? item.users
          : (item.updatedBy ? [item.updatedBy] : [currentUserObj]),
        project: item.project || (item.type === 'project' ? { id: item.id, identifier: 'PRJ', name: item.title || 'Project' } : null),
      }));

    const combined: RecentItem[] = normalizedReal;

    if (filter === 'projects') {
      return combined.filter((i) => i.type === 'project');
    }
    if (filter === 'pages') {
      return combined.filter((i) => i.type === 'page');
    }
    if (filter === 'work-items') {
      return combined.filter((i) => i.type === 'work-item' || i.type === 'paper' || i.type === 'file');
    }
    return combined;
  }, [realItems, currentUserObj, filter]);

  const filterLabels: Record<typeof filter, string> = {
    all: 'All',
    'work-items': 'Work Items',
    pages: 'Pages',
    projects: 'Projects',
  };

  const filterAction = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background hover:bg-muted text-12 font-medium text-foreground transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none shadow-none touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
        >
          {filterLabels[filter]}
          <ChevronDown className="size-3.5 text-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-36 rounded-md bg-popover text-12 shadow-overlay"
      >
        <DropdownMenuItem onClick={() => setFilter('all')} className="text-12 cursor-pointer">
          All
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setFilter('work-items')} className="text-12 cursor-pointer">
          Work Items
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setFilter('pages')} className="text-12 cursor-pointer">
          Pages
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setFilter('projects')} className="text-12 cursor-pointer">
          Projects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Section title='Recents' action={filterAction}>
      {isLoading ? (
        <div className="grid gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md animate-pulse motion-reduce:animate-none"
            >
              <div className="size-4 rounded bg-muted shrink-0" />
              <div className="h-3 w-12 rounded bg-muted/60 shrink-0" />
              <div className="h-3.5 w-64 rounded bg-muted flex-1" />
              <div className="h-3 w-16 rounded bg-muted/40 shrink-0" />
              <div className="size-5 rounded-full bg-muted shrink-0" />
            </div>
          ))}
        </div>
      ) : items && items.length > 0 ? (
        <div className='grid gap-1.5'>
          {items.map((item) => {
            const linkTo =
              item.type === 'project'
                ? `/projects/${item.id}/work-items`
                : item.type === 'page' && item.project
                  ? `/projects/${item.project.id}/pages/${item.id}`
                  : item.type === 'file'
                    ? `/storage?highlight=${encodeURIComponent(item.id)}`
                    : `/storage`;

            const Icon =
              item.type === 'project'
                ? Folder
                : item.type === 'page'
                  ? FileText
                  : File;

            const projectIdentifier =
              item.project?.identifier ||
              (item.project?.name ? item.project.name.substring(0, 6) : null);

            return (
              <div
                key={item.id}
                className='group relative flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-muted transition-colors duration-150 cursor-pointer'
              >
                {/* Icon / Emoji directly on row without box */}
                {item.emoji ? (
                  <span className="text-sm leading-none shrink-0 select-none">{item.emoji}</span>
                ) : (
                  <Icon className='size-4 shrink-0 text-foreground transition-colors' />
                )}
                
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {projectIdentifier && (
                    <span className='font-mono text-11 font-medium text-muted-foreground shrink-0 truncate'>
                      {projectIdentifier}
                    </span>
                  )}
                  <Link
                    href={linkTo}
                    className='text-13 font-medium text-foreground truncate transition-colors before:absolute before:inset-0 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                  >
                    {item.title || item.name}
                  </Link>
                  <span className='font-mono text-11 font-normal text-muted-foreground whitespace-nowrap shrink-0'>
                    {item.updatedAt ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : ''}
                  </span>
                </div>

                <div className="flex items-center -space-x-1 shrink-0 ml-auto pl-2">
                  {(Array.isArray(item.users) ? item.users : (item.updatedBy ? [item.updatedBy] : [])).slice(0, 2).map((user: RecentItemUser, i: number) => (
                    <Avatar key={user.id || i} className="size-5 rounded-full border border-background shrink-0">
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
        <div className='py-8 px-4 text-center text-13 text-foreground/80'>
          No recent items
        </div>
      )}
    </Section>
  );
}
