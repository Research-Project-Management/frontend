'use client';

import React, { useState } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { ProjectRole } from '../../types/member.types';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: any;
  existingMemberIds: Set<string>;
  onAdd: (userIds: string[], role: ProjectRole) => Promise<void>;
  isLoading?: boolean;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  workspace,
  existingMemberIds,
  onAdd,
  isLoading,
}: AddMemberDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('member');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const workspaceMembers = (workspace?.members as any[]) || [];

  const available = workspaceMembers.filter((m) => {
    const u = m.user || {};
    const uId = u.id || u._id || m.userId;
    if (!uId || existingMemberIds.has(uId)) return false;

    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleConfirm = async () => {
    if (selectedUserIds.length === 0) return;
    await onAdd(selectedUserIds, selectedRole);
    setSelectedUserIds([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-lg border border-border/80 p-0 overflow-hidden bg-background shadow-xl">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Add members to project
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Select members from your workspace to add to this project.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 pt-2 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search workspace members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs border-border/80 focus:ring-0 focus:outline-none"
              />
            </div>

            <Select
              value={selectedRole}
              onValueChange={(val) => setSelectedRole(val as ProjectRole)}
            >
              <SelectTrigger className="w-28 h-8 text-xs border-border/80 focus:ring-0 focus:outline-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin" className="text-xs">
                  Admin
                </SelectItem>
                <SelectItem value="member" className="text-xs">
                  Member
                </SelectItem>
                <SelectItem value="viewer" className="text-xs">
                  Viewer
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-56 overflow-y-auto border border-border/80 rounded-lg divide-y divide-border/60 bg-muted/10">
            {available.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {search
                  ? `No workspace members found matching "${search}"`
                  : 'All workspace members are already in this project.'}
              </div>
            ) : (
              available.map((m) => {
                const u = m.user || {};
                const uId = u.id || u._id || m.userId;
                const isSelected = selectedUserIds.includes(uId);

                return (
                  <button
                    key={uId}
                    type="button"
                    onClick={() => toggleUser(uId)}
                    className={cn(
                      'w-full flex items-center justify-between p-2.5 transition-colors cursor-pointer text-left',
                      isSelected ? 'bg-accent/60' : 'hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'size-4 rounded border flex items-center justify-center transition-colors shrink-0',
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/40'
                        )}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </div>

                      <Avatar className="size-7 rounded-full border border-border/80 shrink-0">
                        {u.avatar && (
                          <AvatarImage src={u.avatar} className="object-cover" />
                        )}
                        <AvatarFallback className="text-[10px] bg-muted font-medium">
                          {(u.name || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {u.name || 'Unknown'}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {u.email || ''}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-medium px-4 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={selectedUserIds.length === 0 || isLoading}
            className="h-8 text-xs font-medium px-4 bg-[#0070f3] hover:bg-[#0060df] text-white cursor-pointer shadow-2xs"
          >
            {isLoading && <Loader2 className="mr-1.5 size-3 animate-spin" />}
            <span>Add {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
