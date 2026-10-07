'use client';

import React, { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import { parseMentionTokens } from '@/features/editor/utils/mention.util';
import { AtSign } from 'lucide-react';

export interface MentionBadgeProps {
  name: string;
  userId?: string;
  className?: string;
}

export const MentionBadge = React.memo(function MentionBadge({
  name,
  userId,
  className,
}: MentionBadgeProps) {
  return (
    <span
      data-mention-user-id={userId}
      data-mention-name={name}
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.2 mx-0.5 rounded-sm font-medium text-xs text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors select-all align-baseline',
        className,
      )}
      title={userId ? `@${name} (ID: ${userId})` : `@${name}`}
    >
      <AtSign className="size-2.5 shrink-0 opacity-70" />
      <span>{name}</span>
    </span>
  );
});

export interface MentionRendererProps {
  content: string;
  className?: string;
}

export const MentionRenderer = React.memo(function MentionRenderer({
  content,
  className,
}: MentionRendererProps) {
  const tokens = useMemo(() => parseMentionTokens(content), [content]);

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return <React.Fragment key={index}>{token.content}</React.Fragment>;
        }
        return (
          <MentionBadge
            key={index}
            name={token.name}
            userId={token.id}
          />
        );
      })}
    </span>
  );
});
