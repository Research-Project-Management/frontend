import type { ChatRequest } from "~/types/chat";

const API_BASE_URL = "https://unquellable-unsyllabled-marquetta.ngrok-free.dev";

export async function* streamChatResponse(
  chatRequest: ChatRequest,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(chatRequest),
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch chat response");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Hook để sử dụng trong component
export function useChatStream() {
  const streamChat = async (
    chatRequest: ChatRequest,
    onChunk: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ) => {
    const controller = new AbortController();

    try {
      for await (const chunk of streamChatResponse(
        chatRequest,
        controller.signal
      )) {
        onChunk(chunk);
      }
      onComplete?.();
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        onError?.(error);
      }
    }

    return () => controller.abort();
  };

  return { streamChat };
}
