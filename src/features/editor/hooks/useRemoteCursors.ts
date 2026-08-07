'use client';

export type RemoteCursor = { line: number; column: number };

export function useRemoteCursors(
  pageId: string | null | undefined,
): Map<string, RemoteCursor> {
  return new Map();
}
