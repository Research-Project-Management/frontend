'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  Upload,
  Link2,
  BookOpen,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { usePageActions } from '@/features/editor/core/queries/usePageActions';
import { usePageStore, syncShallowUrlParams } from '@/features/editor/core';

import type {
  AddFilesTab,
  AddFilesModalProps,
  AddFilesTabItem,
} from './add-files.types';
import { AddFilesSidebar } from './AddFilesSidebar';
import { NewFileTabPane } from './NewFileTabPane';
import { UploadTabPane } from './UploadTabPane';
import { UrlTabPane } from './UrlTabPane';
import { LibraryTabPane } from './LibraryTabPane';

export type { AddFilesTab, AddFilesModalProps };

const TABS: AddFilesTabItem[] = [
  { id: 'new-file', label: 'New file', icon: FileText },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'url', label: 'From external URL', icon: Link2 },
  { id: 'library', label: 'From library', icon: BookOpen },
];

export default function AddFilesModal({
  open,
  onOpenChange,
  defaultTab = 'new-file',
  parentPageId: propParentPageId,
  projectId,
  onPickItems,
}: AddFilesModalProps) {
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const parentPageId = propParentPageId || storeParentPageId || currentPageId || null;

  const setSearchParams = useCallback(
    (newParams: Record<string, string>) => {
      syncShallowUrlParams(newParams);
    },
    [],
  );

  const [activeTab, setActiveTab] = useState<AddFilesTab>(defaultTab);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  const { createFile } = usePageActions();

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:w-full max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-200 rounded-md text-foreground select-none"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-2 shrink-0">
          <DialogTitle className="text-sm font-semibold text-foreground tracking-tight">
            Add files
          </DialogTitle>
          <button
            type="button"
            onClick={handleClose}
            className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1.5 after:content-['']"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body: Left Tab Sidebar + Right Form Panel */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-y-auto sm:overflow-hidden">
          <AddFilesSidebar
            tabs={TABS}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />

          <div
            id={`add-files-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`add-files-tab-${activeTab}`}
            tabIndex={0}
            className="flex-1 p-4 sm:p-6 flex flex-col justify-between outline-none"
          >
            {activeTab === 'new-file' && (
              <NewFileTabPane
                parentPageId={parentPageId}
                createFile={createFile}
                setSearchParams={setSearchParams}
                onClose={handleClose}
              />
            )}

            {activeTab === 'upload' && (
              <UploadTabPane
                onPickItems={onPickItems}
                onClose={handleClose}
              />
            )}

            {activeTab === 'url' && (
              <UrlTabPane
                parentPageId={parentPageId}
                projectId={projectId}
                onClose={handleClose}
              />
            )}

            {activeTab === 'library' && (
              <LibraryTabPane
                parentPageId={parentPageId}
                createFile={createFile}
                setSearchParams={setSearchParams}
                onClose={handleClose}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
