'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  AlertCircle,
  ArrowRight,
  Loader2,
  LogIn,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  getInvitationByToken,
  acceptInvitationByToken,
  declineInvitationByToken,
} from '@/features/workspaces/settings/services/settings.service';
import { toast } from 'sonner';

interface InviteAcceptPageProps {
  token: string;
}

export function InviteAcceptPage({ token }: InviteAcceptPageProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [data, setData] = useState<{
    invitation: any;
    workspace: any;
    invitedBy?: any;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    getInvitationByToken(token)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(
          err.message || 'Invitation is invalid, expired, or was revoked.',
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }

    try {
      setIsAccepting(true);
      const res = await acceptInvitationByToken(token);
      toast.success(res.message || 'Joined workspace successfully!');

      if (res.workspace?.url) {
        router.replace(`/${res.workspace.url}`);
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invitation');
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    try {
      setIsDeclining(true);
      await declineInvitationByToken(token);
      toast.info('Invitation declined');
      router.replace('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline invitation');
      setIsDeclining(false);
    }
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-border/70 bg-card shadow-2xl space-y-6 text-center">
          <div className="flex justify-center">
            <Skeleton className="size-16 rounded-2xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4 mx-auto rounded-lg" />
            <Skeleton className="h-4 w-1/2 mx-auto rounded-md" />
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-muted space-y-3">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
          </div>
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 flex-1 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-destructive/30 bg-card shadow-2xl text-center space-y-5">
          <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto border border-destructive/20">
            <AlertCircle className="size-7 stroke-[1.8]" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-foreground">
              Invitation Expired or Invalid
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {error ||
                'This invitation link is no longer valid or has already been used.'}
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => router.replace('/')}
              className="w-full h-10 rounded-xl text-xs font-medium cursor-pointer"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { invitation, workspace, invitedBy } = data;
  const isExpired = invitation.isExpired || invitation.status !== 'pending';

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Background ambient decorative glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl p-7 relative z-10 space-y-6">
        {/* Workspace Brand & Avatar */}
        <div className="flex flex-col items-center text-center space-y-3 pt-1">
          <div className="size-16 rounded-2xl border border-border/80 bg-muted shadow-sm flex items-center justify-center overflow-hidden">
            {workspace.avatar ? (
              <img
                src={workspace.avatar}
                alt={workspace.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="size-8 text-primary" />
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {workspace.name}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              /{workspace.url}
            </p>
          </div>
        </div>

        {/* Invitation Context */}
        <div className="rounded-xl border border-border/70 bg-muted p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-9 rounded-full border border-border/80 shrink-0">
              {invitedBy?.avatar && (
                <AvatarImage src={invitedBy.avatar} alt={invitedBy.name} />
              )}
              <AvatarFallback className="text-xs font-semibold bg-muted text-foreground">
                {(invitedBy?.name || 'A').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-semibold text-foreground truncate">
                {invitedBy?.name || 'A team member'}
              </p>
              <p className="text-11 text-muted-foreground truncate">
                invited you to collaborate as{' '}
                <span className="font-semibold text-foreground capitalize">
                  {invitation.role}
                </span>
              </p>
            </div>
            <Badge
              variant="secondary"
              className="text-10 font-bold tracking-wider px-2 py-0.5"
            >
              {invitation.role}
            </Badge>
          </div>

          <div className="pt-1 border-t border-border/50 flex items-center justify-between text-11 text-muted-foreground">
            <span>Workspace members</span>
            <span className="font-medium text-foreground flex items-center gap-1">
              <Users className="size-3" />
              {workspace.membersCount}
            </span>
          </div>
        </div>

        {/* Expired Status Notice */}
        {isExpired && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>This invitation has expired or has already been accepted.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-1">
          {user ? (
            /* Logged in state */
            <div className="space-y-2.5">
              <div className="text-center text-11 text-muted-foreground pb-0.5">
                Logged in as{' '}
                <strong className="text-foreground">{user.email}</strong>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDecline}
                  disabled={isAccepting || isDeclining || isExpired}
                  className="flex-1 h-10 rounded-xl text-xs font-medium cursor-pointer"
                >
                  {isDeclining ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    'Decline'
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={handleAccept}
                  disabled={isAccepting || isDeclining || isExpired}
                  className="flex-1 h-10 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
                >
                  {isAccepting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Accept & Join</span>
                      <ArrowRight className="size-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Not logged in state */
            <div className="space-y-2.5">
              <p className="text-center text-11 text-muted-foreground pb-0.5">
                Please sign in to accept this workspace invitation
              </p>

              <Button
                type="button"
                onClick={() => router.push(`/login?redirect=/invite/${token}`)}
                className="w-full h-10 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <LogIn className="size-3.5" />
                <span>Log in to Accept</span>
              </Button>

              <p className="text-center text-11 text-muted-foreground pt-1">
                Don't have an account?{' '}
                <Link
                  href={`/register?redirect=/invite/${token}`}
                  className="text-primary hover:underline font-medium"
                >
                  Create account
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InviteAcceptPage;
