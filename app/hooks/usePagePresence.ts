import { useEffect, useState } from "react";
import { useSocket } from "~/contexts/SocketProvider";
import { useAuth } from "~/hooks/useAuth";

export interface PresenceUser {
  socketId: string;
  _id: string;
  name: string;
  avatar: string | null;
}

export function usePagePresence(pageId: string | null | undefined): PresenceUser[] {
  const socket = useSocket();
  const { user } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!socket || !pageId || !user) return;
    const roomId = `page:${pageId}`;
    const userInfo = { _id: user._id, name: user.name, avatar: user.avatar };

    const emitJoin = () =>
      socket.emit("presence:join", { roomId, user: userInfo });

    // Join immediately and re-join after every reconnect
    emitJoin();
    socket.on("connect", emitJoin);

    const onUpdate = ({ roomId: rid, users: u }: { roomId: string; users: PresenceUser[] }) => {
      if (rid === roomId) setUsers(u);
    };
    socket.on("presence:update", onUpdate);

    return () => {
      socket.off("connect", emitJoin);
      socket.emit("presence:leave", { roomId });
      socket.off("presence:update", onUpdate);
      setUsers([]);
    };
  }, [socket, pageId, user?._id]);

  return users;
}
