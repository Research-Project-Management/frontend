import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
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


vi.mock('@/features/editor/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/editor/sdk')>();
  return {
    ...actual,
    listAuxFiles: vi.fn().mockResolvedValue([]),
    downloadAuxFileUrl: vi.fn(),
    downloadAllArtifactsZipUrl: vi.fn(),
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

  it('updates currentErrorIdx when editor:error-stepped event is dispatched across command bus', () => {
    render(
      <CompilerLogs
        log={sampleLog}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/1\/2 lỗi/i)).toBeInTheDocument();

    // Dispatch external error-stepped event for index 1
    act(() => {
      editorCommandBus.dispatch({
        type: 'editor:error-stepped',
        errorIndex: 1,
        file: 'sections/intro.tex',
        line: 18,
        message: "File 'algorithm.sty' not found.",
      });
    });

    expect(screen.getByText(/2\/2 lỗi/i)).toBeInTheDocument();
  });

  it('diagnosticsCoordinator.getAllDiagnostics returns indexed diagnostics across all files sorted by file and line', async () => {
    const { diagnosticsCoordinator } = await import('@/features/editor/coordinators/diagnostics.coordinator');
    diagnosticsCoordinator.clear();

    diagnosticsCoordinator.ingestCompilerErrors([
      { line: 50, message: 'Error in main', file: 'main.tex', severity: 'error' },
      { line: 12, message: 'Error in intro', file: 'chapters/intro.tex', severity: 'error' },
      { line: 5, message: 'Warning in main', file: 'main.tex', severity: 'warning' },
    ], 'main.tex');

    const all = diagnosticsCoordinator.getAllDiagnostics();
    expect(all.length).toBe(3);
    expect(diagnosticsCoordinator.getDiagnosticsCount('error')).toBe(2);
    expect(diagnosticsCoordinator.getDiagnosticsCount('warning')).toBe(1);

    // chapters/intro.tex should sort before main.tex alphabetically
    expect(all[0].file).toBe('chapters/intro.tex');
    expect(all[0].line).toBe(12);

    expect(all[1].file).toBe('main.tex');
    expect(all[1].line).toBe(5);

    expect(all[2].file).toBe('main.tex');
    expect(all[2].line).toBe(50);
  });

  it('navigationCoordinator steps across project diagnostics on F8 / Shift+F8 (Overleaf Parity)', async () => {
    const { navigationCoordinator } = await import('@/features/editor/coordinators/navigation.coordinator');
    const { diagnosticsCoordinator } = await import('@/features/editor/coordinators/diagnostics.coordinator');
    const { usePageStore } = await import('@/features/editor/store/editor.store');

    diagnosticsCoordinator.clear();
    diagnosticsCoordinator.ingestCompilerErrors([
      { line: 15, message: 'First error in intro', file: 'sections/intro.tex', severity: 'error' },
      { line: 30, message: 'Second error in intro', file: 'sections/intro.tex', severity: 'error' },
      { line: 88, message: 'Fatal in main', file: 'main.tex', severity: 'error' },
    ], 'main.tex');

    // Simulate active document is sections/intro.tex at line 10
    usePageStore.getState().setActiveFilePage({
      id: 'file-intro',
      title: 'sections/intro.tex',
      path: 'sections/intro.tex',
      content: '',
      pageId: 'project-1',
    });

    const jumpSpy = vi.spyOn(navigationCoordinator, 'jumpToLine').mockImplementation(() => {});
    const steppedEvents: any[] = [];
    const unsub = editorCommandBus.subscribe('editor:error-stepped', (cmd) => {
      steppedEvents.push(cmd);
    });

    // Step next (F8) -> should jump to line 15 in sections/intro.tex
    navigationCoordinator.jumpToNextDiagnostic('error');
    expect(jumpSpy).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'sections/intro.tex',
      line: 15,
      highlight: 'error',
    }));
    expect(steppedEvents.length).toBe(1);
    expect(steppedEvents[0].line).toBe(15);

    // Step previous (Shift+F8) -> should wrap around to line 88 in main.tex
    navigationCoordinator.jumpToPrevDiagnostic('error');
    expect(jumpSpy).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'main.tex',
      line: 88,
      highlight: 'error',
    }));

    unsub();
    jumpSpy.mockRestore();
  });

  it('renders "Download raw log" button in footer and triggers log file download', () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-log');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <CompilerLogs
        log={sampleLog}
        onClose={vi.fn()}
      />
    );

    const downloadBtn = screen.getByRole('button', { name: /download.*log/i });
    expect(downloadBtn).toBeInTheDocument();

    fireEvent.click(downloadBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('output.log'));
  });
});


