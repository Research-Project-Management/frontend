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
    socket.emit(`join:${type}`, id);
    return () => {
      socket.emit(`leave:${type}`, id);
    };
  }, [socket, type, id]);
}
