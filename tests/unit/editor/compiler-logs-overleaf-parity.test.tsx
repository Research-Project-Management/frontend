import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CompilerLogs, parseLatexLog, type LogEntry } from '@/features/editor/ui/features/preview/CompilerLogs';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/features/editor/coordinators/services/ai-error-assist.service', () => ({
  suggestLatexFix: vi.fn().mockResolvedValue({
    fixedSnippet: 'fixed',
    explanation: 'fixed explanation',
    confidence: 'high',
  }),
}));

vi.mock('@/features/editor/coordinators/services/compiler.service', () => ({
  listAuxFiles: vi.fn().mockResolvedValue([]),
  downloadAuxFileUrl: vi.fn(),
  downloadAllArtifactsZipUrl: vi.fn(),
}));

vi.mock('@/features/editor/coordinators/services/manuscript.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/editor/coordinators/services/manuscript.service')>();
  return {
    ...actual,
    manuscriptService: {
      ...actual.manuscriptService,
      diagnostics: {
        parseLog: vi.fn().mockResolvedValue(null),
        getExplanation: vi.fn().mockResolvedValue(null),
        getRules: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

describe('CompilerLogs & Error Inspector (Overleaf Parity)', () => {
  const sampleLog = `This is pdfTeX, Version 3.141592653-2.6-1.40.24 (TeX Live 2022)
(./main.tex
! Undefined control sequence.
l.42 \\invalidcommand
                     {test}
The control sequence was never def'ed.

./sections/intro.tex:18: LaTeX Error: File 'algorithm.sty' not found.

LaTeX Warning: Reference \`sec:missing' on page 1 undefined on input line 55.

Overfull \\hbox (15.234pt too wide) in paragraph at lines 60--65
)
No pages of output.`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('correctly parses errors, warnings, and bad boxes with line and file details', () => {
    const parsed = parseLatexLog(sampleLog);
    expect(parsed.errors.length).toBe(2);
    expect(parsed.errors[0].line).toBe(42);
    expect(parsed.errors[0].message).toContain('Undefined control sequence');

    expect(parsed.errors[1].line).toBe(18);
    expect(parsed.errors[1].file).toBe('sections/intro.tex');
    expect(parsed.errors[1].message).toContain("File 'algorithm.sty' not found");

    expect(parsed.warnings.length).toBe(1);
    expect(parsed.warnings[0].line).toBe(55);

    expect(parsed.badBoxes.length).toBe(1);
    expect(parsed.badBoxes[0].line).toBe(60);
  });

  it('renders explicit "Go to line" buttons for every error with a line number', () => {
    const onJumpToError = vi.fn();
    render(
      <CompilerLogs
        log={sampleLog}
        onClose={vi.fn()}
        onJumpToError={onJumpToError}
      />
    );

    // Look for "Dòng 42" and "Dòng 18" buttons
    const line42Btn = screen.getByRole('button', { name: /dòng 42/i });
    expect(line42Btn).toBeInTheDocument();

    const line18Btn = screen.getByRole('button', { name: /dòng 18/i });
    expect(line18Btn).toBeInTheDocument();
  });

  it('triggers onJumpToError and displays feedback toast when "Go to line" is clicked', () => {
    const onJumpToError = vi.fn();
    render(
      <CompilerLogs
        log={sampleLog}
        onClose={vi.fn()}
        onJumpToError={onJumpToError}
      />
    );

    const line18Btn = screen.getByRole('button', { name: /dòng 18/i });
    fireEvent.click(line18Btn);

    expect(onJumpToError).toHaveBeenCalledWith('sections/intro.tex', 18);
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('18'));
  });

  it('provides Overleaf error stepper (F8 / Next Error) in top header', () => {
    const onJumpToError = vi.fn();
    render(
      <CompilerLogs
        log={sampleLog}
        onClose={vi.fn()}
        onJumpToError={onJumpToError}
      />
    );

    // Error count badge e.g. "1/2 lỗi"
    expect(screen.getByText(/1\/2 lỗi/i)).toBeInTheDocument();

    // Click "Lỗi tiếp theo (F8)"
    const nextBtn = screen.getByRole('button', { name: /lỗi tiếp theo/i });
    fireEvent.click(nextBtn);

    // Should have jumped to second error (line 18)
    expect(onJumpToError).toHaveBeenCalledWith('sections/intro.tex', 18);
    expect(screen.getByText(/2\/2 lỗi/i)).toBeInTheDocument();

    // Click "Lỗi trước (Shift+F8)"
    const prevBtn = screen.getByRole('button', { name: /lỗi trước/i });
    fireEvent.click(prevBtn);

    // Cycles back to first error (line 42)
    expect(onJumpToError).toHaveBeenCalledWith(undefined, 42);
    expect(screen.getByText(/1\/2 lỗi/i)).toBeInTheDocument();
  });

  it('supports keyboard navigation via F8 keydown event', () => {
    const onJumpToError = vi.fn();
    render(
      <CompilerLogs
        log={sampleLog}
        onClose={vi.fn()}
        onJumpToError={onJumpToError}
      />
    );

    // Press F8
    fireEvent.keyDown(window, { key: 'F8' });
    expect(onJumpToError).toHaveBeenCalledWith('sections/intro.tex', 18);

    // Press Shift+F8
    fireEvent.keyDown(window, { key: 'F8', shiftKey: true });
    expect(onJumpToError).toHaveBeenCalledWith(undefined, 42);
  });
});
