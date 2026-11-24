'use client';

/**
 * CitationPickerModal.tsx
 *
 * Backward-compatible wrapper re-exporting the canonical CitationModal.
 */

import CitationModal, {
  CitationSpecs,
  type CitationModalProps,
  type CitationStyle,
  type CitationPredicate,
} from './CitationModal';

export {
  CitationSpecs,
  type CitationStyle,
  type CitationPredicate,
  type CitationModalProps as CitationPickerModalProps,
};

export const CitationPickerModal = CitationModal;
export default CitationModal;
