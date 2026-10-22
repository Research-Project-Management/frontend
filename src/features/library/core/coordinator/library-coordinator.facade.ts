'use client';

import { useMemo, useCallback } from 'react';
import {
  useLibraryUIStore,
  useSelectionCount,
  useHasSelection,
  type LibraryModalType,
} from '@/features/library/core/store/library-ui.store';
import { useLibraryBatchCoordinator } from '@/features/library/core/coordinator/batch-action.coordinator';
import { useQuickCopyCoordinator } from '@/features/library/core/coordinator/quick-copy.coordinator';
import { useLibraryNavigation } from '@/features/library/core/coordinator/navigation.coordinator';
import { useLibraryCommandManager } from '@/features/library/core/manager/library-command.manager';
import type { Item } from '@/features/library/domain/types/library.types';

export interface UseLibraryCoordinatorOptions {
  items?: Item[];
  scopeId?: string;
  collectionId?: string;
  view?: string;
  isTrash?: boolean;
  canEdit?: boolean;
}

/**
 * useLibraryCoordinator (Unified Facade)
 *
 * Consolidates fragmented sub-coordinators into a single, cohesive public interface.
 * Reduces prop drilling and prevents components from importing 4-5 different coordinator hooks.
 *
 * Responsibilities:
 * - Selection Engine & Item Counts
 * - Batch Actions (Trash, Restore, Detach, Export, Merge)
 * - Navigation & View/Search state
 * - Modal Dialog Bus triggers
 * - Quick Citation Copying (Standard keyboard shortcuts)
 */
export function useLibraryCoordinator(options: UseLibraryCoordinatorOptions = {}) {
  const {
    items = [],
    scopeId,
    collectionId,
    view,
    isTrash = false,
    canEdit = true,
  } = options;

  // 1. Core Zustand UI Store Access
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const activeModal = useLibraryUIStore((s) => s.activeModal);
  const isInspectorOpen = useLibraryUIStore((s) => s.isInspectorOpen);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const setIsInspectorOpen = useLibraryUIStore((s) => s.setIsInspectorOpen);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const closeModal = useLibraryUIStore((s) => s.closeModal);

  // 2. Granular selectors for high-performance renders
  const selectedCount = useSelectionCount();
  const hasSelection = useHasSelection();

  // 3. Delegate to Specialized Sub-Coordinators
  const batchCoordinator = useLibraryBatchCoordinator({
    items,
    scopeId,
    collectionId,
    view,
    isTrash,
    canEdit,
  });

  const quickCopyCoordinator = useQuickCopyCoordinator({
    scopeId,
    items,
  });

  const navigation = useLibraryNavigation();
  const commandManager = useLibraryCommandManager();

  // 4. Modal Convenience Helpers
  const triggerModal = useCallback(
    (modalType: LibraryModalType, props?: Record<string, unknown>) => {
      openModal(modalType, props);
    },
    [openModal],
  );

  return useMemo(
    () => ({
      // Scope Context
      scope: {
        active: activeScope,
        scopeId,
        collectionId,
        view,
        isTrash,
        canEdit,
      },

      // Selection State & Mutators
      selection: {
        selectedIds: batchCoordinator.selectedIds,
        selectedCount,
        hasSelection,
        selectedItems: batchCoordinator.selectedItems,
        isAllSelected: batchCoordinator.isAllSelected,
        isAllProcessingSelected: batchCoordinator.isAllProcessingSelected,
        retractedSelected: batchCoordinator.retractedSelected,
        activeItemId,
        setActiveItem,
        toggleSelect: batchCoordinator.toggleSelect,
        selectAll: batchCoordinator.selectAll,
        selectOnly: batchCoordinator.selectOnly,
        rangeSelect: batchCoordinator.rangeSelect,
        clearSelection: batchCoordinator.clearSelection,
      },

      // Inspector & Layout
      layout: {
        isInspectorOpen,
        setIsInspectorOpen,
        toggleInspector: () => setIsInspectorOpen(!isInspectorOpen),
      },

      // Batch & Document Actions
      actions: {
        batchMove: batchCoordinator.batchMove,
        batchDelete: batchCoordinator.batchDelete,
        batchRestore: batchCoordinator.batchRestore,
        batchDetach: batchCoordinator.batchDetach,
        batchMerge: batchCoordinator.batchMerge,
        exportAllBibtex: batchCoordinator.exportAllBibtex,
        downloadBibFile: batchCoordinator.downloadBibFile,
        copyMultiCite: batchCoordinator.copyMultiCite,
        copyInTextCite: batchCoordinator.copyInTextCite,
        copyBibliography: quickCopyCoordinator.copyBibliography,
        copyInTextCitation: quickCopyCoordinator.copyInTextCitation,
      },

      // Navigation
      navigation: {
        ...navigation,
      },

      // Command & Undo/Redo Flow Manager
      commands: {
        executeCommand: commandManager.executeCommand,
        undo: commandManager.undo,
        redo: commandManager.redo,
        clearHistory: commandManager.clearHistory,
        canUndo: commandManager.canUndo,
        canRedo: commandManager.canRedo,
        isExecuting: commandManager.isExecuting,
        isUndoing: commandManager.isUndoing,
      },

      // Modals
      modals: {
        activeModal,
        open: triggerModal,
        close: closeModal,
        openUploadPdf: () => triggerModal('UPLOAD_PDF', { collectionId }),
        openAddByIdentifier: () => triggerModal('ADD_BY_IDENTIFIER', { collectionId }),
        openExportLibrary: () => triggerModal('EXPORT_LIBRARY', { collectionId }),
      },

      // Raw Sub-Coordinators (for components needing exact sub-coordinator instance)
      batchCoordinator,
    }),
    [
      activeScope,
      scopeId,
      collectionId,
      view,
      isTrash,
      canEdit,
      batchCoordinator,
      selectedCount,
      hasSelection,
      activeItemId,
      setActiveItem,
      isInspectorOpen,
      setIsInspectorOpen,
      quickCopyCoordinator,
      navigation,
      commandManager,
      activeModal,
      triggerModal,
      closeModal,
    ],
  );
}
