'use client';

export interface PresenceUser {
  socketId: string;
  _id: string;
  name: string;
  avatar: string | null;
}

export function usePagePresence(pageId: string | null | undefined): PresenceUser[] {
  return [];
}

