'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Check, X, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@/shared/components/ui';
import { ProjectAvatar } from '@/shared/components/icon-picker/ProjectAvatar';
import {
  useMyProjectInvitations,
  useAcceptProjectInvitation,
  useDeclineProjectInvitation,
  useJoinProjectByCode,
} from '../hooks/use-project-invitations';
import type { ProjectInvitation } from '../types/invitation.types';

interface ProjectInvitesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectInvitesModal({
  open,
  onOpenChange,
}: ProjectInvitesModalProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');

  const { data: invitations = [], isLoading } = useMyProjectInvitations();
  const acceptMutation = useAcceptProjectInvitation();
  const declineMutation = useDeclineProjectInvitation();
  const joinMutation = useJoinProjectByCode();

  const handleAccept = async (inv: ProjectInvitation) => {
    try {
      const res = await acceptMutation.mutateAsync(inv.id);
      onOpenChange(false);
      if (res?.projectId) {
        router.push(`/projects/${res.projectId}`);
      }
    } catch {
      // Error notification is dispatched by mutation's onError handler
    }
  };

  const handleDecline = async (inv: ProjectInvitation) => {
    try {
      await declineMutation.mutateAsync(inv.id);
    } catch {
      // Error notification is dispatched by mutation's onError handler
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinCode.trim();
    if (!trimmed) return;

    try {
      const res = await joinMutation.mutateAsync({ code: trimmed });
      setJoinCode('');
      onOpenChange(false);
      if (res?.projectId) {
        router.push(`/projects/${res.projectId}`);
      }
    } catch {
      // Error notification is dispatched by mutation's onError handler
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-card border-border shadow-raised-200">
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Mail className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                Project Invitations
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Invitations from colleagues and researchers to join their projects.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {/* Pending Invitations Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Pending Invitations ({invitations.length})
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin mr-2" />
                <span className="text-xs">Loading invitations...</span>
              </div>
            ) : invitations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground bg-muted/10 space-y-2">
                <div className="size-10 rounded-full bg-muted/60 text-muted-foreground/70 flex items-center justify-center mx-auto">
                  <Mail className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-xs">No pending project invitations</p>
                  <p className="text-11 text-muted-foreground mt-1 max-w-xs mx-auto">
                    When other researchers invite you to collaborate on their project, their invitations will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background hover:border-border/80 transition-all shadow-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProjectAvatar
                        avatar={inv.project?.avatar}
                        name={inv.project?.name || 'Project'}
                        id={inv.projectId}
                        size="md"
                        className="size-8 rounded-md shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {inv.project?.name}
                          </span>
                          {inv.project?.identifier && (
                            <span className="text-10 font-mono font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                              {inv.project.identifier}
                            </span>
                          )}
                        </div>
                        <p className="text-11 text-muted-foreground truncate mt-0.5">
                          {inv.inviter?.name
                            ? `Invited by ${inv.inviter.name}`
                            : `Invited to join as ${inv.role}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <Button
                        type="button"
                        size="sm"
                        disabled={acceptMutation.isPending || declineMutation.isPending}
                        onClick={() => handleAccept(inv)}
                        className="h-7 text-xs px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md gap-1"
                      >
                        {acceptMutation.isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Check className="size-3" />
                        )}
                        <span>Accept</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={acceptMutation.isPending || declineMutation.isPending}
                        onClick={() => handleDecline(inv)}
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                        title="Decline invitation"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Join with Invite Code Section */}
          <form onSubmit={handleJoinByCode} className="pt-2 border-t border-border/60 space-y-2">
            <Label htmlFor="project-join-code" className="text-xs font-semibold text-foreground">
              Join with invite code or identifier
            </Label>
            <div className="flex gap-2">
              <Input
                id="project-join-code"
                placeholder="e.g. TT2, TIEPTUC, or paste invite token..."
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="h-8.5 text-xs bg-background border-border"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!joinCode.trim() || joinMutation.isPending}
                className="h-8.5 text-xs px-3.5 shrink-0 font-medium"
              >
                {joinMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <ArrowRight className="size-3.5 mr-1.5 shrink-0" />
                )}
                <span>Join</span>
              </Button>
            </div>
          </form>
        </div>

        <DialogFooter className="p-3 px-5 border-t border-border/60 bg-muted/10">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-medium"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectInvitesModal;
