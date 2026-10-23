'use client';

import React, { useState } from 'react';
import { Hash, Loader2 } from 'lucide-react';
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
import { useChatStore } from '../store/chat.store';
import { useCreateChannel } from '../hooks/use-chat-queries';
import { toast } from 'sonner';

export function CreateChannelModal() {
  const {
    isCreateChannelModalOpen,
    closeCreateChannelModal,
    selectedProjectIdForChannel,
    setActiveConversation,
  } = useChatStore();

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');

  const createChannelMutation = useCreateChannel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedProjectIdForChannel) return;

    try {
      const channel = await createChannelMutation.mutateAsync({
        projectId: selectedProjectIdForChannel,
        name: name.trim(),
        topic: topic.trim() || undefined,
      });

      toast.success(`Channel #${channel.name} created`);
      setActiveConversation(channel);
      setName('');
      setTopic('');
      closeCreateChannelModal();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create channel');
    }
  };

  return (
    <Dialog open={isCreateChannelModalOpen} onOpenChange={closeCreateChannelModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-15 font-semibold text-foreground">
            <Hash className="size-4 text-foreground shrink-0" />
            <span>Create Project Channel</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="channel-name" className="text-12 font-medium text-foreground">
              Channel Name
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-12 font-mono">
                #
              </span>
              <Input
                id="channel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. papers, data-analysis, lab-meeting"
                className="pl-7 text-13 h-8 rounded-md bg-background border border-border shadow-2xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                autoFocus
                required
              />
            </div>
            <p className="text-11 text-muted-foreground">
              Channel names are automatically lowercased and hyphenated.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-topic" className="text-12 font-medium text-foreground">
              Topic description (optional)
            </Label>
            <Input
              id="channel-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Channel topic or purpose"
              className="text-13 h-8 rounded-md bg-background border border-border shadow-2xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeCreateChannelModal}
              className="text-13 font-medium h-8 px-3 rounded-md shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || createChannelMutation.isPending}
              className="text-13 font-medium h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover shadow-none"
            >
              {createChannelMutation.isPending && (
                <Loader2 className="size-3 animate-spin mr-1.5" />
              )}
              Create Channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
