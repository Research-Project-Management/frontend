'use client';

/**
 * Format.tsx (Deprecated Monolith Delegator)
 *
 * Refactored: Extracted to sub-features/code-editor/components/FormatToolbar.tsx.
 * Re-exports for complete backward compatibility.
 */

import React from 'react';
import { FormatToolbar } from '../../sub-features/code-editor/components/FormatToolbar';

export default React.memo(function Format() {
  return <FormatToolbar />;
});
