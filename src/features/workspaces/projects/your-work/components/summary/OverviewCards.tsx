'use client';

import React from 'react';
import Link from 'next/link';
import { PlusSquare, CircleUserRound, Inbox } from 'lucide-react';
import { useParams } from 'next/navigation';
import { cn } from '@/shared/lib/utils';

export interface OverviewCardsProps {
  createdCount?: number;
  assignedCount?: number;
  subscribedCount?: number;
  isLoading?: boolean;
  className?: string;
}

export function OverviewCards({
  createdCount = 0,
  assignedCount = 0,
  subscribedCount = 0,
  isLoading = false,
  className,
}: OverviewCardsProps) {
  const { workspaceId } = useParams() as { workspaceId: string };

  const cards = [
    {
      label: 'Work items created',
      count: createdCount,
      href: `/${workspaceId}/your-work/created`,
      icon: PlusSquare,
    },
    {
      label: 'Work items assigned',
      count: assignedCount,
      href: `/${workspaceId}/your-work/assigned`,
      icon: CircleUserRound,
    },
    {
      label: 'Work items subscribed',
      count: subscribedCount,
      href: `/${workspaceId}/your-work/subscribed`,
      icon: Inbox,
    },
  ];

  return (
    <div className={className}>
      <h2 className="text-foreground font-semibold mb-3 text-sm tracking-tight">
        Overview
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className={cn(
                'flex items-center gap-4 p-4 rounded-lg border border-border/80 bg-card hover:bg-muted/30 hover:border-border transition-all text-left group cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <div className="size-11 rounded-lg border border-border/80 bg-muted/30 flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:bg-muted/50 transition-colors shrink-0">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-foreground mt-0.5">
                  {isLoading ? '-' : card.count}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default OverviewCards;
