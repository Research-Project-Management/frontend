'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { newFileModalSchema, type NewFileModalFormValues } from '@/features/editor/domain/types/forms.types';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';

export interface NewFileTabPaneProps {
  parentPageId: string | null;
  createFile: {
    mutate: (
      variables: { parentPageId: string; title: string; content?: string },
      options?: {
        onSuccess?: (created: { id: string }) => void;
        onSettled?: () => void;
      },
    ) => void;
  };
  setSearchParams: (params: Record<string, string>) => void;
  onClose: () => void;
}

export function NewFileTabPane({
  parentPageId,
  createFile,
  setSearchParams,
  onClose,
}: NewFileTabPaneProps) {
  const [isCreatingNewFile, setIsCreatingNewFile] = useState(false);
  const newFileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register: registerNewFile,
    handleSubmit: handleSubmitNewFile,
    reset: resetNewFile,
    formState: { errors: newFileErrors },
  } = useForm<NewFileModalFormValues>({
    resolver: zodResolver(newFileModalSchema),
    defaultValues: { fileName: '' },
  });

  useEffect(() => {
    const timer = setTimeout(() => newFileInputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateNewFile = (data: NewFileModalFormValues) => {
    const raw = data.fileName.trim();
    if (!raw || !parentPageId) return;

    const title = /\.[a-z0-9]+$/i.test(raw) ? raw : `${raw}.tex`;
    setIsCreatingNewFile(true);
    createFile.mutate(
      {
        parentPageId,
        title,
        content: '',
      },
      {
        onSuccess: (created: { id: string }) => {
          navigationCoordinator.openDocument({
            fileId: created.id,
            title,
            content: '',
          });
          setSearchParams({ file: created.id });
          resetNewFile();
          onClose();
        },
        onSettled: () => {
          setIsCreatingNewFile(false);
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmitNewFile(handleCreateNewFile)}
      className="flex-1 flex flex-col justify-between"
    >
      <div className="space-y-4">
        <div className="space-y-1.5 pt-1">
          <label className="text-12 font-medium text-foreground">
            File name
          </label>
          <Input
            {...registerNewFile('fileName')}
            ref={(e) => {
              registerNewFile('fileName').ref(e);
              newFileInputRef.current = e;
            }}
            aria-label="File name"
            placeholder="e.g. section1.tex, appendix.tex"
            className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
            autoFocus
          />
          {newFileErrors.fileName && (
            <p className="text-11 text-destructive">{newFileErrors.fileName.message}</p>
          )}
          <p className="text-11 text-muted-foreground">
            Files ending in .tex, .bib, .cls, .sty, or .md will be opened in the editor.
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="w-full sm:w-auto h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
        >
          Close
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isCreatingNewFile}
          className="w-full sm:w-auto h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
        >
          {isCreatingNewFile && (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
          )}
          <span>Create</span>
        </Button>
      </div>
    </form>
  );
}
