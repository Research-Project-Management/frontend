'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { APP_EVENTS, emitAppEvent, onAppEvent } from '@/config/events';

export const DEFAULT_USER_COVER =
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80';

export function useUserCover() {
  const { user } = useAuth();
  const userId = user?.id || 'default';
  const storageKey = `flux_user_cover_${userId}`;

  const [cover, setCoverState] = useState<string>(DEFAULT_USER_COVER);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setCoverState(stored);
    } else {
      setCoverState(DEFAULT_USER_COVER);
    }
  }, [storageKey]);

  useEffect(() => {
    return onAppEvent<string>(APP_EVENTS.USER_COVER_CHANGED, (detail) => {
      if (detail) {
        setCoverState(detail);
      }
    });
  }, []);

  const setCover = useCallback(
    (newCover: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, newCover);
        emitAppEvent(APP_EVENTS.USER_COVER_CHANGED, newCover);
      }
      setCoverState(newCover);
    },
    [storageKey]
  );

  return {
    cover,
    setCover,
  };
}
