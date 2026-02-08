export interface ChatRequest {
  session_id: string;
  query: string;
  enable_web_search?: boolean;
  use_system_knowledge?: boolean;
  selected_files?: string[];
}

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
  desciption: string;
  details: object;
}
