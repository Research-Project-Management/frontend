'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Quicklink } from '../types/home.types';

export function useQuicklinks(workspaceId: string) {
  const [links, setLinks] = useState<Quicklink[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const storageKey = `flux-quicklinks-${workspaceId}`;

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setLinks(JSON.parse(raw));
      }
    } catch (e) {
      console.error('Failed to load quicklinks', e);
    } finally {
      setIsLoaded(true);
    }
  }, [workspaceId, storageKey]);

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
