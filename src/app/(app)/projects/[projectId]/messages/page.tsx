'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MessagesRoute() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId || '';

  useEffect(() => {
    if (projectId) {
      router.replace(`/chat?projectId=${projectId}`);
    } else {
      router.replace('/chat');
    }
  }, [projectId, router]);

  return (
    <div className="flex-1 flex items-center justify-center h-full bg-background">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>Redirecting to project discussion...</span>
      </div>
    </div>
  );
}
