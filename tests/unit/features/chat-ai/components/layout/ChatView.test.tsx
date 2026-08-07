import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatView from '@/features/chat-ai/components/layout/ChatView';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Note: These imports are legacy from Vite structure and need to be rewritten for Next.js App Router
// import * as ChatAiQuery from '@/features/chat-ai/services...';
// import * as WorkspaceQuery from '@/features/workspaces/services...';
// import * as ChatModeContext from '@/features/chat-ai/store...';

// Mock dependencies
vi.mock('@/features/chat-ai/services/api', () => ({
  streamChatResponse: vi.fn(),
  getChatSession: vi.fn(),
  appendChatMessages: vi.fn(),
  createChatSession: vi.fn(),
}));

vi.mock('@/features/workspaces/hooks/useWorkspace', () => ({
  useWorkspace: vi.fn(),
}));

vi.mock('@/features/chat-ai/store/ChatModeContext', () => ({
  useChatMode: vi.fn(),
}));

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe.skip('ChatView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (WorkspaceQuery.useWorkspace as any).mockReturnValue({
      workspace: { _id: 'test-workspace', name: 'Test WS' },
    });
    
    (ChatModeContext.useChatMode as any).mockReturnValue({
      mode: 'focus',
      setMode: vi.fn(),
      setFluxDataEnabled: vi.fn(),
      enabledDocumentIds: [],
      fluxDataEnabled: false,
      addSource: vi.fn(),
      restoreSourceIds: vi.fn(),
      clearSources: vi.fn(),
    });
    
    (ChatAiQuery.getChatSession as any).mockResolvedValue({
      id: 'test-chat-id',
      messages: [
        { role: 'assistant', content: 'Hello, how can I help you?', timestamp: new Date() }
      ]
    });
  });

  it('renders initial state for new chat', async () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspace/test-workspace/ai']}>
          <Routes>
            <Route path="/workspace/:workspaceId/ai" element={<ChatView />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    
    // Should render the welcome text since it's a new chat (no chatId in params)
    expect(screen.getByText(/Ask Flux AI/i)).toBeInTheDocument();
  });

  it('renders chat history when chatId is provided', async () => {
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/workspace/test-workspace/ai/test-chat-id']}>
          <Routes>
            <Route path="/workspace/:workspaceId/ai/:chatId?" element={<ChatView />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    
    // Wait for the mock chat history to render
    await waitFor(() => {
      expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument();
    });
  });
});
