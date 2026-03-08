/**
 * Chat types — aligned with Flux-AI backend models.
 */

/** Single message in a conversation */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A persisted chat session (from RPM-BE ChatHistory) */
export interface ChatSession {
  _id: string;
  title: string;
  projectId: string | null;
  messageCount: number;
  lastMessage: string;
  updatedAt: string;
  createdAt: string;
}

/** Full session including messages (returned by GET /api/ai/chats/:id) */
export interface ChatSessionDetail extends ChatSession {
  messages: (ChatMessage & { _id: string; createdAt: string })[];
  documentIds: string[];
}

/** Legacy request format (still supported by RPM-BE proxy) */
export interface ChatRequest {
  session_id: string;
  query: string;
  enable_web_search?: boolean;
  use_system_knowledge?: boolean;
  selected_files?: string[];
}

/** Agent output from Flux-AI */
export interface AgentOutput {
  agent_name: string;
  content: string;
  sources: Array<{ source: string; score: number }>;
  metadata: Record<string, unknown>;
}

/** Response type identifiers for SSE events */
export interface ChatTypeResponse {
  type: "answer" | "trace";
}

export interface ChatAnswerResponse {
  type: "answer";
  content: string;
}

export interface ChatTraceResponse {
  type: "trace";
  step: number;
  node: string;
  description: string;
  details: object;
}
