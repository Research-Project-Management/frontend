import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { DocumentConflictDialog } from '@/features/editor/ui/editor/DocumentConflictDialog';
import type { DocumentConflict } from '@/features/editor/core';

describe('DocumentConflictDialog Component', () => {
  afterEach(() => {
    cleanup();
  });

  const mockConflict: DocumentConflict = {
    fileId: 'file-123',
    localContent: '\\documentclass{article}\n\\begin{document}\nHello Local\n\\end{document}',
    remoteContent: '\\documentclass{article}\n\\begin{document}\nHello Remote\n\\end{document}',
    detectedAt: Date.now(),
  };

  it('renders dialog with diff metrics and buttons when open is true', () => {
    const onResolve = vi.fn();
    render(
      <DocumentConflictDialog
        open={true}
        conflict={mockConflict}
        fileName="main.tex"
        onResolve={onResolve}
      />
    );

    expect(screen.getByTestId('document-conflict-dialog')).toBeDefined();
    expect(screen.getByText('Document conflict detected')).toBeDefined();
    expect(screen.getByText('main.tex')).toBeDefined();
    expect(screen.getByTestId('conflict-diff-metrics')).toBeDefined();
    expect(screen.getByTestId('btn-keep-local')).toBeDefined();
    expect(screen.getByTestId('btn-take-remote')).toBeDefined();
    expect(screen.getByTestId('btn-apply-merge')).toBeDefined();
  });

  it('does not render dialog when open is false', () => {
    render(
      <DocumentConflictDialog
        open={false}
        conflict={mockConflict}
        fileName="main.tex"
        onResolve={vi.fn()}
      />
    );

    expect(screen.queryByTestId('document-conflict-dialog')).toBeNull();
  });

  it('calls onResolve with "keep-local" when Keep Local button is clicked', () => {
    const onResolve = vi.fn();
    render(
      <DocumentConflictDialog
        open={true}
        conflict={mockConflict}
        fileName="main.tex"
        onResolve={onResolve}
      />
    );

    fireEvent.click(screen.getByTestId('btn-keep-local'));
    expect(onResolve).toHaveBeenCalledWith('keep-local');
  });

  it('calls onResolve with "take-remote" when Take Remote button is clicked', () => {
    const onResolve = vi.fn();
    render(
      <DocumentConflictDialog
        open={true}
        conflict={mockConflict}
        fileName="main.tex"
        onResolve={onResolve}
      />
    );

    fireEvent.click(screen.getByTestId('btn-take-remote'));
    expect(onResolve).toHaveBeenCalledWith('take-remote');
  });

  it('switches to Merge Editor tab, allows editing, and calls onResolve with "custom-merge"', () => {
    const onResolve = vi.fn();
    render(
      <DocumentConflictDialog
        open={true}
        conflict={mockConflict}
        fileName="main.tex"
        onResolve={onResolve}
      />
    );

    // Switch to Merge Editor tab
    fireEvent.click(screen.getByTestId('tab-merge'));

    const textarea = screen.getByTestId('conflict-merge-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe(mockConflict.localContent);

    // Edit textarea
    fireEvent.change(textarea, { target: { value: 'Resolved Combined Content' } });
    expect(textarea.value).toBe('Resolved Combined Content');

    // Click Apply Merge button
    fireEvent.click(screen.getByTestId('btn-apply-merge'));
    expect(onResolve).toHaveBeenCalledWith('custom-merge', 'Resolved Combined Content');
  });
});
