'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui';

interface InviteAcceptPageProps {
  token: string;
}

export function InviteAcceptPage({ token: _token }: InviteAcceptPageProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center space-y-6">
        <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
          <ShieldCheck className="size-7 shrink-0" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Personal Research Workspace
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Workspace-level invitations are no longer active. In Flux, each researcher has their own dedicated Personal Workspace, and collaboration happens directly inside individual Research Projects.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-4 text-xs text-muted-foreground flex items-center gap-2 text-left">
          <Sparkles className="size-4 text-primary shrink-0" />
          <span>If you were invited to collaborate on a research project, please ask the Project Lead to add you as a Project Member.</span>
        </div>

        <div className="pt-2">
          <Button
            onClick={() => router.replace('/')}
            className="w-full h-10 gap-2 font-medium"
          >
            <span>Go to Dashboard</span>
            <ArrowRight className="size-4 shrink-0" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InviteAcceptPage;

