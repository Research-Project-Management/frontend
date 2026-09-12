'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';

interface AvatarProperties extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'default' | 'sm' | 'lg';
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProperties>(
  ({ className, size = 'default', ...remainingProperties }, forwardedReference) => {
    return (
      <span
        ref={forwardedReference}
        data-slot='avatar'
        data-size={size}
        className={cn(
          'group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6',
          className
        )}
        {...remainingProperties}
      />
    );
  }
);
Avatar.displayName = 'Avatar';

interface AvatarImageProperties extends React.ImgHTMLAttributes<HTMLImageElement> {
  onLoadingStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProperties>(
  ({ className, src, alt, ...remainingProperties }, forwardedReference) => {
    const [hasLoadingError, setHasLoadingError] = React.useState(false);

    if (!src || hasLoadingError) {
      return null;
    }

    return (
      <img
        ref={forwardedReference}
        src={src}
        alt={alt}
        onError={() => setHasLoadingError(true)}
        data-slot='avatar-image'
        className={cn('aspect-square size-full object-cover', className)}
        {...remainingProperties}
      />
    );
  }
);
AvatarImage.displayName = 'AvatarImage';

interface AvatarFallbackProperties extends React.HTMLAttributes<HTMLSpanElement> {
  delayMilliseconds?: number;
}

const AvatarFallback = React.forwardRef<HTMLSpanElement, AvatarFallbackProperties>(
  ({ className, ...remainingProperties }, forwardedReference) => {
    return (
      <span
        ref={forwardedReference}
        data-slot='avatar-fallback'
        className={cn(
          'flex size-full items-center justify-center rounded-full bg-muted text-foreground font-semibold group-data-[size=sm]/avatar:text-xs',
          className
        )}
        {...remainingProperties}
      />
    );
  }
);
AvatarFallback.displayName = 'AvatarFallback';

function AvatarBadge({ className, ...remainingProperties }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot='avatar-badge'
      className={cn(
        'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none',
        'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
        'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
        'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
        className
      )}
      {...remainingProperties}
    />
  );
}

function AvatarGroup({ className, ...remainingProperties }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='avatar-group'
      className={cn(
        'group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
        className
      )}
      {...remainingProperties}
    />
  );
}

function AvatarGroupCount({
  className,
  ...remainingProperties
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='avatar-group-count'
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3',
        className
      )}
      {...remainingProperties}
    />
  );
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
};
