'use client';

import React from 'react';
import { PlusSquare, CircleUserRound, Inbox } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

export interface OverviewCardsProps {
  createdCount?: number;
  assignedCount?: number;
  subscribedCount?: number;
}

export function OverviewCards({
  createdCount = 0,
  assignedCount = 0,
  subscribedCount = 0,
}: OverviewCardsProps) {
  const router = useRouter();
  const { workspaceId } = useParams() as { workspaceId: string };

  return (
    <div>
      <h2 className="text-foreground font-semibold mb-3 text-sm tracking-tight">
        Overview
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Created */}
        <button
          type="button"
          onClick={() => router.push(`/${workspaceId}/your-work/created`)}
          className="flex items-center gap-4 p-4 rounded-lg border border-border/80 bg-card hover:bg-muted/30 hover:border-border transition-all text-left group cursor-pointer shadow-2xs"
        >
          <div className="size-11 rounded-lg border border-border/80 bg-muted/30 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
            <PlusSquare className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Work items created</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{createdCount}</p>
          </div>
        </button>

        {/* Card 2: Assigned */}
        <button
          type="button"
          onClick={() => router.push(`/${workspaceId}/your-work/assigned`)}
          className="flex items-center gap-4 p-4 rounded-lg border border-border/80 bg-card hover:bg-muted/30 hover:border-border transition-all text-left group cursor-pointer shadow-2xs"
        >
          <div className="size-11 rounded-lg border border-border/80 bg-muted/30 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
            <CircleUserRound className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Work items assigned</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{assignedCount}</p>
          </div>
        </button>

        {/* Card 3: Subscribed */}
        <button
          type="button"
          onClick={() => router.push(`/${workspaceId}/your-work/subscribed`)}
          className="flex items-center gap-4 p-4 rounded-lg border border-border/80 bg-card hover:bg-muted/30 hover:border-border transition-all text-left group cursor-pointer shadow-2xs"
        >
          <div className="size-11 rounded-lg border border-border/80 bg-muted/30 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
            <Inbox className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Work items subscribed</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{subscribedCount}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

export default OverviewCards;
