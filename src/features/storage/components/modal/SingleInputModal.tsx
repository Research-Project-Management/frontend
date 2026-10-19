'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useCreateFolder, useRenameItem } from '@/features/storage/hooks/use-storage';
import { useStorageUIStore } from '@/features/storage/store/storage-ui.store';

export interface SingleInputModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder?: string;
  submitLabel: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  errorMessage?: string;
  inputId?: string;
  testId?: string;
}

export function SingleInputModal({
  open,
  onOpenChange,
  title,
  placeholder,
  submitLabel,
  value,
  onChange,
  onSubmit,
  isLoading = false,
  errorMessage,
  inputId,
  testId,
}: SingleInputModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-md bg-popover"
      >
        <form onSubmit={onSubmit}>
          <DialogHeader className="pr-8">
            <DialogTitle className="text-foreground">
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                id={inputId}
                data-testid={testId}
                placeholder={placeholder}
                disabled={isLoading}
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
              />
              {errorMessage && (
                <p className="text-xs text-destructive">{errorMessage}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="text-foreground hover:bg-muted cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!value?.trim() || isLoading}
              className="cursor-pointer"
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CreateFolderModalProps = {
  projectId?: string;
  parentId?: string | null;
};

export function CreateFolderModal({ projectId, parentId }: CreateFolderModalProps) {
  const isOpen = useStorageUIStore((s) => s.isCreateFolderOpen);
  const close = useStorageUIStore((s) => s.closeCreateFolderModal);
  const createFolderMutation = useCreateFolder();

  const [folderName, setFolderName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setErrorMessage(undefined);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) {
      setErrorMessage('Folder name is required');
      return;
    }
    if (trimmed.length > 100) {
      setErrorMessage('Folder name cannot exceed 100 characters');
      return;
    }

    try {
      await createFolderMutation.mutateAsync({
        name: trimmed,
        projectId,
        parentId: parentId || null,
      });
      toast.success(`Created folder "${trimmed}"`);
      close();
      setFolderName('');
    } catch (error) {
      toast.error('Failed to create folder');
      console.error(error);
    }
  };

  return (
    <SingleInputModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Create New Folder"
      placeholder="Folder name"
      submitLabel="Create"
      value={folderName}
      onChange={(val) => {
        setFolderName(val);
        if (errorMessage) setErrorMessage(undefined);
      }}
      onSubmit={handleSubmit}
      isLoading={createFolderMutation.isPending}
      errorMessage={errorMessage}
      inputId="folder-name"
    />
  );
}

export function RenameModal() {
  const renamingItem = useStorageUIStore((s) => s.renamingItem);
  const close = useStorageUIStore((s) => s.closeRenameModal);
  const isOpen = Boolean(renamingItem);
  const { mutateAsync: renameFile, isPending } = useRenameItem();

  const [newName, setNewName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (renamingItem) {
      setNewName(renamingItem.filename || '');
      setErrorMessage(undefined);
    }
  }, [renamingItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      setErrorMessage('Name is required');
      return;
    }
    if (trimmed.length > 255) {
      setErrorMessage('Name cannot exceed 255 characters');
      return;
    }

    try {
      await renameFile({ itemId: renamingItem.id, name: trimmed });
      toast.success('Renamed successfully');
      close();
    } catch (error) {
      toast.error('Failed to rename');
      console.error(error);
    }
  };

  return (
    <SingleInputModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Rename"
      placeholder="New name"
      submitLabel="Save"
      value={newName}
      onChange={(val) => {
        setNewName(val);
        if (errorMessage) setErrorMessage(undefined);
      }}
      onSubmit={handleSubmit}
      isLoading={isPending}
      errorMessage={errorMessage}
      inputId="name"
      testId="rename-input"
    />
  );
}

