'use client';

import React from 'react';
import HomeSection from './HomeSection';
import { useActivityFeed } from '../hooks/use-home';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui';

export default function Activity() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { data: activities = [], isLoading } = useActivityFeed();

  return (
    <HomeSection title='Activity'>
      {isLoading ? (
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='w-6 h-6 animate-spin text-primary' />
        </div>
      ) : activities && activities.length > 0 ? (
        <div className='space-y-2'>
          {activities.map((activity, index) => (
            <Link
              key={index}
              href={
                activity.type === 'page_update' && activity.project
                  ? `/${workspaceId}/projects/${activity.project._id}/pages/${activity.itemId}`
                  : activity.type === 'task_update' && activity.project
                  ? `/${workspaceId}/projects/${activity.project._id}/tasks`
                  : activity.type === 'file_upload' && activity.project
                  ? `/${workspaceId}/projects/${activity.project._id}/storage`
                  : activity.project
                  ? `/${workspaceId}/projects/${activity.project._id}/overview`
                  : `/${workspaceId}`
              }
              className='p-3 flex items-center gap-4 bg-card border border-border/40 rounded-lg hover:bg-secondary/60 hover:border-border/60 transition-all group cursor-pointer'
            >
              <Avatar className='size-8'>
                <AvatarImage src={activity.user?.avatar} alt={activity.user?.name || 'User'} />
                <AvatarFallback>{(activity.user?.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className='flex-1 min-w-0'>
                <p className='text-sm text-foreground truncate'>
                  <span className='font-semibold'>{activity.user?.name || 'User'}</span>{' '}
                  <span className='text-muted-foreground'>{activity.description || activity.type}</span>
                </p>
              </div>
              <span className='text-xs text-muted-foreground whitespace-nowrap'>
                {formatDistanceToNow(new Date(activity.time), {
                  addSuffix: true,
                })}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className='p-4 min-h-32 bg-secondary rounded-lg text-center flex items-center justify-center text-muted-foreground'>
          No recent activity.
        </div>
      )}
    </HomeSection>
  );
}
