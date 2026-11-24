import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import AiTab from '@/features/editor/subsystems/ai';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { threadPool, useAiCompanionStore } from '@/features/ai';
import {
  fetchSessions,
  getSession,
} from '@/features/ai/transport/sessions';
import { editorCommandBus } from '@/features/editor/core';

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'test-project-123', pageId: 'test-page-456' }),
}));

vi.mock('@/features/editor/core/bus/useEditorInstance', () => ({
  useEditorInstance: () => ({
    engine: {
      getSelectedText: () => '',
      insertText: vi.fn(),
      focus: vi.fn(),
    },
    getContent: () =>
      '\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}',
  }),
}));

vi.mock('@/features/ai/transport/sessions', () => ({
  fetchSessions: vi.fn().mockResolvedValue([]),
  getSession: vi.fn().mockResolvedValue({
    id: 'chat-shared-99',
    title: 'Shared Global Chat',
    spaceId: 'test-project-123',
    documentIds: [],
    messages: [],
  }),
  renameSession: vi.fn(),
  deleteSession: vi.fn(),
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

function resetAiCompanionStore() {
  useAiCompanionStore.setState({
    activeChatId: null,
    isHistoryView: false,
    pendingPrompt: null,
    quotedPassage: null,
  });
}

describe('AiTab Unified Global AI Synchronization Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    threadPool.clearAll();
    resetAiCompanionStore();
  });

  afterEach(() => {
    cleanup();
    threadPool.clearAll();
    resetAiCompanionStore();
  });

  it('renders unified Global AI header with orb, New chat, Chat history, and hides Full screen in editor', async () => {
    renderWithQuery(<AiTab />);

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    const orbImg = await screen.findByAltText('AI Assistant');
    expect(orbImg.getAttribute('src')).toBe('/Chat.svg');

    expect(
      screen.getByRole('button', { name: /new chat/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /chat history/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /full screen/i }),
    ).toBeNull();

    act(() => {
      useAiCompanionStore.getState().setActiveChatId('chat-shared-99');
    });
    await waitFor(() => {
      expect(screen.getByText('Shared Global Chat')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /full screen/i }),
      ).toBeNull();
    });
  });

  it('renders CompanionHero and LaTeX Suggestions via shared CompanionMessages', async () => {
    renderWithQuery(<AiTab />);

    const heroOrb = await screen.findByAltText('Flux AI');
    expect(heroOrb.getAttribute('src')).toBe('/Chat.svg');

    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Academic Polish')).toBeInTheDocument();
    expect(screen.queryByText('Fix LaTeX Errors')).toBeNull();
    expect(screen.getByText('Explain Content')).toBeInTheDocument();
    expect(screen.getByText('Draft Abstract')).toBeInTheDocument();
    expect(screen.getByText('BibTeX Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Review Citations')).toBeInTheDocument();
  });

  it('renders unified Global AI Composer with Add sources, Web search, Voice input, Send, and disclaimer', async () => {
    renderWithQuery(<AiTab />);

    expect(
      await screen.findByPlaceholderText(/Ask AI about paper, LaTeX syntax/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add sources or files/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /web search/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /voice input/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send message/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Flux AI can make mistakes, please double-check responses\./i,
      ),
    ).toBeInTheDocument();
  });

  it('toggles Chat history and selects a shared Global AI session without rendering Full screen link', async () => {
    vi.mocked(fetchSessions).mockResolvedValue([
      {
        id: 'session-global-1',
        title: 'Literature Synthesis Thread',
        updatedAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(getSession).mockResolvedValue({
      id: 'session-global-1',
      title: 'Literature Synthesis Thread',
      spaceId: 'test-project-123',
      documentIds: [],
      messages: [
        { role: 'user', content: 'Summarize related work' },
        { role: 'assistant', content: 'Here is the synthesis.' },
      ],
    });

    renderWithQuery(<AiTab />);

    fireEvent.click(screen.getByRole('button', { name: /chat history/i }));

    expect(await screen.findByText('Chat history')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /back to chat/i }),
    ).toBeInTheDocument();

    const sessionBtn = await screen.findByText('Literature Synthesis Thread');
    fireEvent.click(sessionBtn);

    await waitFor(() => {
      expect(useAiCompanionStore.getState().activeChatId).toBe(
        'session-global-1',
      );
      expect(useAiCompanionStore.getState().isHistoryView).toBe(false);
    });

    expect(
      screen.queryByRole('link', { name: /full screen/i }),
    ).toBeNull();
    expect(
      await screen.findByText('Here is the synthesis.'),
    ).toBeInTheDocument();
  });

  it('resets activeChatId on New chat', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'session-existing-1',
      title: 'Existing Thread',
      spaceId: 'test-project-123',
      documentIds: [],
      messages: [{ role: 'assistant', content: 'Previous response' }],
    });
    useAiCompanionStore.setState({ activeChatId: 'session-existing-1' });

    renderWithQuery(<AiTab />);

    expect(await screen.findByText('Previous response')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /new chat/i }));

    await waitFor(() => {
      expect(useAiCompanionStore.getState().activeChatId).toBeNull();
      expect(screen.getByText('Suggestions')).toBeInTheDocument();
    });
  });

  it('handles sidebar:open-ai-panel by exiting history view, showing quoted selection chip, and filling prompt', async () => {
    useAiCompanionStore.setState({ isHistoryView: true });
    renderWithQuery(<AiTab />);

    expect(screen.getByText('Chat history')).toBeInTheDocument();

    editorCommandBus.dispatch({
      type: 'sidebar:open-ai-panel',
      selectedText: '\\PassOptionsToPackage{numbers}{natbib}',
      initialPrompt: 'Polish this LaTeX snippet',
    });

    expect(await screen.findByText(/Selected LaTeX/i)).toBeInTheDocument();
    expect(
      screen.getByText(/\\PassOptionsToPackage\{numbers\}\{natbib\}/),
    ).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(
      /Ask AI about the selected text/i,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Polish this LaTeX snippet');
    expect(useAiCompanionStore.getState().isHistoryView).toBe(false);
  });

  it('renders Copy, Insert, Diff on fenced LaTeX blocks and Review Diff on editor_patches widgets via shared MessageParts', async () => {
    const engine = threadPool.getOrCreate('session-editor-1', {
      chatId: 'session-editor-1',
      spaceId: 'test-project-123',
      mode: 'editor',
    });
    engine.hydrateMessages([
      {
        id: 'msg-assist-1',
        role: 'assistant',
        content:
          'Updated equation:\n```latex\nE = mc^2\n```',
        parts: [
          {
            type: 'text',
            text: 'Updated equation:\n```latex\nE = mc^2\n```',
          },
          {
            type: 'widgets',
            widgets: [
              {
                type: 'editor_patches',
                title: 'Proposed LaTeX Edit',
                patches: [
                  {
                    id: 'patch-1',
                    filePath: 'main.tex',
                    kind: 'replace',
                    title: 'Fix formula',
                    searchText: 'E = mc',
                    replaceText: 'E = mc^2',
                    fromLine: 3,
                    toLine: 3,
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    vi.mocked(getSession).mockResolvedValue({
      id: 'session-editor-1',
      title: 'Editor Patches',
      spaceId: 'test-project-123',
      documentIds: [],
      messages: [],
    });
    useAiCompanionStore.setState({ activeChatId: 'session-editor-1' });

    renderWithQuery(<AiTab />);

    expect(
      await screen.findByRole('button', { name: /^copy$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^insert$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^diff$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^review diff$/i }),
    ).toBeInTheDocument();
  });

  it('auto-sends immediately on sidebar:open-ai-panel with autoSend: true and quotes selection', async () => {
    const draftEngine = threadPool.getOrCreate('draft:companion', {
      chatId: null,
      spaceId: null,
      mode: 'editor',
    });
    const sendSpy = vi.spyOn(draftEngine, 'send').mockResolvedValue(undefined);

    renderWithQuery(<AiTab />);

    act(() => {
      editorCommandBus.dispatch({
        type: 'sidebar:open-ai-panel',
        selectedText: 'We look at many samples.',
        initialPrompt: 'Polish the selected passage.',
        autoSend: true,
        forceOpen: true,
      });
    });

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    const [sentText, sentContext] = sendSpy.mock.calls[0];
    expect(sentText).toContain('> We look at many samples.');
    expect(sentText).toContain('Polish the selected passage.');
    expect(sentContext).toEqual(
      expect.objectContaining({
        mode: 'editor',
        editor: expect.objectContaining({
          selection: 'We look at many samples.',
        }),
      }),
    );
  });
});
