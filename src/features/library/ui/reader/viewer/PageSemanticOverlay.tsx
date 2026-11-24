'use client';

import React from 'react';
import {
  normalizePageRotation,
  rotateRectFromCanonical,
} from '@/features/library/domain/reader/annotation-geometry';
import type { SemanticPageOverlay } from '@/features/library/domain/reader/semantic-overlays';

interface PageSemanticOverlayProps {
  overlays?: SemanticPageOverlay[];
  hoveredOverlayId?: string | null;
  rotation: number;
  themeMode?: string;
}

/**
 * Renders pre-computed citation and internal-link hover highlights on a PDF page.
 * Shows only on hover (`#46b1ff`, opacity 0.5 dark / 0.1 light).
 */
export const PageSemanticOverlay = React.memo(function PageSemanticOverlay({
  overlays,
  hoveredOverlayId,
  rotation,
  themeMode,
}: PageSemanticOverlayProps) {
  if (!overlays || overlays.length === 0 || !hoveredOverlayId) return null;

  const normRot = normalizePageRotation(rotation);
  const isDark = themeMode === 'dark';
  const mixBlendMode = isDark ? 'lighten' : 'multiply';

  return (
    <div
      aria-hidden="true"
      data-semantic-overlay-layer="true"
      className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
    >
      {overlays.map((overlay) => {
        if (overlay.id !== hoveredOverlayId) return null;

        return overlay.rects.map((rect, rectIdx) => {
          const rotated = rotateRectFromCanonical(
            { x1: rect.x1, y1: rect.y1, x2: rect.x2, y2: rect.y2 },
            normRot,
          );
          const widthPct = (rotated.x2 - rotated.x1) * 100;
          const heightPct = (rotated.y2 - rotated.y1) * 100;
          if (widthPct <= 0 || heightPct <= 0) return null;

          return (
            <div
              key={`${overlay.id}-${rectIdx}`}
              data-semantic-hover-id={overlay.id}
              data-semantic-overlay-source={overlay.source}
              style={{
                position: 'absolute',
                left: `${rotated.x1 * 100}%`,
                top: `${rotated.y1 * 100}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                backgroundColor: '#46b1ff',
                opacity: isDark ? 0.5 : 0.1,
                mixBlendMode,
              }}
            />
          );
        });
      })}
    </div>
  );
});
