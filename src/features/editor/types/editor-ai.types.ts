export interface SourceItem {
  source?: string;
  snippet?: string;
  title?: string;
  url?: string;
  authors?: string;
  year?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  widgets?: unknown[];
  selectionContext?: {
    filename: string;
    startLine: number;
    endLine: number;
    text?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  projectId?: string | null;
  messageCount?: number;
  lastMessage?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: (ChatMessage & { id?: string; createdAt?: string })[];
  documentIds?: string[];
}
