'use client';

import React, { useState } from 'react';
import { Users, Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { useChatStore } from '../store/chat.store';
import { useCreateGroup, useFriends } from '../hooks/use-chat-queries';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';

export function CreateGroupModal() {
  const { isCreateGroupModalOpen, closeCreateGroupModal, setActiveConversation } =
    useChatStore();

  const [name, setName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const { data: friends = [], isLoading: isLoadingFriends } = useFriends();
  const createGroupMutation = useCreateGroup();

  const toggleSelectFriend = (friendId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const group = await createGroupMutation.mutateAsync({
        name: name.trim(),
        memberIds: selectedMemberIds,
      });

      toast.success(`Group "${group.name}" created`);
      setActiveConversation(group);
      setName('');
      setSelectedMemberIds([]);
      closeCreateGroupModal();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create group');
    }
  };

  return (
    <Dialog open={isCreateGroupModalOpen} onOpenChange={closeCreateGroupModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-15 font-semibold text-foreground">
            <Users className="size-4 text-foreground shrink-0" />
            <span>Create New Group</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="group-name" className="text-12 font-medium text-foreground">
              Group Name
            </Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI Seminar, Paper Review Team..."
              className="text-13 h-8 rounded-md bg-background border border-border shadow-2xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-12 font-medium text-foreground">
              Add friends to group ({selectedMemberIds.length} selected)
            </Label>
            <div className="max-h-48 overflow-y-auto border border-border rounded-md p-1 space-y-1 bg-muted/30 sidebar-scrollbar">
              {isLoadingFriends ? (
                <div className="py-4 flex justify-center">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : friends.length === 0 ? (
                <p className="py-4 text-center text-12 text-muted-foreground">
                  You do not have any friends to add yet.
                </p>
              ) : (
                friends.map((item) => {
                  const isSelected = selectedMemberIds.includes(item.friend.id);
                  return (
                    <button
                      key={item.friend.id}
                      type="button"
                      onClick={() => toggleSelectFriend(item.friend.id)}
                      className={cn(
                        'w-full flex items-center justify-between p-1.5 rounded-md text-13 transition-colors cursor-pointer text-left outline-none',
                        isSelected ? 'bg-muted text-foreground font-medium' : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarImage src={item.friend.avatar || undefined} />
                          <AvatarFallback className="text-11 font-medium bg-muted text-foreground">
                            {item.friend.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-normal truncate max-w-44 text-foreground">{item.friend.name}</span>
                      </div>
                      <div
                        className={cn(
                          'size-4 rounded border flex items-center justify-center transition-colors',
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border bg-background',
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeCreateGroupModal}
              className="text-13 font-medium h-8 px-3 rounded-md shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || createGroupMutation.isPending}
              className="text-13 font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover shadow-none"
            >
              {createGroupMutation.isPending && (
                <Loader2 className="size-3 animate-spin mr-1.5" />
              )}
              Create Group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
