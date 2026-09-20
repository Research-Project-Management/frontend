'use client';

import React from 'react';
import { ICON_MAP } from './icon-data';
import { Folder } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface ProjectAvatarProps {
  avatar?: string | null;
  name?: string;
  id?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  className?: string;
  fallbackClassName?: string;
}

export const PROJECT_DEFAULT_EMOJIS = [
  '🚀', '💻', '🎯', '📚', '🔬', '⚡', '🎨', '💡',
  '🧩', '📊', '🛠️', '💼', '📁', '🌟', '🔍', '📈',
  '🤖', '🌐', '📦', '🏷️', '🔮', '🦄', '🏆', '🧭',
  '🛡️', '⚙️', '🔑', '☕', '📱', '🎧', '🧪', '🌈',
  '🪐', '🛸', '🎮', '🔥', '✨', '🍀', '💎', '🌿',
];

/**
 * Returns a random project emoji from the curated list.
 * Used as dynamic default when creating a new project.
 */
export function getRandomProjectEmoji(): string {
  const index = Math.floor(Math.random() * PROJECT_DEFAULT_EMOJIS.length);
  return PROJECT_DEFAULT_EMOJIS[index];
}

/**
 * Generates a stable deterministic project emoji from project id or name.
 * Guarantees that any project lacking an explicit avatar renders identically across all views.
 */
export function getDeterministicProjectEmoji(seed?: string | null): string {
  if (!seed || !seed.trim()) {
    return PROJECT_DEFAULT_EMOJIS[0];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PROJECT_DEFAULT_EMOJIS.length;
  return PROJECT_DEFAULT_EMOJIS[index];
}

const SIZE_STYLES = {
  xs: {
    container: 'size-5 text-10 rounded-md',
    icon: 'size-3.5',
    emoji: 'text-xs',
  },
  sm: {
    container: 'size-5 text-xs',
    icon: 'size-3.5',
    emoji: 'text-sm',
  },
  md: {
    container: 'size-7 text-sm',
    icon: 'size-4',
    emoji: 'text-base',
  },
  lg: {
    container: 'size-10 text-base',
    icon: 'size-5',
    emoji: 'text-xl',
  },
  xl: {
    container: 'size-11 text-lg',
    icon: 'size-6',
    emoji: 'text-2xl',
  },
  '2xl': {
    container: 'size-14 text-xl',
    icon: 'size-7',
    emoji: 'text-3xl',
  },
  custom: {
    container: '',
    icon: 'size-full',
    emoji: '',
  },
};

export function ProjectAvatar({
  avatar,
  name = '',
  id = '',
  size = 'md',
  className,
  fallbackClassName,
}: ProjectAvatarProps) {
  const styles = SIZE_STYLES[size] || SIZE_STYLES.md;

  // 1. Vector Lucide icon ("icon:id:color")
  if (avatar && avatar.startsWith('icon:')) {
    const [, iconId, color] = avatar.split(':');
    const IconComp = (iconId && ICON_MAP[iconId]) || Folder;
    return (
      <div
        className={cn(
          'flex items-center justify-center shrink-0 select-none',
          styles.container,
          className
        )}
      >
        <IconComp
          className={cn('shrink-0', styles.icon)}
          style={{ color: color || 'var(--primary)' }}
        />
      </div>
    );
  }

  // 2. Web Image URL
  if (
    avatar &&
    (avatar.startsWith('http://') ||
      avatar.startsWith('https://') ||
      avatar.startsWith('/') ||
      avatar.startsWith('data:'))
  ) {
    return (
      <div
        className={cn(
          'flex items-center justify-center shrink-0 overflow-hidden select-none',
          styles.container,
          className
        )}
      >
        <img
          src={avatar}
          alt={name || 'Avatar'}
          className="size-full object-cover"
        />
      </div>
    );
  }

  // 3. Emoji string (e.g. "💻", "👌", "🚀")
  if (avatar && avatar.trim()) {
    return (
      <div
        className={cn(
          'flex items-center justify-center shrink-0 select-none leading-none',
          styles.container,
          className
        )}
      >
        <span className={cn('leading-none select-none', styles.emoji)}>
          {avatar}
        </span>
      </div>
    );
  }

  // 4. Deterministic Fallback Emoji (Synchronized across all components for the same project)
  const fallbackEmoji = getDeterministicProjectEmoji(id || name || 'project');
  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0 select-none leading-none',
        styles.container,
        className,
        fallbackClassName
      )}
    >
      <span className={cn('leading-none select-none', styles.emoji)}>
        {fallbackEmoji}
      </span>
    </div>
  );
}

export default ProjectAvatar;
