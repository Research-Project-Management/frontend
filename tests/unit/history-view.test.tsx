import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryHeader } from '@/features/editor/components/history/subcomponents/HistoryHeader';
import { HistoryChangedFiles } from '@/features/editor/components/history/subcomponents/HistoryChangedFiles';
import { HistoryViewerHeader } from '@/features/editor/components/history/subcomponents/HistoryViewerHeader';
import { HistoryTimeline } from '@/features/editor/components/history/subcomponents/HistoryTimeline';
import { HistoryRestoreModal } from '@/features/editor/components/history/subcomponents/HistoryRestoreModal';

describe('Overleaf 1:1 History View Shaped Architecture', () => {
  describe('HistoryHeader', () => {
    it('renders project title and pane toggle buttons without parentheses', () => {
      const onToggleLeft = vi.fn();
      const onToggleRight = vi.fn();
      const onClose = vi.fn();

      render(
        <HistoryHeader
          projectTitle="Quantum Computing Paper"
          isLeftPaneOpen={true}
          isRightPaneOpen={true}
          onToggleLeftPane={onToggleLeft}
          onToggleRightPane={onToggleRight}
          onClose={onClose}
        />,
      );

      expect(screen.getByText('Quantum Computing Paper')).toBeInTheDocument();
      expect(screen.getByText('Back to editor')).toBeInTheDocument();

      const backBtn = screen.getByRole('button', { name: /back to editor/i });
      fireEvent.click(backBtn);
      expect(onClose).toHaveBeenCalledTimes(1);

      // Verify no parentheses in text content
      const headerText = screen.getByRole('banner').textContent || '';
      expect(headerText).not.toMatch(/\(\d+\)/);
    });
  });

  describe('HistoryChangedFiles (Left Pane)', () => {
    const mockChangedFiles = [
      { cleanPath: 'main.tex', status: 'modified', additions: 15, deletions: 3, id: 'page-1' },
      { cleanPath: 'references.bib', status: 'added', additions: 8, deletions: 0, id: 'page-2' },
    ];
    const mockDeletedFiles = [
      { id: 'page-del-1', title: 'old-draft.tex' },
    ];

    it('renders changed files with diff stats and zero scattered restore buttons', () => {
      const onSelectFile = vi.fn();

      render(
        <HistoryChangedFiles
          isOpen={true}
          viewMode="diff"
          diffChangedFiles={mockChangedFiles}
          unchangedFiles={[]}
          snapshotFiles={[]}
          deletedFiles={mockDeletedFiles}
          selectedFilePath="main.tex"
          onSelectFile={onSelectFile}
          activeVersionNumber={3}
        />,
      );

      // Header should display "Changed files: 2" (no parentheses)
      expect(screen.getByText('Changed files: 2')).toBeInTheDocument();
      expect(screen.getByText('Deleted files: 1')).toBeInTheDocument();

      // Files listed
      expect(screen.getByText('main.tex')).toBeInTheDocument();
      expect(screen.getByText('references.bib')).toBeInTheDocument();
      expect(screen.getByText('old-draft.tex')).toBeInTheDocument();

      // Diff stats displayed
      expect(screen.getByText('+15')).toBeInTheDocument();
      expect(screen.getByText('-3')).toBeInTheDocument();
      expect(screen.getByText('+8')).toBeInTheDocument();

      // CRITICAL DESIGN INVARIANT: Zero restore buttons inside file rows
      const restoreButtons = screen.queryAllByRole('button', { name: /restore/i });
      expect(restoreButtons).toHaveLength(0);

      // Clicking a file calls onSelectFile
      const bibFileBtn = screen.getByRole('button', { name: /select file references\.bib/i });
      fireEvent.click(bibFileBtn);
      expect(onSelectFile).toHaveBeenCalledWith('references.bib');
    });
  });

  describe('HistoryViewerHeader (Center Viewer Top)', () => {
    it('houses the single canonical version action group (Restore, Label, Download) and pure Overleaf view modes', () => {
      const onChangeViewMode = vi.fn();
      const onOpenRestoreModal = vi.fn();
      const onOpenLabelModal = vi.fn();
      const onDownloadZip = vi.fn();

      render(
        <HistoryViewerHeader
          viewMode="diff"
          onChangeViewMode={onChangeViewMode}
          activeFileName="main.tex"
          formattedRevisionDate="6 Oct 2026 at 20:30"
          compareTargetId="current"
          onChangeCompareTargetId={vi.fn()}
          timelineItems={[]}
          selectedEventId="ev-1"
          additions={15}
          deletions={3}
          filesChangedCount={2}
          activeVersionLabel="Conference Submission"
          onOpenRestoreModal={onOpenRestoreModal}
          onOpenLabelModal={onOpenLabelModal}
          onDownloadZip={onDownloadZip}
        />,
      );

      // View mode buttons (Pure Overleaf parity: Compare Diff vs View Source; NO Time Machine)
      expect(screen.getByRole('button', { name: /compare diff/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view source/i })).toBeInTheDocument();
      expect(screen.queryByText(/time machine/i)).not.toBeInTheDocument();

      // Diff stats displayed without parentheses
      expect(screen.getByText('+15')).toBeInTheDocument();
      expect(screen.getByText('-3')).toBeInTheDocument();
      expect(screen.getByText('Files changed: 2')).toBeInTheDocument();

      // Single canonical action buttons
      const restoreBtn = screen.getByRole('button', { name: /restore version or file/i });
      expect(restoreBtn).toBeInTheDocument();
      fireEvent.click(restoreBtn);
      expect(onOpenRestoreModal).toHaveBeenCalledTimes(1);

      const labelBtn = screen.getByRole('button', { name: /edit milestone label/i });
      expect(labelBtn).toBeInTheDocument();
      fireEvent.click(labelBtn);
      expect(onOpenLabelModal).toHaveBeenCalledTimes(1);

      const downloadBtn = screen.getByRole('button', { name: /download zip archive/i });
      expect(downloadBtn).toBeInTheDocument();
      fireEvent.click(downloadBtn);
      expect(onDownloadZip).toHaveBeenCalledTimes(1);
    });
  });

  describe('HistoryTimeline (Right Pane)', () => {
    const mockTimelineGroups = [
      {
        groupName: 'Today',
        items: [
          {
            id: 'rev-2',
            versionNumber: 2,
            title: 'Section 2 update',
            label: 'Draft v1',
            fileName: 'main.tex',
            date: new Date().toISOString(),
            author: 'Alice Researcher',
            eventType: 'edit',
          },
          {
            id: 'rev-1',
            versionNumber: 1,
            title: 'Initial commit',
            fileName: 'main.tex',
            date: new Date(Date.now() - 3600000).toISOString(),
            author: 'Bob Collaborator',
            eventType: 'collaborative_checkpoint',
          },
        ],
      },
    ];

    it('renders timeline cards with zero 3-dots menus or duplicated actions', () => {
      const onSelectRevision = vi.fn();
      const onChangeTab = vi.fn();

      render(
        <HistoryTimeline
          isOpen={true}
          timelineTab="all"
          onChangeTab={onChangeTab}
          labeledCount={1}
          isLoading={false}
          groupedTimeline={mockTimelineGroups}
          selectedEventId="rev-2"
          onSelectRevision={onSelectRevision}
        />,
      );

      // Tabs: All history & Labels with count pill (no parentheses)
      expect(screen.getByRole('button', { name: /all history/i })).toBeInTheDocument();
      expect(screen.getByText('Labels')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();

      // Card content
      expect(screen.getByText(/today/i)).toBeInTheDocument();
      expect(screen.getByText('Draft v1')).toBeInTheDocument();
      expect(screen.getByText('Alice Researcher')).toBeInTheDocument();
      expect(screen.getByText('Bob Collaborator')).toBeInTheDocument();

      // CRITICAL DESIGN INVARIANT: Zero 3-dots action menus on timeline cards!
      const moreButtons = screen.queryAllByRole('button', { name: /actions for revision/i });
      expect(moreButtons).toHaveLength(0);

      // Clicking card selects revision
      const rev1Card = screen.getByRole('button', { name: /revision from .* by bob collaborator/i });
      fireEvent.click(rev1Card);
      expect(onSelectRevision).toHaveBeenCalledWith('rev-1');
    });
  });

  describe('HistoryRestoreModal', () => {
    it('provides clear single-file vs full-project restore scope options', () => {
      const onConfirmFile = vi.fn();
      const onConfirmProject = vi.fn();
      const onOpenChange = vi.fn();

      render(
        <HistoryRestoreModal
          isOpen={true}
          onOpenChange={onOpenChange}
          activeFileName="main.tex"
          activeVersionNumber={4}
          formattedRevisionDate="6 Oct 2026 at 20:30"
          isRestoring={false}
          onConfirmRestoreFile={onConfirmFile}
          onConfirmRestoreProject={onConfirmProject}
        />,
      );

      // Explanatory dialog title and description
      expect(screen.getByText('Restore version')).toBeInTheDocument();
      expect(screen.getByText('Restore only this file')).toBeInTheDocument();
      expect(screen.getByText('Restore entire project')).toBeInTheDocument();

      // Default scope is file: clicking confirm calls onConfirmFile
      const confirmBtn = screen.getByRole('button', { name: /restore file/i });
      fireEvent.click(confirmBtn);
      expect(onConfirmFile).toHaveBeenCalledTimes(1);

      // Switching scope to project updates button and calls onConfirmProject
      const projectCard = screen.getByText('Restore entire project').closest('button')!;
      fireEvent.click(projectCard);

      const confirmProjectBtn = screen.getByRole('button', { name: /restore project/i });
      fireEvent.click(confirmProjectBtn);
      expect(onConfirmProject).toHaveBeenCalledTimes(1);
    });
  });
});
