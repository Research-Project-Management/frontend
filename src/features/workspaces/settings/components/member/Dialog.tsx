'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Loader2, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from '@/shared/components/ui';
import type { WorkspaceRole } from '../../types/member.types';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (emails: string[], role: WorkspaceRole) => Promise<void>;
  isInviting?: boolean;
}

export function InviteDialog({
  open,
  onOpenChange,
  onInvite,
  isInviting,
}: InviteDialogProps) {
  const [emails, setEmails] = useState<string[]>(['']);
  const [role, setRole] = useState<WorkspaceRole>('member');

  const handleEmailChange = (index: number, val: string) => {
    setEmails((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleAddRow = () => {
    setEmails((prev) => [...prev, '']);
  };

  const handleRemoveRow = (index: number) => {
    if (emails.length === 1) {
      setEmails(['']);
      return;
    }
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEmails = emails
      .map((em) => em.trim())
      .filter((em) => em.length > 0);

    if (validEmails.length === 0) return;

    await onInvite(validEmails, role);
    setEmails(['']);
    setRole('member');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-lg border border-border/80 bg-background shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold text-foreground">
            Invite members
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Invite colleagues and collaborators to join your workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Email inputs */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground">Email addresses</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto p-0.5">
              {emails.map((email, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={email}
                      onChange={(e) => handleEmailChange(idx, e.target.value)}
                      className="h-8.5 pl-8 text-xs rounded-lg border-border/80 bg-background focus:ring-0 focus:outline-none"
                      required={idx === 0}
                    />
                  </div>

                  {emails.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow(idx)}
                      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md cursor-pointer shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer pt-1"
            >
              <Plus className="size-3.5" />
              <span>Add another</span>
            </button>
          </div>

          {/* Role selection */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-medium text-foreground">Role</Label>
            <Select value={role} onValueChange={(val) => setRole(val as WorkspaceRole)}>
              <SelectTrigger className="h-8.5 text-xs rounded-lg border-border/80 bg-background focus:ring-0 focus:outline-none px-3 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="admin">Admin - Can manage workspace settings & members</SelectItem>
                <SelectItem value="member">Member - Can create & participate in projects</SelectItem>
                <SelectItem value="guest">Guest - Limited access to assigned projects</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3.5 text-xs font-medium rounded-lg cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isInviting || emails.every((e) => !e.trim())}
              className="h-8 px-4 text-xs font-medium bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg cursor-pointer shadow-2xs shrink-0"
            >
              {isInviting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Send invite
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
