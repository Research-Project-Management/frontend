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
    avatar: currentUser?.avatar || (currentUser as any)?.image || null,
  }), [currentUser]);

  const mockRecents: RecentItem[] = useMemo(() => [
    {
      id: 'mock-1',
      type: 'project',
      title: 'Aerodynamic Shape Optimization with Deep Learning',
      emoji: '🚀',
      project: { id: 'proj-aero', identifier: 'AERO', name: 'Aerodynamics' },
      updatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      users: [
        currentUserObj,
        { id: 'u-miller', name: 'Dr. Sarah Miller', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' }
      ]
    },
    {
      id: 'mock-2',
      type: 'paper',
      title: 'Learning Mesh-Based Simulation with Graph Networks',
      emoji: '📄',
      project: { id: 'proj-sim', identifier: 'SIM', name: 'Mesh Sim' },
      updatedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      users: [
        currentUserObj,
        { id: 'u-battaglia', name: 'Peter Battaglia', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' }
      ]
    },
    {
      id: 'mock-3',
      type: 'page',
      title: 'main.tex - ICML 2026 Camera Ready Draft',
      emoji: '📑',
      project: { id: 'proj-icml', identifier: 'ICML', name: 'ICML 2026' },
      updatedAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
      users: [
        currentUserObj,
        { id: 'u-rostova', name: 'Elena Rostova' }
      ]
    },
    {
      id: 'mock-4',
      type: 'paper',
      title: 'Neural Ordinary Differential Equations (NeurIPS)',
      emoji: '🔬',
      project: { id: 'proj-node', identifier: 'NODE', name: 'Neural ODE' },
      updatedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      users: [
        currentUserObj,
        { id: 'u-duvenaud', name: 'David Duvenaud' }
      ]
    },
    {
      id: 'mock-5',
      type: 'page',
      title: 'Quantum Tensor Networks & Error Correction Notes',
      emoji: '⚛️',
      project: { id: 'proj-quant', identifier: 'QUANT', name: 'Quantum Lab' },
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 16).toISOString(),
      users: [
        currentUserObj,
        { id: 'u-sato', name: 'Kenji Sato' }
      ]
    },
    {
      id: 'mock-6',
      type: 'file',
      title: 'Autonomous Robotics Benchmark Dataset (v2.4)',
      emoji: '🤖',
      project: { id: 'proj-robot', identifier: 'ROBOT', name: 'Robotics Fleet' },
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
      users: [
        currentUserObj
      ]
    }
  ], [currentUserObj]);

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

    // Merge real items with high-fidelity mockup items
    const combined: RecentItem[] = [...normalizedReal];
    const existingTitles = new Set(combined.map((i) => (i.title || i.name || '').toLowerCase()));

    for (const mock of mockRecents) {
      if (!existingTitles.has((mock.title || mock.name || '').toLowerCase())) {
        combined.push(mock);
      }
      if (combined.length >= 7) break;
    }

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
  }, [realItems, mockRecents, currentUserObj, filter]);

  const filterLabels: Record<typeof filter, string> = {
    all: 'All',
    'work-items': 'Work Items',
    pages: 'Pages',
    projects: 'Projects',
  };

  const filterAction = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background text-xs font-medium text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary">
          {filterLabels[filter]}
          <ChevronDown className="size-3.5 text-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-36 rounded-md bg-popover"
      >
        <DropdownMenuItem onClick={() => setFilter('all')} className="text-sm cursor-pointer">
          All
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setFilter('work-items')} className="text-sm cursor-pointer">
          Work Items
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setFilter('pages')} className="text-sm cursor-pointer">
          Pages
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setFilter('projects')} className="text-sm cursor-pointer">
          Projects
        </DropdownMenuItem>
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
        <div className='grid gap-1.5'>
          {items.map((item) => {
            const linkTo =
              item.type === 'project'
                ? `/projects/${item.id}/work-items`
                : item.type === 'page' && item.project
                  ? `/projects/${item.project.id}/pages/${item.id}`
                  : item.type === 'file' && item.project
                    ? `/projects/${item.project.id}/storage`
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
                    className='text-13 font-medium text-foreground truncate transition-colors before:absolute before:inset-0'
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
