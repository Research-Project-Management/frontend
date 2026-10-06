import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AiTab from '@/features/editor/components/sidebar/ai/AiTab';
import { usePageStore } from '@/features/editor/store';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'test-project-123', pageId: 'test-page-456' }),
}));

// Mock editor context
vi.mock('@/features/editor/core/context/editor-instance.context', () => ({
  useEditorInstance: () => ({
    engine: {
      getSelectedText: () => '',
      insertText: vi.fn(),
      focus: vi.fn(),
    },
    getContent: () => '\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}',
  }),
}));

// Mock AI chat service
vi.mock('@/features/ai/services/chat.service', () => ({
  getPageChat: vi.fn().mockResolvedValue([]),
  clearPageChat: vi.fn().mockResolvedValue({ success: true }),
  streamEditorChat: vi.fn(),
}));

describe('AiTab Synchronized Design System Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders unified header with title and action buttons', () => {
    const handleClose = vi.fn();
    render(<AiTab onClose={handleClose} />);

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close ai panel/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders CompanionHero with 3D AI Orb', async () => {
    render(<AiTab />);

    const orbImg = await screen.findByAltText('Flux AI');
    expect(orbImg).toBeInTheDocument();
    expect(orbImg.getAttribute('src')).toBe('/Chat.svg');
  });

  it('renders signature suggestions list matching project companion sidebar', async () => {
    render(<AiTab />);

    expect(await screen.findByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Academic Polish')).toBeInTheDocument();
    expect(screen.getByText('Fix LaTeX Errors')).toBeInTheDocument();
    expect(screen.getByText('Explain Content')).toBeInTheDocument();
    expect(screen.getByText('Draft Abstract')).toBeInTheDocument();
    expect(screen.getByText('BibTeX Suggestions')).toBeInTheDocument();
  });

  it('renders synchronized bottom input card with Send button and disclaimer', async () => {
    render(<AiTab />);

    const textarea = await screen.findByPlaceholderText(/Ask AI about paper, LaTeX syntax/i);
    expect(textarea).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Flux AI can make mistakes, please double-check responses/i)
    ).toBeInTheDocument();
  });
});
