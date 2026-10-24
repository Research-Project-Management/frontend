'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Quicklink } from '../types/home.types';

const quicklinksMemoryCache = new Map<string, Quicklink[]>();

export function useQuicklinks(scopeId: string = 'default') {
  const storageKey = `flux-quicklinks-${scopeId || 'default'}`;

  const [links, setLinks] = useState<Quicklink[]>(
    () => quicklinksMemoryCache.get(storageKey) ?? []
  );
  const [isLoaded, setIsLoaded] = useState<boolean>(() =>
    quicklinksMemoryCache.has(storageKey)
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed as Quicklink[];
          quicklinksMemoryCache.set(storageKey, valid);
          setLinks(valid);
        } else {
          quicklinksMemoryCache.set(storageKey, []);
        }
      } else {
        quicklinksMemoryCache.set(storageKey, []);
      }
    } catch (e) {
      console.error('Failed to load quicklinks', e);
    } finally {
      setIsLoaded(true);
    }
  }, [scopeId, storageKey]);

  const addQuicklink = useCallback(
    (data: { url: string; title?: string }) => {
      setLinks((prev) => {
        const next = [
          {
            id: crypto.randomUUID(),
            url: data.url,
            title: data.title || data.url,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
        quicklinksMemoryCache.set(storageKey, next);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const updateQuicklink = useCallback(
    (id: string, data: { url: string; title?: string }) => {
      setLinks((prev) => {
        const next = prev.map((link) =>
          link.id === id
            ? { ...link, url: data.url, title: data.title || link.title }
            : link
        );
        quicklinksMemoryCache.set(storageKey, next);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const removeQuicklink = useCallback(
    (id: string) => {
      setLinks((prev) => {
        const next = prev.filter((link) => link.id !== id);
        quicklinksMemoryCache.set(storageKey, next);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  return {
    state: { links, isLoaded },
    actions: { addQuicklink, updateQuicklink, removeQuicklink },
  };
}
