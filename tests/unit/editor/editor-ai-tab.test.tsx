import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import AiTab from '@/features/editor/subsystems/ai';
import { threadPool } from '@/features/ai';

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'test-project-123', pageId: 'test-page-456' }),
}));

vi.mock('@/features/editor/core/bus/use-editor-instance', () => ({
  useEditorInstance: () => ({
    engine: {
      getSelectedText: () => '',
      insertText: vi.fn(),
      focus: vi.fn(),
    },
    getContent: () => '\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}',
  }),
}));

vi.mock('@/features/ai/transport/sessions', () => ({
  fetchSessions: vi.fn().mockResolvedValue([]),
  getSession: vi.fn(),
  createSession: vi.fn(),
  renameSession: vi.fn(),
  deleteSession: vi.fn(),
  getPageChat: vi.fn().mockResolvedValue({ chatId: null, messages: [] }),
  clearPageChat: vi.fn().mockResolvedValue(undefined),
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe('AiTab Synchronized Design System Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    threadPool.clearAll();
  });

  afterEach(() => {
    cleanup();
    threadPool.clearAll();
  });

  it('renders unified header with title and action buttons', async () => {
    const handleClose = vi.fn();
    renderWithQuery(<AiTab onClose={handleClose} />);

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close ai panel/i })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Suggestions')).toBeInTheDocument();
    });
  });

  it('renders CompanionHero with 3D AI Orb', async () => {
    renderWithQuery(<AiTab />);

    const orbImg = await screen.findByAltText('Flux AI');
    expect(orbImg).toBeInTheDocument();
    expect(orbImg.getAttribute('src')).toBe('/Chat.svg');
  });

  it('renders signature suggestions list matching project companion sidebar', async () => {
    renderWithQuery(<AiTab />);

    expect(await screen.findByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Academic Polish')).toBeInTheDocument();
    expect(screen.getByText('Fix LaTeX Errors')).toBeInTheDocument();
    expect(screen.getByText('Explain Content')).toBeInTheDocument();
    expect(screen.getByText('Draft Abstract')).toBeInTheDocument();
    expect(screen.getByText('BibTeX Suggestions')).toBeInTheDocument();
  });

  it('renders synchronized bottom input card with Send button without disclaimer', async () => {
    renderWithQuery(<AiTab />);

    const textarea = await screen.findByPlaceholderText(/Ask AI about paper, LaTeX syntax/i);
    expect(textarea).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/Flux AI can make mistakes, please double-check responses/i),
    ).not.toBeInTheDocument();
  });
});
