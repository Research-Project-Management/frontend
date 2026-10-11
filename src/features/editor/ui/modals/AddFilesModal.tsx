'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  X,
  FileText,
  Upload,
  Folder,
  Globe,
  BookOpen,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { useFileActions } from '@/features/editor/ui/hooks/use-file-actions';
import { useEditorStorage } from '@/features/editor/ui/hooks/use-storage';

import type {
  AddFilesTab,
  AddFilesModalProps,
  AddFilesTabItem,
} from './add-files/add-files.types';
import { AddFilesSidebar } from './add-files/AddFilesSidebar';
import { NewFileTabPane } from './add-files/NewFileTabPane';
import { UploadTabPane } from './add-files/UploadTabPane';
import { ProjectTabPane } from './add-files/ProjectTabPane';
import { UrlTabPane } from './add-files/UrlTabPane';
import { LibraryTabPane } from './add-files/LibraryTabPane';

export type { AddFilesTab, AddFilesModalProps };

const TABS: AddFilesTabItem[] = [
  { id: 'new-file', label: 'New file', icon: FileText },
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'project', label: 'From another project', icon: Folder },
  { id: 'url', label: 'From external URL', icon: Globe },
  { id: 'library', label: 'From library', icon: BookOpen },
];

export default function AddFilesModal({
  open,
  onOpenChange,
  defaultTab = 'new-file',
  parentPageId,
  projectId = '',
  onPickItems,
}: AddFilesModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const setSearchParams = useCallback(
    (newParams: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([k, v]) => {
        if (!v) params.delete(k);
        else params.set(k, v);
      });
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const [activeTab, setActiveTab] = useState<AddFilesTab>(defaultTab);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  const { createFile } = useFileActions();
  const { uploadFile } = useEditorStorage(parentPageId, undefined);
  const effectiveProjectId = projectId || parentPageId || '';

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-200 rounded-md text-foreground select-none">
        {/* Header with Title & Accessible Description */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-border">
          <div>
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Add files
            </DialogTitle>
            <DialogDescription className="text-12 text-muted-foreground mt-0.5">
              Create a new file, upload from your device, or import from an external source.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body: Left Tab Sidebar + Right Form Panel */}
        <div className="flex flex-col sm:flex-row min-h-[380px]">
          {/* Navigation Tabs Sidebar */}
          <AddFilesSidebar
            tabs={TABS}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
          />

          {/* Right Form & Content Pane */}
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

            {activeTab === 'project' && (
              <ProjectTabPane
                projectId={projectId}
                parentPageId={parentPageId}
                createFile={createFile}
                setSearchParams={setSearchParams}
                onClose={handleClose}
              />
            )}

            {activeTab === 'url' && (
              <UrlTabPane
                parentPageId={parentPageId}
                effectiveProjectId={effectiveProjectId}
                createFile={createFile}
                uploadFile={uploadFile}
                setSearchParams={setSearchParams}
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
