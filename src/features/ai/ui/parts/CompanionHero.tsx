'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';

export function CompanionHero({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center select-none',
        compact ? 'py-2' : 'py-4',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-border bg-panel/60',
          compact ? 'size-12 p-2.5' : 'size-14 p-3',
        )}
      >
        <img
          src="/Chat.svg"
          alt="Flux AI"
          className="size-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}

export default CompanionHero;
