import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import RenameCitationModal from '@/features/editor/ui/modals/RenameCitationModal';
import { workspaceCoordinator } from '@/features/editor/coordinators/workspace.coordinator';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

import { usePageStore } from '@/features/editor/store';

describe('Citation Key Refactor & Modal Workflow (Overleaf Parity)', () => {
  beforeEach(() => {
    lruDocumentCache.clearAll();
    usePageStore.setState({
      projectId: 'proj-123',
      currentPage: { id: 'main-doc', projectId: 'proj-123' } as any,
      activeFilePage: { id: 'main-doc', projectId: 'proj-123' } as any,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders RenameCitationModal with current citekey', () => {
    render(
      <RenameCitationModal
        open={true}
        onOpenChange={vi.fn()}
        oldKey="vaswani2017"
      />
    );

    expect(screen.getByText('@vaswani2017')).toBeDefined();
    expect(screen.getByText('Đổi tên khóa trích dẫn (Refactor Citekey)')).toBeDefined();
    expect(screen.getByDisplayValue('vaswani2017')).toBeDefined();
  });

  it('validates citekey and shows real-time error on invalid input', async () => {
    render(
      <RenameCitationModal
        open={true}
        onOpenChange={vi.fn()}
        oldKey="vaswani2017"
      />
    );

    const input = screen.getByDisplayValue('vaswani2017');

    // Type spaces
    fireEvent.change(input, { target: { value: 'vaswani with spaces' } });
    expect(screen.getByText('Khóa trích dẫn không được chứa khoảng trắng.')).toBeDefined();

    // Type special characters
    fireEvent.change(input, { target: { value: 'vaswani{2017}' } });
    expect(
      screen.getByText('Khóa trích dẫn không được chứa các ký tự đặc biệt ({ }, \\, ~, ", %, $, ^).')
    ).toBeDefined();

    // Type identical key
    fireEvent.change(input, { target: { value: 'vaswani2017' } });
    expect(screen.getByText('Khóa trích dẫn mới phải khác với khóa trích dẫn hiện tại.')).toBeDefined();
  });

  it('executes workspaceCoordinator.refactorCitekey across cached models', async () => {
    // 1. Warm cache with 1 bib file and 1 tex file
    lruDocumentCache.warm('bib-1', {
      filePath: 'references.bib',
      content: '@article{vaswani2017,\n  title={Attention Is All You Need}\n}',
      projectId: 'proj-123',
    });
    lruDocumentCache.warm('main-doc', {
      filePath: 'main.tex',
      content: '\\section{Intro}\nAccording to \\cite{vaswani2017}, self-attention is effective.',
      projectId: 'proj-123',
    });

    const onOpenChange = vi.fn();
    render(
      <RenameCitationModal
        open={true}
        onOpenChange={onOpenChange}
        oldKey="vaswani2017"
      />
    );

    const input = screen.getByDisplayValue('vaswani2017');
    fireEvent.change(input, { target: { value: 'vaswani_attention_2017' } });

    const submitBtn = screen.getByText('Xác nhận đổi tên');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    // Verify files in cache have been safely refactored
    const updatedBib = lruDocumentCache.getModel('bib-1');
    expect(updatedBib?.content).toContain('@article{vaswani_attention_2017,');

    const updatedTex = lruDocumentCache.getModel('main-doc');
    expect(updatedTex?.content).toContain('\\cite{vaswani_attention_2017}');
  });
});
