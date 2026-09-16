'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';

export const DEFAULT_USER_COVER =
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80';

const EVENT_NAME = 'flux_user_cover_changed';

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
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setCoverState(customEvent.detail);
      }
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const setCover = useCallback(
    (newCover: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, newCover);
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: newCover }));
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
