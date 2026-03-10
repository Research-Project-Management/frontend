import { useEffect } from "react";
import { useSocket } from "~/contexts/SocketProvider";

/**
 * Joins a Socket.IO room on mount and leaves on unmount.
 * @param type - room type: "page" | "project" | "workspace"
 * @param id   - the entity id (or null/undefined to skip)
 */
export function useSocketRoom(
  type: "page" | "project" | "workspace",
  id: string | null | undefined,
) {
  const socket = useSocket();
  useEffect(() => {
    if (!socket || !id) return;
    const join = () => socket.emit(`join:${type}`, id);
    // Join immediately (works if already connected; socket.io buffers if not yet connected)
    join();
    // Re-join after every reconnect (socket gets a new id on reconnect)
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      socket.emit(`leave:${type}`, id);
    };
  }, [socket, type, id]);
}
