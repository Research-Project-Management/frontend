'use client';

/**
 * Toolbar.tsx (Deprecated Monolith Delegator)
 *
 * Refactored: Deconstructed into:
 * - sub-features/compiler/components/CompileButton.tsx
 * - sub-features/pdf-viewer/components/PdfToolbar.tsx
 * - sub-features/pdf-viewer/components/PdfPaginationControls.tsx
 * - sub-features/pdf-viewer/components/PdfZoomControls.tsx
 * - sub-features/pdf-viewer/components/PdfExportDropdown.tsx
 *
 * Re-exports components for complete backward compatibility.
 */

import React from 'react';
import {
  PdfToolbar,
  type PdfToolbarProps,
} from '../../sub-features/pdf-viewer/components/PdfToolbar';
import {
  CompileButton,
  type CompileButtonProps,
} from '../../sub-features/compiler/components/CompileButton';

export type ToolbarProps = PdfToolbarProps;
export { CompileButton, type CompileButtonProps };

export default React.memo(function Toolbar(props: ToolbarProps) {
  return <PdfToolbar {...props} />;
});
