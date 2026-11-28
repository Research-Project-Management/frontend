import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReaderToolbar } from '@/features/library/ui/reader/ReaderToolbar';
import { LazyThumbnailPage } from '@/features/library/ui/reader/ReaderThumbnailsPanel';
import { ReaderTopbar } from '@/features/library/ui/reader/ReaderTopbar';
import { ANNOTATION_PALETTE_COLORS } from '@/features/library/domain/reader/reader';
import { useReaderStore } from '@/features/library/core/store/reader.store';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import type { ReaderTab } from '@/features/library/types/reader.types';

describe('Reader Chrome Controls (Toolbar, Thumbnails & Multi-Tab Topbar)', () => {
  beforeEach(() => {
    useReaderStore.setState({
      tabs: [
        { id: 'library', title: 'My Library', type: 'library' },
        { id: 'paper-1', title: 'Attention Is All You Need', type: 'paper' },
        { id: 'paper-2', title: 'BERT Pre-training', type: 'paper' },
        { id: 'paper-3', title: 'GPT-3 Language Models', type: 'paper' },
      ],
      activeTabId: 'paper-1',
      readingPaperId: 'paper-1',
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Annotation Palette & ReaderToolbar', () => {
    it('matches the 8-color Zotero annotation palette and renders all 7 toolbar tools + lock', () => {
      const expectedColors = [
        { id: 'yellow', hex: '#ffd400' },
        { id: 'red', hex: '#ff6666' },
        { id: 'green', hex: '#5fb236' },
        { id: 'blue', hex: '#2ea8e5' },
        { id: 'purple', hex: '#a28ae5' },
        { id: 'magenta', hex: '#e56eee' },
        { id: 'orange', hex: '#f19837' },
        { id: 'gray', hex: '#aaaaaa' },
      ];

      expect(ANNOTATION_PALETTE_COLORS).toHaveLength(8);
      for (const expected of expectedColors) {
        const found = ANNOTATION_PALETTE_COLORS.find((c) => c.id === expected.id);
        expect(found?.hex.toLowerCase()).toBe(expected.hex);
      }

      const onSelectTool = vi.fn();
      const onToggleToolLocked = vi.fn();

      render(
        <TooltipProvider>
          <ReaderToolbar
            isSidebarOpen={true}
            onToggleSidebar={vi.fn()}
            visiblePage={1}
            numPages={10}
            onNavigateToPage={vi.fn()}
            activeTool="highlight"
            onSelectTool={onSelectTool}
            activeColor="#ffd400"
            isToolLocked={false}
            onToggleToolLocked={onToggleToolLocked}
            zoom={1}
            onZoomIn={vi.fn()}
            onZoomOut={vi.fn()}
            isInspectorOpen={false}
            onToggleInspector={vi.fn()}
          />
        </TooltipProvider>,
      );

      for (const label of [
        'Highlight text',
        'Underline text',
        'Add note',
        'Add text',
        'Select area / image',
        'Draw / Ink annotation',
        'Erase annotation',
      ]) {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      }

      fireEvent.click(screen.getByLabelText('Underline text'));
      expect(onSelectTool).toHaveBeenCalledWith('underline');

      fireEvent.click(screen.getByLabelText('Lock tool'));
      expect(onToggleToolLocked).toHaveBeenCalledTimes(1);
    });
  });

  describe('ReaderThumbnailsPanel Context Menu', () => {
    it('exposes Rotate Page Right and Rotate Page Left actions for a thumbnail page', () => {
      const onRotatePageRight = vi.fn();
      const onRotatePageLeft = vi.fn();

      render(
        <TooltipProvider>
          <LazyThumbnailPage
            pageNum={3}
            isCurrent={false}
            showPdfCanvas={false}
            onJumpToPage={vi.fn()}
            onRotatePageRight={onRotatePageRight}
            onRotatePageLeft={onRotatePageLeft}
          />
        </TooltipProvider>,
      );

      const pageCard = screen.getByText('Page 3');
      fireEvent.contextMenu(pageCard);

      fireEvent.click(screen.getByText('Rotate Page Right'));
      expect(onRotatePageRight).toHaveBeenCalledWith(3);

      fireEvent.contextMenu(pageCard);
      fireEvent.click(screen.getByText('Rotate Page Left'));
      expect(onRotatePageLeft).toHaveBeenCalledWith(3);
    });
  });

  describe('ReaderTopbar & useReaderStore.closeOtherTabs', () => {
    it('closes all other tabs while preserving Library anchor and target tab', () => {
      useReaderStore.getState().closeOtherTabs('paper-2');
      expect(useReaderStore.getState().tabs.map((t) => t.id)).toEqual(['library', 'paper-2']);
      expect(useReaderStore.getState().activeTabId).toBe('paper-2');
      expect(useReaderStore.getState().readingPaperId).toBe('paper-2');

      useReaderStore.getState().closeOtherTabs('library');
      expect(useReaderStore.getState().tabs.map((t) => t.id)).toEqual(['library']);
      expect(useReaderStore.getState().activeTabId).toBe('library');
      expect(useReaderStore.getState().readingPaperId).toBeNull();
    });

    it('dispatches Close Tab, Close Other Tabs, and Move Tab to New Window from tab context menus', () => {
      const onCloseTab = vi.fn();
      const onCloseOtherTabs = vi.fn();
      const onMoveTabToNewWindow = vi.fn();

      const tabs: ReaderTab[] = [
        { id: 'library', title: 'My Library', type: 'library' },
        { id: 'paper-1', title: 'Attention Is All You Need', type: 'paper' },
        { id: 'paper-2', title: 'BERT Pre-training', type: 'paper' },
      ];

      render(
        <TooltipProvider>
          <ReaderTopbar
            tabs={tabs}
            activeTabId="paper-1"
            onCloseTab={onCloseTab}
            onCloseOtherTabs={onCloseOtherTabs}
            onMoveTabToNewWindow={onMoveTabToNewWindow}
          />
        </TooltipProvider>,
      );

      const paperTab = screen.getByText('Attention Is All You Need');
      fireEvent.contextMenu(paperTab);
      fireEvent.click(screen.getByText('Close Tab'));
      expect(onCloseTab).toHaveBeenCalledWith('paper-1');

      fireEvent.contextMenu(paperTab);
      fireEvent.click(screen.getByText('Close Other Tabs'));
      expect(onCloseOtherTabs).toHaveBeenCalledWith('paper-1');

      fireEvent.contextMenu(paperTab);
      fireEvent.click(screen.getByText('Move Tab to New Window'));
      expect(onMoveTabToNewWindow).toHaveBeenCalledWith('paper-1');

      const libraryTab = screen.getByText('My Library');
      fireEvent.contextMenu(libraryTab);
      fireEvent.click(screen.getByText('Close Other Tabs'));
      expect(onCloseOtherTabs).toHaveBeenCalledWith('library');
    });
  });
});
