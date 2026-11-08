import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReaderTopbar } from '@/features/library/ui/reader/ReaderTopbar';
import { useReaderStore } from '@/features/library/core/store/reader.store';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import type { ReaderTab } from '@/features/library/types/reader.types';

describe('ReaderTopbar & Multi-Tab Context Menu Parity (Zotero 7)', () => {
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

  describe('1. useReaderStore.closeOtherTabs Logic', () => {
    it('closes all other tabs and retains the target document tab alongside Library', () => {
      const { closeOtherTabs } = useReaderStore.getState();

      closeOtherTabs('paper-2');

      const { tabs, activeTabId, readingPaperId } = useReaderStore.getState();
      expect(tabs.map((t) => t.id)).toEqual(['library', 'paper-2']);
      expect(activeTabId).toBe('paper-2');
      expect(readingPaperId).toBe('paper-2');
    });

    it('closes all document tabs when keepId is library, returning to clean library state', () => {
      const { closeOtherTabs } = useReaderStore.getState();

      closeOtherTabs('library');

      const { tabs, activeTabId, readingPaperId } = useReaderStore.getState();
      expect(tabs.map((t) => t.id)).toEqual(['library']);
      expect(activeTabId).toBe('library');
      expect(readingPaperId).toBeNull();
    });
  });

  describe('2. ReaderTopbar Right-Click Context Menu UI', () => {
    it('triggers onCloseTab when Close Tab is selected from context menu', () => {
      const onCloseTab = vi.fn();
      const onCloseOtherTabs = vi.fn();
      const onMoveTabToNewWindow = vi.fn();

      const tabs: ReaderTab[] = [
        { id: 'library', title: 'My Library', type: 'library' },
        { id: 'paper-1', title: 'Attention Is All You Need', type: 'paper' },
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
        </TooltipProvider>
      );

      const tabEl = screen.getByText('Attention Is All You Need');
      fireEvent.contextMenu(tabEl);

      const closeTabItem = screen.getByText('Close Tab');
      expect(closeTabItem).toBeInTheDocument();
      fireEvent.click(closeTabItem);

      expect(onCloseTab).toHaveBeenCalledWith('paper-1');
    });

    it('triggers onCloseOtherTabs and onMoveTabToNewWindow from document tab context menu', () => {
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
        </TooltipProvider>
      );

      const tabEl = screen.getByText('Attention Is All You Need');
      fireEvent.contextMenu(tabEl);

      const closeOthersItem = screen.getByText('Close Other Tabs');
      expect(closeOthersItem).toBeInTheDocument();
      fireEvent.click(closeOthersItem);
      expect(onCloseOtherTabs).toHaveBeenCalledWith('paper-1');

      fireEvent.contextMenu(tabEl);
      const moveItem = screen.getByText('Move Tab to New Window');
      expect(moveItem).toBeInTheDocument();
      fireEvent.click(moveItem);
      expect(onMoveTabToNewWindow).toHaveBeenCalledWith('paper-1');
    });

    it('provides Close Other Tabs context menu on the pinned Library tab', () => {
      const onCloseOtherTabs = vi.fn();

      const tabs: ReaderTab[] = [
        { id: 'library', title: 'My Library', type: 'library' },
        { id: 'paper-1', title: 'Attention Is All You Need', type: 'paper' },
      ];

      render(
        <TooltipProvider>
          <ReaderTopbar
            tabs={tabs}
            activeTabId="paper-1"
            onCloseOtherTabs={onCloseOtherTabs}
          />
        </TooltipProvider>
      );

      const libraryTabEl = screen.getByText('My Library');
      fireEvent.contextMenu(libraryTabEl);

      const closeOthersItem = screen.getByText('Close Other Tabs');
      expect(closeOthersItem).toBeInTheDocument();
      fireEvent.click(closeOthersItem);
      expect(onCloseOtherTabs).toHaveBeenCalledWith('library');
    });
  });
});
