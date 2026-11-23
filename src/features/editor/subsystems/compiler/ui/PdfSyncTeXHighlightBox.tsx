/**
 * PdfSyncTeXHighlightBox.tsx
 *
 * Renders forward SyncTeX line highlight bar or inverse double-click radar ripple
 * overlaid inside an OptimizedPDFPage / single-page view.
 */

'use client';

import React from 'react';
import {
  DEFAULT_PDF_PAGE_WIDTH_PT,
  type PdfPageDimensions,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';

export interface SynctexHighlightState {
  page: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  id: number;
  type?: 'forward' | 'backward';
}

export type ClickIndicator = SynctexHighlightState;

export interface PdfSyncTeXHighlightBoxProps {
  indicator: SynctexHighlightState;
  pageWidth: number;
  scale: number;
  pageDimensions?: PdfPageDimensions;
}

export const PdfSyncTeXHighlightBox = React.memo(function PdfSyncTeXHighlightBox({
  indicator,
  pageWidth,
  scale,
  pageDimensions,
}: PdfSyncTeXHighlightBoxProps) {
  const isForward = indicator.type === 'forward' || (indicator.w !== undefined && indicator.h !== undefined);

  if (isForward) {
    const widthPt =
      pageDimensions?.widthPt && pageDimensions.widthPt > 0
        ? pageDimensions.widthPt
        : DEFAULT_PDF_PAGE_WIDTH_PT;
    const effectivePageWidth = pageWidth > 0 ? pageWidth : Math.round(widthPt * (scale > 0 ? scale : 1));
    const left = Math.max(8, indicator.x - 4);
    const width =
      indicator.w !== undefined && indicator.w > 0
        ? Math.max(indicator.w + 8, 48)
        : Math.max(160, Math.min(effectivePageWidth - left - 24, 480));
    const rawH =
      indicator.h !== undefined && indicator.h > 0
        ? indicator.h
        : Math.max(14 * (scale > 0 ? scale : 1), 14);
    const height = Math.max(rawH + 6, 16);
    // In SyncTeX, y is the text baseline measured from the top of the page, while glyphs extend upward by ascent (~0.8 * rawH)
    const top = Math.max(0, indicator.y - rawH * 0.8);

    return (
      <div
        key={indicator.id}
        data-testid="synctex-pdf-highlight-box"
        role="presentation"
        aria-hidden="true"
        className="synctex-pdf-highlight-box pointer-events-none"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <div
          data-testid="synctex-pdf-accent-bar"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-4/5 max-h-5 rounded-full bg-warning shadow-none"
        />
      </div>
    );
  }

  return null;
});
