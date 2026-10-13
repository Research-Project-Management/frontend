import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as Y from 'yjs';
import { CollaborativeDiagramModal } from '@/features/editor/ui/modals/diagram-canvas/CollaborativeDiagramModal';

describe('CollaborativeDiagramModal Component', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders modal when open=true and displays toolbar and presets', () => {
    const handleInsert = vi.fn();
    const handleOpenChange = vi.fn();
    const yDoc = new Y.Doc();

    render(
      <CollaborativeDiagramModal
        open={true}
        onOpenChange={handleOpenChange}
        onInsert={handleInsert}
        yDoc={yDoc}
      />
    );

    expect(screen.getByText('Collaborative Diagram & TikZ Canvas')).toBeDefined();
    expect(screen.getByText('Transformer Attention')).toBeDefined();
    expect(screen.getByText('ML Pipeline')).toBeDefined();
    expect(screen.getByText('Flowchart')).toBeDefined();

    yDoc.destroy();
  });

  it('loads preset and switches to TikZ Code tab to view generated code', () => {
    const handleInsert = vi.fn();
    const handleOpenChange = vi.fn();
    const yDoc = new Y.Doc();

    render(
      <CollaborativeDiagramModal
        open={true}
        onOpenChange={handleOpenChange}
        onInsert={handleInsert}
        yDoc={yDoc}
      />
    );

    // Click Flowchart preset
    const flowchartBtn = screen.getAllByText('Flowchart')[0];
    fireEvent.click(flowchartBtn);

    // Switch to TikZ Code tab
    const tikzTab = screen.getByText('TikZ Code');
    fireEvent.click(tikzTab);

    // Check code view content
    expect(screen.getByText('Live Generated LaTeX TikZ AST')).toBeDefined();
    expect(screen.getByText(/\\begin\{tikzpicture\}/)).toBeDefined();

    // Click Insert into LaTeX button
    const insertBtn = screen.getByText('Insert into LaTeX');
    fireEvent.click(insertBtn);

    expect(handleInsert).toHaveBeenCalled();
    expect(handleInsert.mock.calls[0][0]).toContain('\\begin{tikzpicture}');

    yDoc.destroy();
  });
});
