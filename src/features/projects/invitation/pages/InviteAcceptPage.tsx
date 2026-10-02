'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, UserPlus, Loader2, CheckCircle2, LogIn } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useJoinProjectByCode } from '../hooks/use-project-invitations';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';

interface InviteAcceptPageProps {
  token: string;
}

export function InviteAcceptPage({ token }: InviteAcceptPageProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const joinMutation = useJoinProjectByCode();
  const [isSuccess, setIsSuccess] = useState(false);

  const handleJoin = async () => {
    try {
      const res = await joinMutation.mutateAsync({ code: token });
      setIsSuccess(true);
      toast.success('Successfully joined the project!');
      setTimeout(() => {
        if (res?.projectId) {
          router.replace(`/projects/${res.projectId}`);
        } else {
          router.replace('/home');
        }
      }, 1000);
    } catch (err: unknown) {
      const message =
        getErrorMessage(err) ||
        'Failed to accept invitation. The code may be expired or already used.';
      toast.error(message);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-background" suppressHydrationWarning>
        <Loader2 className="size-8 animate-spin text-primary shrink-0" />
        <span className="sr-only">Checking authorization...</span>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center space-y-6 shadow-sm">
        <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
          {isSuccess ? (
            <CheckCircle2 className="size-7 shrink-0 text-green-600" />
          ) : (
            <UserPlus className="size-7 shrink-0" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {isSuccess ? 'Welcome to the project!' : 'Project Collaboration Invitation'}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isSuccess
              ? 'You have successfully joined the research project. Redirecting to workspace...'
              : user
                ? 'You have been invited to collaborate on a research project in Flux. Click below to accept the invitation.'
                : 'You have been invited to collaborate on a research project in Flux. Please sign in or create an account to accept this invitation.'}
          </p>
        </div>

        {user ? (
          <div className="pt-2 flex flex-col gap-2.5">
            <Button
              onClick={handleJoin}
              disabled={joinMutation.isPending || isSuccess}
              className="w-full h-10 gap-2 font-medium cursor-pointer"
            >
              {joinMutation.isPending ? (
                <Loader2 className="size-4 animate-spin shrink-0" />
              ) : isSuccess ? (
                <CheckCircle2 className="size-4 shrink-0 text-white" />
              ) : (
                <ArrowRight className="size-4 shrink-0" />
              )}
              <span>{isSuccess ? 'Joined' : 'Accept Invitation'}</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => router.replace('/home')}
              className="w-full h-9 text-xs text-muted-foreground cursor-pointer"
            >
              Back to Workspace
            </Button>
          </div>
        ) : (
          <div className="pt-2 flex flex-col gap-2.5">
            <Button asChild className="w-full h-10 gap-2 font-medium cursor-pointer">
              <Link href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}>
                <LogIn className="size-4 shrink-0" />
                <span>Sign in to accept</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full h-10 gap-2 font-medium cursor-pointer">
              <Link href={`/register?redirect=${encodeURIComponent(`/invite/${token}`)}`}>
                <span>Create an account</span>
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default InviteAcceptPage;
