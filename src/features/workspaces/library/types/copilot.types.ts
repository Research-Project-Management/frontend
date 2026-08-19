export interface CopilotCitation {
  pageNumber: number;
  section?: string;
  quote?: string;
  box?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: CopilotCitation[];
  timestamp: string;
  isStreaming?: boolean;
}

export interface QuickPrompt {
  id: string;
  title: string;
  icon: string;
  prompt: string;
  description: string;
}

export interface CopilotPaperContext {
  paperId: string;
  title: string;
  authors: string[];
  year?: number | null;
  doi?: string;
  ragDocId?: string;
  workspaceId: string;
}
