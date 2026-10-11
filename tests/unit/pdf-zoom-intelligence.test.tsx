import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { useViewerStore } from '@/features/editor/store/viewer.store';
import { usePdfZoom } from '@/features/editor/ui/features/preview/hooks/use-pdf-zoom';
import { PdfZoomControls } from '@/features/editor/ui/features/preview/PdfZoomControls';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

describe('Phase 10: PDF Zoom Presets & Auto-Fit Resizing Intelligence (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useViewerStore.getState().resetViewerState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('1. Viewer Store Zoom & Fit Modes Governance', () => {
    it('manages scale clamping within [0.25, 4.0] and autoFit transitions', () => {
      const store = useViewerStore.getState();

      // Setting scale directly disables autoFit by default
      store.setScale(1.5);
      expect(useViewerStore.getState().scale).toBe(1.5);
      expect(useViewerStore.getState().autoFit).toBe(false);

      // Clamp upper bound to 4.0
      store.setScale(10.0);
      expect(useViewerStore.getState().scale).toBe(4.0);

      // Clamp lower bound to 0.25
      store.setScale(0.1);
      expect(useViewerStore.getState().scale).toBe(0.25);
    });

    it('performs incremental zoomIn and zoomOut with 0.15 step and precision formatting', () => {
      const store = useViewerStore.getState();
      store.setScale(1.0);

      store.zoomIn();
      expect(useViewerStore.getState().scale).toBe(1.15);
      expect(useViewerStore.getState().autoFit).toBe(false);

      store.zoomOut();
      expect(useViewerStore.getState().scale).toBe(1.0);
    });

    it('manages fitMode transitions and resets zoom properly', () => {
      const store = useViewerStore.getState();

      store.setFitMode('height');
      expect(useViewerStore.getState().fitMode).toBe('height');
      expect(useViewerStore.getState().autoFit).toBe(true);

      store.setFitMode('auto');
      expect(useViewerStore.getState().fitMode).toBe('auto');
      expect(useViewerStore.getState().autoFit).toBe(true);

      store.setScale(2.0);
      expect(useViewerStore.getState().autoFit).toBe(false);

      store.resetZoom();
      expect(useViewerStore.getState().scale).toBe(1.0);
      expect(useViewerStore.getState().autoFit).toBe(true);
      expect(useViewerStore.getState().fitMode).toBe('width');
    });
  });

  describe('2. usePdfZoom Hook Proportional Intelligence', () => {
    it('computes fittedScale for Fit Width, Fit Height, and Auto modes', () => {
      const mockContainer = document.createElement('div');
      const containerRef = { current: mockContainer };

      const { result } = renderHook(() =>
        usePdfZoom({
          containerRef,
          pdfSpreadView: false,
        }),
      );

      // Default 600px width / 595pt -> ~1.008 scale
      expect(result.current.fittedScale).toBeCloseTo(600 / 595, 2);

      // Switch to Fit Page (Height mode)
      act(() => {
        result.current.handleSetFitMode('height');
      });
      // 800px height - 48px padding = 752px / 842pt -> ~0.893 scale
      expect(result.current.fittedScale).toBeCloseTo((800 - 48) / 842, 2);

      // Switch to Auto mode (capped at 1.25)
      act(() => {
        result.current.handleSetFitMode('auto');
      });
      expect(result.current.fittedScale).toBeCloseTo(Math.min(600 / 595, 1.25), 2);
    });

    it('listens to editorCommandBus viewer:fit-width and viewer:fit-height events', () => {
      const mockContainer = document.createElement('div');
      const containerRef = { current: mockContainer };

      renderHook(() =>
        usePdfZoom({
          containerRef,
        }),
      );

      act(() => {
        editorCommandBus.dispatch({ type: 'viewer:fit-height' });
      });
      expect(useViewerStore.getState().fitMode).toBe('height');
      expect(useViewerStore.getState().autoFit).toBe(true);

      act(() => {
        editorCommandBus.dispatch({ type: 'viewer:fit-width' });
      });
      expect(useViewerStore.getState().fitMode).toBe('width');
      expect(useViewerStore.getState().autoFit).toBe(true);
    });

    it('supports Ctrl + Mouse Wheel zooming without triggering default page zoom', () => {
      const mockContainer = document.createElement('div');
      const containerRef = { current: mockContainer };

      renderHook(() =>
        usePdfZoom({
          containerRef,
        }),
      );

      useViewerStore.getState().setScale(1.0);

      // Dispatch Ctrl + Wheel down (zoom out)
      const wheelDownEvent = new WheelEvent('wheel', {
        deltaY: 100,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      mockContainer.dispatchEvent(wheelDownEvent);

      expect(useViewerStore.getState().scale).toBe(0.85);

      // Dispatch Ctrl + Wheel up (zoom in)
      const wheelUpEvent = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      mockContainer.dispatchEvent(wheelUpEvent);

      expect(useViewerStore.getState().scale).toBe(1.0);
    });
  });

  describe('3. PdfZoomControls Component UI', () => {
    it('displays appropriate fit label and triggers zoom changes', () => {
      const onSetScale = vi.fn();
      const onSetFitMode = vi.fn();
      const onToggleAutoFit = vi.fn();
      const onZoomIn = vi.fn();
      const onZoomOut = vi.fn();

      const { rerender } = render(
        <TooltipProvider>
          <PdfZoomControls
            scale={1.0}
            autoFit={true}
            fitMode="width"
            onToggleAutoFit={onToggleAutoFit}
            onSetFitMode={onSetFitMode}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onSetScale={onSetScale}
          />
        </TooltipProvider>,
      );

      expect(screen.getByRole('button', { name: /select zoom level/i })).toHaveTextContent('Fit Width');

      // Rerender with fitMode="height"
      rerender(
        <TooltipProvider>
          <PdfZoomControls
            scale={0.85}
            autoFit={true}
            fitMode="height"
            onToggleAutoFit={onToggleAutoFit}
            onSetFitMode={onSetFitMode}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onSetScale={onSetScale}
          />
        </TooltipProvider>,
      );
      expect(screen.getByRole('button', { name: /select zoom level/i })).toHaveTextContent('Fit Page');

      // Rerender with autoFit=false, scale=1.5
      rerender(
        <TooltipProvider>
          <PdfZoomControls
            scale={1.5}
            autoFit={false}
            fitMode="width"
            onToggleAutoFit={onToggleAutoFit}
            onSetFitMode={onSetFitMode}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onSetScale={onSetScale}
          />
        </TooltipProvider>,
      );
      expect(screen.getByRole('button', { name: /select zoom level/i })).toHaveTextContent('150%');

      // Click Zoom In
      const zoomInBtn = screen.getByRole('button', { name: /zoom in/i });
      fireEvent.click(zoomInBtn);
      expect(onZoomIn).toHaveBeenCalledTimes(1);

      // Click Zoom Out
      const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i });
      fireEvent.click(zoomOutBtn);
      expect(onZoomOut).toHaveBeenCalledTimes(1);
    });
  });
});
