import { useEffect, useState } from "react";
import { useSocket } from "~/contexts/SocketProvider";

export type RemoteCursor = { line: number; column: number };

/**
 * Tracks cursor positions of other collaborators on the same page.
 * Returns a Map keyed by socketId → { line, column }.
 * Entries are removed when a user leaves the presence room.
 */
export function useRemoteCursors(
  pageId: string | null | undefined,
): Map<string, RemoteCursor> {
  const socket = useSocket();
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());

  useEffect(() => {
    if (!socket || !pageId) return;

    const roomId = `page:${pageId}`;

    const handleCursor = ({
      socketId,
      pageId: pid,
      line,
      column,
    }: {
      socketId: string;
      pageId: string;
      line: number;
      column: number;
    }) => {
      if (pid !== pageId) return;
      setCursors((prev) => new Map(prev).set(socketId, { line, column }));
    };

    // Clean up stale cursors when a user leaves the presence room
    const handlePresence = ({
      roomId: rid,
      users,
    }: {
      roomId: string;
      users: { socketId: string }[];
    }) => {
      if (rid !== roomId) return;
      const activeIds = new Set(users.map((u) => u.socketId));
      setCursors((prev) => {
        const next = new Map(prev);
        for (const id of prev.keys()) {
          if (!activeIds.has(id)) next.delete(id);
        }
        return next;
      });
    };

    socket.on("page:cursor", handleCursor);
    socket.on("presence:update", handlePresence);

    return () => {
      socket.off("page:cursor", handleCursor);
      socket.off("presence:update", handlePresence);
      setCursors(new Map());
    };
  }, [socket, pageId]);

  return cursors;
}
