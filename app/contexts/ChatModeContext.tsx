import React, { createContext, useContext, useState, useEffect } from "react";

export type ChatMode = "chat" | "wiki";

type ChatModeContextType = {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
};

const ChatModeContext = createContext<ChatModeContextType | undefined>(
  undefined,
);

export function ChatModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ChatMode>("wiki");

  const setMode = (newMode: ChatMode) => {
    setModeState(newMode);
  };

  return (
    <ChatModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ChatModeContext.Provider>
  );
}

export function useChatMode() {
  const context = useContext(ChatModeContext);
  if (context === undefined) {
    throw new Error("useChatMode must be used within a ChatModeProvider");
  }
  return context;
}
