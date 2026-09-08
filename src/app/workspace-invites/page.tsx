'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { apiPost } from '@/shared/lib/api';
import { toast } from 'sonner';

export default function WorkspaceInvitesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [isPending, setIsPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    setIsPending(true);
    try {
      const result = await apiPost<{
        workspace: { id: string; name: string; url?: string; slug?: string };
        yourRole?: string;
        workspaceId?: string;
      }>('/api/workspace/join/code', {
        inviteCode: inviteCode.trim(),
      });
      toast.success('Successfully joined workspace!');
      const targetPath =
        result?.workspace?.url ||
        result?.workspace?.slug ||
        result?.workspace?.id ||
        result?.workspaceId;
      if (targetPath) {
        router.push(`/${targetPath}`);
      } else {
        router.push('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to join workspace. Please check the invite code.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className='flex min-h-screen flex-col bg-background p-12'>
      {/* Top Navbar */}
      <header className='flex h-16 shrink-0 items-center justify-between px-8'>
        <Link href='/' className='flex items-center gap-2 hover:opacity-80 transition-opacity'>
          <img src='/Flux.svg' alt='Flux Logo' className='h-10 w-auto object-contain' />
        </Link>
        {user?.email && (
          <div className='text-base text-foreground font-medium'>
            {user.email}
          </div>
        )}
      </header>

      {/* Main Form Content */}
      <main className='flex-1 flex flex-col pt-12 sm:pt-24 px-8 lg:px-86 pb-12 items-start'>
        <div className='w-full max-w-[420px] flex flex-col'>
          <div className='space-y-1.5 mb-12'>
            <h1 className='text-2xl font-semibold tracking-tight'>
              Join Workspace
            </h1>
            <p className='text-muted-foreground'>
              Enter the invite code provided by your team administrator to join their workspace.
            </p>
          </div>

          <form onSubmit={onSubmit} className='flex flex-col gap-8 w-full'>
            {/* Invite Code */}
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='code'>
                Invite Code <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='code'
                type='text'
                placeholder='e.g. 8f2a1b9c'
                className='h-9 rounded-md'
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className='flex items-center gap-4 pt-4'>
              <motion.div whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 450, damping: 25 }}>
                <Button type='submit' className='h-9 px-6 font-medium rounded-md cursor-pointer' disabled={!inviteCode.trim() || isPending}>
                  {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin shrink-0' />}
                  {isPending ? 'Joining...' : 'Join workspace'}
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 450, damping: 25 }}>
                <Button variant='outline' type='button' onClick={() => router.back()} className='h-9 px-6 font-medium text-foreground rounded-md hover:bg-muted transition-colors cursor-pointer'>
                  Go back
                </Button>
              </motion.div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
