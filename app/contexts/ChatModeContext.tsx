import React, { createContext, useContext, useState, useEffect } from "react";

export type ChatMode = "chat" | "wiki";

type ChatModeContextType = {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  documentIds: string[];
  setDocumentIds: React.Dispatch<React.SetStateAction<string[]>>;
};

const ChatModeContext = createContext<ChatModeContextType | undefined>(
  undefined,
);

export function ChatModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ChatMode>("wiki");
  const [documentIds, setDocumentIds] = useState<string[]>([]);

  const setMode = (newMode: ChatMode) => {
    setModeState(newMode);
  };

  return (
    <ChatModeContext.Provider
      value={{ mode, setMode, documentIds, setDocumentIds }}
    >
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
