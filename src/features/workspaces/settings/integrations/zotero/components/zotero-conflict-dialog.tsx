'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { resolveZoteroConflict } from '../services/zotero.service';
import type { ResolveConflictPayload } from '../types/zotero.types';
import { AlertTriangle, Check, RefreshCw, X } from 'lucide-react';

export interface ConflictingField {
  field: string;
  baseValue: any;
  localValue: any;
  remoteValue: any;
}

export interface ZoteroConflictDialogProps {
  workspaceId: string;
  bindingId: string;
  itemId: string;
  itemTitle: string;
  conflicts: ConflictingField[];
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export const ZoteroConflictDialog: React.FC<ZoteroConflictDialogProps> = ({
  workspaceId,
  bindingId,
  itemId,
  itemTitle,
  conflicts,
  isOpen,
  onClose,
  onResolved,
}) => {
  const [strategy, setStrategy] = useState<'use_local' | 'use_remote' | 'custom_merge'>('custom_merge');
  const [resolutions, setResolutions] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const c of conflicts) {
      initial[c.field] = c.localValue; // Default to local choice
    }
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChoose = (field: string, value: any) => {
    setStrategy('custom_merge');
    setResolutions((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCustomChange = (field: string, value: string) => {
    setStrategy('custom_merge');
    setResolutions((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleChooseAllLocal = () => {
    setStrategy('use_local');
    const updated: Record<string, any> = {};
    for (const c of conflicts) {
      updated[c.field] = c.localValue;
    }
    setResolutions(updated);
  };

  const handleChooseAllRemote = () => {
    setStrategy('use_remote');
    const updated: Record<string, any> = {};
    for (const c of conflicts) {
      updated[c.field] = c.remoteValue;
    }
    setResolutions(updated);
  };

  const handleResolve = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const payload: ResolveConflictPayload = {
      resolutionStrategy: strategy,
      resolvedTitle: resolutions['title'],
      resolvedItemType: resolutions['itemType'],
      resolvedDoi: resolutions['doi'],
      resolvedUrl: resolutions['url'],
      resolvedAbstract: resolutions['abstract'],
      resolvedYear: typeof resolutions['year'] === 'number' ? resolutions['year'] : parseInt(resolutions['year'], 10) || undefined,
      resolvedTags: Array.isArray(resolutions['tags']) ? resolutions['tags'] : undefined,
    };

    try {
      await resolveZoteroConflict(workspaceId, bindingId, itemId, payload);
      onResolved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resolve conflict. Zotero may have updated again; refresh to view latest remote state.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto" showCloseButton={true}>
        <DialogHeader className="border-b pb-3 text-left space-y-1">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-5 text-amber-500 shrink-0" />
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Resolve 3-Way Sync Conflict
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Item: <span className="font-medium text-foreground">{itemTitle}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg border border-destructive/20">
            {errorMsg}
          </div>
        )}

        {/* Quick Batch Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-2.5 rounded-lg text-xs">
          <span className="text-muted-foreground font-medium">Quick Resolutions:</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleChooseAllLocal}
              className="text-xs h-7"
            >
              Keep All Local (Flux)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleChooseAllRemote}
              className="text-xs h-7"
            >
              Take All Remote (Zotero)
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Conflicting changes occurred simultaneously on Flux and Zotero. Select the desired value for each field or type a custom edit:
          </p>

          {conflicts.map((c) => {
            const isLocalChosen = resolutions[c.field] === c.localValue;
            const isRemoteChosen = resolutions[c.field] === c.remoteValue;

            return (
              <div
                key={c.field}
                className="p-3.5 rounded-lg bg-muted/20 border space-y-2.5"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Field: <strong className="text-primary">{c.field}</strong></span>
                  {c.baseValue !== undefined && (
                    <span className="text-xs font-normal normal-case text-muted-foreground">
                      Base: {String(c.baseValue)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={isLocalChosen}
                    onClick={() => handleChoose(c.field, c.localValue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleChoose(c.field, c.localValue);
                      }
                    }}
                    className={`cursor-pointer p-2.5 rounded-lg border text-xs transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      isLocalChosen
                        ? 'border-primary bg-primary/10 text-foreground font-medium ring-1 ring-primary'
                        : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold mb-1">
                      <span>Flux (Local)</span>
                      {isLocalChosen && <Check className="size-3.5 text-primary" />}
                    </div>
                    <div className="truncate">{String(c.localValue ?? '')}</div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={isRemoteChosen}
                    onClick={() => handleChoose(c.field, c.remoteValue)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleChoose(c.field, c.remoteValue);
                      }
                    }}
                    className={`cursor-pointer p-2.5 rounded-lg border text-xs transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      isRemoteChosen
                        ? 'border-primary bg-primary/10 text-foreground font-medium ring-1 ring-primary'
                        : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold mb-1">
                      <span>Zotero (Remote)</span>
                      {isRemoteChosen && <Check className="size-3.5 text-primary" />}
                    </div>
                    <div className="truncate">{String(c.remoteValue ?? '')}</div>
                  </div>
                </div>

                {/* Custom Edit Input */}
                <div className="pt-1">
                  <Input
                    className="h-8 text-xs"
                    placeholder={`Custom value for ${c.field}...`}
                    aria-label={`Custom value for ${c.field}`}
                    value={String(resolutions[c.field] ?? '')}
                    onChange={(e) => handleCustomChange(c.field, e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="pt-3 border-t flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleResolve} disabled={isSubmitting} className="gap-1.5 font-medium">
            {isSubmitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {isSubmitting ? 'Resolving Conflict...' : 'Apply & Sync to Zotero'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
