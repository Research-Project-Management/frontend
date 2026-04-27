import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "~/lib/socket";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket] = useState(() => getSocket());

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
