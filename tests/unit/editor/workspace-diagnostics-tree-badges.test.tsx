import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  diagnosticsCoordinator,
  type IndexedDiagnosticItem,
} from '@/features/editor/subsystems/diagnostics';
import { TexFileRow } from '@/features/editor/subsystems/explorer';
import { FileTreeFolderRow } from '@/features/editor/subsystems/explorer';
import { useSettingsStore } from '@/features/editor/core';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
};

describe('Workspace Diagnostics Coordinator & File Tree Badges (Overleaf Parity)', () => {
  beforeEach(() => {
    diagnosticsCoordinator.clear();
    diagnosticsCoordinator.setFilterOptions({});
    useSettingsStore.setState({
      suppressBadBoxes: false,
      suppressFontWarnings: false,
      suppressPackageWarnings: false,
      customSuppressedWarnings: [],
    });
  });

  afterEach(() => {
    cleanup();
    diagnosticsCoordinator.clear();
  });

  it('aggregates multi-file compiler errors and isolates them per file', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [
        { line: 12, message: 'Undefined control sequence \\foo', file: 'main.tex', severity: 'error' },
        { line: 45, message: 'Missing $ inserted', file: 'chapters/intro.tex', severity: 'error' },
        { line: 88, message: 'Reference `fig:1` undefined', file: 'chapters/intro.tex', severity: 'warning' },
        { line: 5, message: 'Underfull \\hbox (badness 10000)', file: 'sections/methods.tex', severity: 'warning' },
      ],
      'main.tex'
    );

    const mainSummary = diagnosticsCoordinator.getFileSummary('main.tex');
    expect(mainSummary.errorCount).toBe(1);
    expect(mainSummary.warningCount).toBe(0);
    expect(mainSummary.total).toBe(1);

    const introSummary = diagnosticsCoordinator.getFileSummary('chapters/intro.tex');
    expect(introSummary.errorCount).toBe(1);
    expect(introSummary.warningCount).toBe(1);
    expect(introSummary.total).toBe(2);

    const methodsSummary = diagnosticsCoordinator.getFileSummary('sections/methods.tex');
    expect(methodsSummary.errorCount).toBe(0);
    expect(methodsSummary.warningCount).toBe(1);

    const projectSummary = diagnosticsCoordinator.getProjectSummary();
    expect(projectSummary.errorCount).toBe(2);
    expect(projectSummary.warningCount).toBe(2);
    expect(projectSummary.total).toBe(4);
  });

  it('computes aggregated folder rollup diagnostics summary correctly', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [
        { line: 10, message: 'Error in intro', file: 'chapters/intro.tex', severity: 'error' },
        { line: 20, message: 'Error in body', file: 'chapters/body.tex', severity: 'error' },
        { line: 30, message: 'Warning in body', file: 'chapters/body.tex', severity: 'warning' },
        { line: 5, message: 'Warning in appendix', file: 'appendix/app.tex', severity: 'warning' },
      ],
      'main.tex'
    );

    const chaptersSummary = diagnosticsCoordinator.getFolderSummary('chapters');
    expect(chaptersSummary.errorCount).toBe(2);
    expect(chaptersSummary.warningCount).toBe(1);
    expect(chaptersSummary.total).toBe(3);

    const appendixSummary = diagnosticsCoordinator.getFolderSummary('appendix');
    expect(appendixSummary.errorCount).toBe(0);
    expect(appendixSummary.warningCount).toBe(1);

    const emptyFolderSummary = diagnosticsCoordinator.getFolderSummary('images');
    expect(emptyFolderSummary.total).toBe(0);
  });

  it('merges live linter diagnostics with compiler errors and deduplicates cleanly', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [{ line: 15, message: 'Undefined control sequence \\textbf', file: 'main.tex', severity: 'error', code: 'UNDEF_CMD' }],
      'main.tex'
    );

    const linterDiags: IndexedDiagnosticItem[] = [
      {
        id: 'lint-1',
        line: 15,
        column: 1,
        message: 'Undefined control sequence \\textbf',
        file: 'main.tex',
        severity: 'error',
        code: 'UNDEF_CMD',
        source: 'LaTeX Linter',
      },
      {
        id: 'lint-2',
        line: 25,
        column: 4,
        message: 'Unmatched closing brace "}"',
        file: 'main.tex',
        severity: 'error',
        code: 'UNMATCHED_BRACE',
        source: 'LaTeX Linter',
      },
    ];

    diagnosticsCoordinator.ingestLinterDiagnostics('main.tex', linterDiags);

    const diags = diagnosticsCoordinator.getDiagnosticsForFile('main.tex');
    // Deduplicated line 15 UNDEF_CMD + added line 25 UNMATCHED_BRACE
    expect(diags).toHaveLength(2);
    expect(diags.map((d) => d.line)).toEqual([15, 25]);
  });

  it('filters out bad boxes and font warnings dynamically when suppression options are set', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [
        { line: 10, message: 'Overfull \\hbox (15.2pt too wide) in paragraph at lines 10--12', file: 'main.tex', severity: 'warning' },
        { line: 20, message: 'LaTeX Font Warning: Font shape `TU/ptm/m/n\' undefined', file: 'main.tex', severity: 'warning' },
        { line: 30, message: 'Package hyperref Warning: Token not allowed in PDF string', file: 'main.tex', severity: 'warning' },
        { line: 40, message: 'Fatal error occurred, no output PDF file produced!', file: 'main.tex', severity: 'error' },
      ],
      'main.tex'
    );

    // Initial summary: 1 error, 3 warnings
    let summary = diagnosticsCoordinator.getFileSummary('main.tex');
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(3);

    // Suppress bad boxes
    diagnosticsCoordinator.setFilterOptions({ suppressBadBoxes: true });
    summary = diagnosticsCoordinator.getFileSummary('main.tex');
    expect(summary.warningCount).toBe(2);

    // Suppress bad boxes + font warnings
    diagnosticsCoordinator.setFilterOptions({ suppressBadBoxes: true, suppressFontWarnings: true });
    summary = diagnosticsCoordinator.getFileSummary('main.tex');
    expect(summary.warningCount).toBe(1);

    // Suppress all noise
    diagnosticsCoordinator.setFilterOptions({
      suppressBadBoxes: true,
      suppressFontWarnings: true,
      suppressPackageWarnings: true,
    });
    summary = diagnosticsCoordinator.getFileSummary('main.tex');
    expect(summary.warningCount).toBe(0);
    // Errors must never be suppressed
    expect(summary.errorCount).toBe(1);
  });

  it('does not render numeric error badge in TexFileRow when file has errors', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [
        { line: 5, message: 'Syntax error', file: 'main.tex', severity: 'error' },
        { line: 10, message: 'Bad syntax', file: 'main.tex', severity: 'error' },
      ],
      'main.tex'
    );

    expect(diagnosticsCoordinator.getFileSummary('main.tex').errorCount).toBe(2);

    act(() => {
      renderWithProviders(
        <TexFileRow
          file={{ id: 'file-main', title: 'main.tex' }}
          displayLabel="main.tex"
          isActive={false}
          isMain={true}
          isRenaming={false}
          renameValue=""
          isRenamePending={false}
          onFileClick={vi.fn()}
          onStartRename={vi.fn()}
          onRenameChange={vi.fn()}
          onCommitRename={vi.fn()}
          onCancelRename={vi.fn()}
          onDelete={vi.fn()}
          onSetMain={vi.fn()}
        />
      );
    });

    expect(screen.queryByTestId('file-error-badge')).toBeNull();
    expect(screen.queryByTestId('file-warning-badge')).toBeNull();
    expect(screen.queryByText(/^main$/i)).toBeNull();
  });

  it('does not render warning badge in TexFileRow when file has only warnings', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [{ line: 12, message: 'Citation `foo` undefined', file: 'main.tex', severity: 'warning' }],
      'main.tex'
    );

    expect(diagnosticsCoordinator.getFileSummary('main.tex').warningCount).toBe(1);

    act(() => {
      renderWithProviders(
        <TexFileRow
          file={{ id: 'file-main', title: 'main.tex' }}
          displayLabel="main.tex"
          isActive={false}
          isMain={false}
          isRenaming={false}
          renameValue=""
          isRenamePending={false}
          onFileClick={vi.fn()}
          onStartRename={vi.fn()}
          onRenameChange={vi.fn()}
          onCommitRename={vi.fn()}
          onCancelRename={vi.fn()}
          onDelete={vi.fn()}
          onSetMain={vi.fn()}
        />
      );
    });

    expect(screen.queryByTestId('file-warning-badge')).toBeNull();
    expect(screen.queryByTestId('file-error-badge')).toBeNull();
  });

  it('does not render aggregated folder badge in FileTreeFolderRow when collapsed or expanded', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [
        { line: 10, message: 'Error in ch1', file: 'chapters/ch1.tex', severity: 'error' },
        { line: 20, message: 'Error in ch2', file: 'chapters/ch2.tex', severity: 'error' },
      ],
      'main.tex'
    );

    expect(diagnosticsCoordinator.getFolderSummary('chapters').errorCount).toBe(2);

    let rerenderFn: any;
    act(() => {
      const res = renderWithProviders(
        <FileTreeFolderRow
          node={{ id: 'folder-chapters', name: 'chapters', fullPath: 'chapters', type: 'folder', children: [] }}
          isExpanded={false}
          onToggle={vi.fn()}
          onMoveItem={vi.fn()}
          onNewFileInFolder={vi.fn()}
          onUploadToFolder={vi.fn()}
        />
      );
      rerenderFn = res.rerender;
    });

    expect(screen.queryByTestId('folder-error-badge')).toBeNull();
    expect(screen.queryByTestId('folder-warning-badge')).toBeNull();

    act(() => {
      rerenderFn(
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <FileTreeFolderRow
              node={{ id: 'folder-chapters', name: 'chapters', fullPath: 'chapters', type: 'folder', children: [] }}
              isExpanded={true}
              onToggle={vi.fn()}
              onMoveItem={vi.fn()}
              onNewFileInFolder={vi.fn()}
              onUploadToFolder={vi.fn()}
            />
          </TooltipProvider>
        </QueryClientProvider>
      );
    });

    expect(screen.queryByTestId('folder-error-badge')).toBeNull();
    expect(screen.queryByTestId('folder-warning-badge')).toBeNull();
  });

  it('syncs settings store warning suppression to diagnostics coordinator in real time', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [
        { line: 15, message: 'Underfull \\hbox (badness 5000)', file: 'main.tex', severity: 'warning' },
      ],
      'main.tex'
    );

    let summary = diagnosticsCoordinator.getFileSummary('main.tex');
    expect(summary.warningCount).toBe(1);

    // Toggle suppressBadBoxes in settings store
    useSettingsStore.getState().setSuppressBadBoxes(true);

    summary = diagnosticsCoordinator.getFileSummary('main.tex');
    expect(summary.warningCount).toBe(0);

    // Re-enable
    useSettingsStore.getState().setSuppressBadBoxes(false);
    summary = diagnosticsCoordinator.getFileSummary('main.tex');
    expect(summary.warningCount).toBe(1);
  });

  it('does NOT leak nested folder diagnostics onto unrelated top-level folders with the same leaf name', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [
        {
          line: 14,
          message: 'Missing closing brace',
          file: 'chapters/part3/figures/plot.tex',
          severity: 'error',
        },
      ],
      'main.tex',
    );

    const rootFiguresSummary = diagnosticsCoordinator.getFolderSummary('figures');
    expect(rootFiguresSummary.errorCount).toBe(0);
    expect(rootFiguresSummary.total).toBe(0);

    const nestedFiguresSummary = diagnosticsCoordinator.getFolderSummary('chapters/part3/figures');
    expect(nestedFiguresSummary.errorCount).toBe(1);
    expect(nestedFiguresSummary.total).toBe(1);

    const chaptersSummary = diagnosticsCoordinator.getFolderSummary('chapters');
    expect(chaptersSummary.errorCount).toBe(1);

    act(() => {
      renderWithProviders(
        <FileTreeFolderRow
          node={{ id: 'folder-root-figures', name: 'figures', fullPath: 'figures', type: 'folder', children: [] }}
          isExpanded={false}
          onToggle={vi.fn()}
          onMoveItem={vi.fn()}
          onNewFileInFolder={vi.fn()}
          onUploadToFolder={vi.fn()}
        />,
      );
    });

    expect(screen.queryByTestId('folder-error-badge')).toBeNull();
    expect(screen.queryByTestId('folder-warning-badge')).toBeNull();
  });

  it('migrates and purges compiler & linter diagnostics cleanly on renamePath and removePath', () => {
    diagnosticsCoordinator.ingestCompilerErrors(
      [
        { line: 8, message: 'Error in intro', file: 'sections/intro.tex', severity: 'error' },
        { line: 12, message: 'Warning in body', file: 'sections/body.tex', severity: 'warning' },
      ],
      'main.tex',
    );
    diagnosticsCoordinator.ingestLinterDiagnostics('sections/intro.tex', [
      {
        id: 'lint-intro-1',
        file: 'sections/intro.tex',
        normalizedPath: 'sections/intro.tex',
        line: 20,
        message: 'Lint hint',
        severity: 'warning',
        source: 'LaTeX Linter',
      },
    ]);

    expect(diagnosticsCoordinator.getFolderSummary('sections').errorCount).toBe(1);
    expect(diagnosticsCoordinator.getFolderSummary('sections').warningCount).toBe(2);

    // Rename folder sections -> chapters
    diagnosticsCoordinator.renamePath('sections', 'chapters');

    expect(diagnosticsCoordinator.getFolderSummary('sections').total).toBe(0);
    expect(diagnosticsCoordinator.getFolderSummary('chapters').errorCount).toBe(1);
    expect(diagnosticsCoordinator.getFolderSummary('chapters').warningCount).toBe(2);
    expect(diagnosticsCoordinator.getFileSummary('chapters/intro.tex').errorCount).toBe(1);
    expect(diagnosticsCoordinator.getFileSummary('chapters/intro.tex').warningCount).toBe(1);

    // Delete single file chapters/intro.tex
    diagnosticsCoordinator.removePath('chapters/intro.tex');
    expect(diagnosticsCoordinator.getFileSummary('chapters/intro.tex').total).toBe(0);
    expect(diagnosticsCoordinator.getFolderSummary('chapters').errorCount).toBe(0);
    expect(diagnosticsCoordinator.getFolderSummary('chapters').warningCount).toBe(1);

    // Delete entire folder chapters
    diagnosticsCoordinator.removePath('chapters');
    expect(diagnosticsCoordinator.getFolderSummary('chapters').total).toBe(0);
    expect(diagnosticsCoordinator.getFileSummary('chapters/body.tex').total).toBe(0);
  });
});
