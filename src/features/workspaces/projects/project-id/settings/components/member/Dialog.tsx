'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Check, UserPlus } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { apiGet } from "@/shared/lib/api";
import type { ProjectRole } from '../../types/member.types';

interface CandidateUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace?: any;
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
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('contributor');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<CandidateUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset states on dialog close/open
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedUserIds([]);
      setSearchedUsers([]);
      setIsSearching(false);
    }
  }, [open]);

  // Asynchronous user search against /api/users/search
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setSearchedUsers([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const queryParams = new URLSearchParams({ query: trimmed });
        if (workspace?.id) {
          queryParams.set('workspaceId', workspace.id);
        }
        const res = await apiGet<any>(`/api/users/search?${queryParams.toString()}`);
        const rawUsers = Array.isArray(res) ? res : res?.users || [];
        const mapped: CandidateUser[] = rawUsers.map((u: any) => ({
          id: u.id,
          name: u.name || 'User',
          email: u.email || '',
          avatar: u.avatar || null,
        }));
        setSearchedUsers(mapped);
      } catch {
        setSearchedUsers([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search, workspace?.id]);

  // Fallback candidates from workspace.members if present and search is empty
  const fallbackMembers: CandidateUser[] = React.useMemo(() => {
    const list = (workspace?.members as any[]) || [];
    return list
      .map((m) => {
        const u = m.user || {};
        return {
          id: u.id || m.userId,
          name: u.name || 'User',
          email: u.email || '',
          avatar: u.avatar || null,
        };
      })
      .filter((u) => u.id && !existingMemberIds.has(u.id));
  }, [workspace?.members, existingMemberIds]);

  const displayedUsers = React.useMemo(() => {
    if (search.trim().length >= 2) {
      return searchedUsers.filter((u) => !existingMemberIds.has(u.id));
    }
    return fallbackMembers;
  }, [search, searchedUsers, fallbackMembers, existingMemberIds]);

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
      <DialogContent className="sm:max-w-md rounded-lg border border-border p-0 overflow-hidden bg-background">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              Add members to project
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Search researchers by name or email to invite them to this project.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 pt-2 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs border-border focus:ring-0 focus:outline-none"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground animate-spin shrink-0" />
              )}
            </div>

            <Select
              value={selectedRole}
              onValueChange={(val) => setSelectedRole(val as ProjectRole)}
            >
              <SelectTrigger className="w-28 h-8 text-xs border-border focus:ring-0 focus:outline-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contributor" className="text-xs">
                  Contributor
                </SelectItem>
                <SelectItem value="commenter" className="text-xs">
                  Commenter
                </SelectItem>
                <SelectItem value="viewer" className="text-xs">
                  Viewer
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-border/60 bg-muted/40">
            {search.trim().length < 2 && displayedUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <UserPlus className="size-6 text-muted-foreground/60 shrink-0" />
                <p>Type at least 2 characters to search for researchers.</p>
              </div>
            ) : displayedUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {isSearching
                  ? 'Searching users...'
                  : `No users found matching "${search}"`}
              </div>
            ) : (
              displayedUsers.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={cn(
                      'w-full flex items-center justify-between p-2.5 transition-colors cursor-pointer text-left',
                      isSelected ? 'bg-muted font-medium' : 'hover:bg-muted/70'
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
                        {isSelected && <Check className="size-3 stroke-[3] shrink-0" />}
                      </div>

                      <Avatar className="size-7 rounded-full border border-border shrink-0">
                        {u.avatar && (
                          <AvatarImage src={u.avatar} className="object-cover" />
                        )}
                        <AvatarFallback className="text-xs bg-muted font-medium">
                          {(u.name || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {u.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
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

        <DialogFooter className="p-4 bg-muted border-t border-border flex items-center justify-end gap-2">
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
            className="h-8 text-xs font-medium px-4 bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none"
          >
            {isLoading && <Loader2 className="mr-1.5 size-3 animate-spin shrink-0" />}
            <span>Add {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
