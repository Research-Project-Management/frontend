'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import {
  ACTIVE_MODAL_REGISTRY,
  type LibraryModalPayload,
} from './modal-registry';

const ProcessModal = dynamic(() => import('./ProcessModal'), { ssr: false });

/**
 * LibraryModals Container (Lazy Host + Strategy Registry Pattern)
 * Mounts once at the workspace root and delegates modal-specific TanStack Query / Mutation hooks
 * to dedicated lazy host containers in `ACTIVE_MODAL_REGISTRY` only when `activeModal` is non-null.
 */
export function LibraryModals({ scopeId }: { scopeId?: string }) {
  const activeModal = useLibraryUIStore((s) => s.activeModal);
  const modalProps = useLibraryUIStore((s) => s.modalProps);
  const closeModal = useLibraryUIStore((s) => s.closeModal);
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const effectiveScope =
    scopeId || (activeScope.type === 'project' ? activeScope.id : 'user');

  // Standalone Process / Metadata Retrieval Modal State & Handlers
  const processModalState = useProcessModalStore((s) => s.state);
  const closeProcessModal = useProcessModalStore((s) => s.closeModal);
  const minimizeProcessModal = useProcessModalStore((s) => s.minimizeModal);
  const restoreProcessModal = useProcessModalStore((s) => s.restoreModal);
  const abortProcessModal = useProcessModalStore((s) => s.abortBatch);

  const ActiveModalHost = activeModal
    ? ACTIVE_MODAL_REGISTRY[activeModal]
    : undefined;

  return (
    <>
      {activeModal && ActiveModalHost && (
        <ActiveModalHost
          activeModal={activeModal}
          payload={modalProps as LibraryModalPayload}
          effectiveScope={effectiveScope}
          closeModal={closeModal}
        />
      )}

      {(processModalState.isOpen || processModalState.isMinimized) && (
        <ProcessModal
          state={processModalState}
          onClose={closeProcessModal}
          onMinimize={minimizeProcessModal}
          onRestore={restoreProcessModal}
          onCancel={abortProcessModal}
        />
      )}
    </>
  );
}

export default LibraryModals;
