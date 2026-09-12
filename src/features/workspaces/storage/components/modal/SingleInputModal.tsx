'use client';

import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";

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
          <DialogHeader>
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
