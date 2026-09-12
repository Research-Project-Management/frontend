'use client';

import React from 'react';
import Link from 'next/link';
import { PlusSquare, CircleUserRound, Inbox } from 'lucide-react';
import { useParams } from 'next/navigation';
import { cn } from "@/shared/lib/utils";

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
      <h2 className="text-sm font-semibold text-foreground tracking-tight mb-2.5">
        Overview
      </h2>
      <div className="grid gap-3.5 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="flex items-center gap-3.5 p-3.5 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors text-left group cursor-pointer shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="size-10 rounded-md bg-background/80 flex items-center justify-center text-foreground shrink-0">
                <Icon className="size-5 text-foreground shrink-0" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground font-normal">
                  {card.label}
                </p>
                <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
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
