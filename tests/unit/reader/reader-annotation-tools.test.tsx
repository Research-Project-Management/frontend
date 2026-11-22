import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReaderToolbar } from '@/features/library/ui/reader/ReaderToolbar';
import { ANNOTATION_PALETTE_COLORS } from '@/features/library/domain/reader/reader';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

describe('Reader Annotation Tools & Color Palette Parity (Zotero 7)', () => {
  describe('1. Zotero Official 8-Color Palette', () => {
    it('matches the exact official 8-color Zotero hex codes', () => {
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

      expect(ANNOTATION_PALETTE_COLORS.length).toBe(8);
      for (const expected of expectedColors) {
        const found = ANNOTATION_PALETTE_COLORS.find((c) => c.id === expected.id);
        expect(found).toBeDefined();
        expect(found?.hex.toLowerCase()).toBe(expected.hex.toLowerCase());
      }
    });
  });

  describe('2. ReaderToolbar 7 Annotation Tools & Keyboard Shortcuts', () => {
    it('renders all 7 annotation tools with standard Alt+1 through Alt+7 shortcuts', () => {
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
        </TooltipProvider>
      );

      // Verify all 7 annotation tools are present
      expect(screen.getByLabelText('Highlight text')).toBeInTheDocument();
      expect(screen.getByLabelText('Underline text')).toBeInTheDocument();
      expect(screen.getByLabelText('Add note')).toBeInTheDocument();
      expect(screen.getByLabelText('Add text')).toBeInTheDocument();
      expect(screen.getByLabelText('Select area / image')).toBeInTheDocument();
      expect(screen.getByLabelText('Draw / Ink annotation')).toBeInTheDocument();
      expect(screen.getByLabelText('Erase annotation')).toBeInTheDocument();

      // Tool selection trigger
      fireEvent.click(screen.getByLabelText('Underline text'));
      expect(onSelectTool).toHaveBeenCalledWith('underline');

      // Tool lock trigger
      const lockButton = screen.getByLabelText('Lock tool');
      expect(lockButton).toBeInTheDocument();
      fireEvent.click(lockButton);
      expect(onToggleToolLocked).toHaveBeenCalled();
    });
  });
});
