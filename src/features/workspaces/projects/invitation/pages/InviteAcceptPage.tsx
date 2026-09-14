'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { useJoinProjectByCode } from '../hooks/use-project-invitations';

interface InviteAcceptPageProps {
  token: string;
}

export function InviteAcceptPage({ token }: InviteAcceptPageProps) {
  const router = useRouter();
  const joinMutation = useJoinProjectByCode();
  const [isSuccess, setIsSuccess] = useState(false);

  const handleJoin = async () => {
    try {
      const res = await joinMutation.mutateAsync({ code: token });
      setIsSuccess(true);
      setTimeout(() => {
        if (res?.projectId) {
          router.replace(`/projects/${res.projectId}`);
        } else {
          router.replace('/');
        }
      }, 1000);
    } catch {}
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background px-4">
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
              ? 'You have successfully joined the research project. Redirecting...'
              : 'You have been invited to collaborate on a research project in Flux. Click below to accept the invitation and start collaborating.'}
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Button
            onClick={handleJoin}
            disabled={joinMutation.isPending || isSuccess}
            className="w-full h-10 gap-2 font-medium"
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
            onClick={() => router.replace('/')}
            className="w-full h-9 text-xs text-muted-foreground"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InviteAcceptPage;
