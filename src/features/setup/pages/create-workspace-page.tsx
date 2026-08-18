'use client';

import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { cn } from '@/shared/lib/utils';
import { Button, Input, Label } from '@/shared/components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui';
import { useCreateWorkspace } from '../hooks/use-workspace';
import { createWorkspaceSchema, type CreateWorkspaceSchema } from '../schemas/workspace.schema';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function CreateWorkspacePage() {
  const { createWorkspace, isPending } = useCreateWorkspace();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, dirtyFields, isValid },
  } = useForm<CreateWorkspaceSchema>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: '', url: '', size: '' },
    mode: 'onChange',
  });

  const onSubmit = (data: CreateWorkspaceSchema) => {
    createWorkspace(data);
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
            <h1 className='text-2xl font-bold tracking-tight'>
              Create your workspace
            </h1>
            <p className='text-muted-foreground'>
              This is where your team will organize, write, and collaborate on research.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-8 w-full'>
            {/* Workspace Name */}
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='name'>
                Name your workspace <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='name'
                type='text'
                placeholder='e.g. Acme Corp'
                className='h-10 rounded-lg'
                {...register('name', {
                  onChange: (e) => {
                    if (!dirtyFields.url) {
                      const slug = e.target.value
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9\s-]/g, '')
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-');
                      setValue('url', slug, { shouldValidate: true });
                    }
                  },
                })}
              />
              {errors.name && <p className='text-xs text-destructive'>{errors.name.message}</p>}
            </div>

            {/* Workspace URL */}
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='url'>
                Set your workspace's URL <span className='text-destructive'>*</span>
              </Label>
              <div className={cn(
                "flex items-center w-full min-w-0 rounded-lg border border-input bg-transparent px-3 h-10 text-base md:text-sm transition-colors",
                "focus-within:border-ring focus-within:ring-1 focus-within:ring-ring"
              )}>
                <span className='text-muted-foreground select-none shrink-0 pr-0.5'>
                  flux.chqv.tech/
                </span>
                <input
                  id='url'
                  type='text'
                  className='flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none min-w-0 h-full'
                  placeholder='acme-corp'
                  {...register('url')}
                />
              </div>
              {errors.url && <p className='text-xs text-destructive'>{errors.url.message}</p>}
            </div>

            {/* Company Size */}
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='size'>
                How many people will use this workspace? <span className='text-destructive'>*</span>
              </Label>
              <Controller
                name="size"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <SelectTrigger size="sm" className={cn(
                      "w-full text-base md:text-sm rounded-lg",
                      "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
                    )}>
                      <SelectValue placeholder='Select team size' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='Just myself'>Just myself</SelectItem>
                      <SelectItem value='2-10'>2-10</SelectItem>
                      <SelectItem value='11-50'>11-50</SelectItem>
                      <SelectItem value='51-200'>51-200</SelectItem>
                      <SelectItem value='201-500'>201-500</SelectItem>
                      <SelectItem value='500+'>500+</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.size && <p className='text-xs text-destructive'>{errors.size.message}</p>}
            </div>

            {/* Actions */}
            <div className='flex items-center gap-4 pt-4'>
              <motion.div whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 450, damping: 25 }}>
                <Button type='submit' className='h-10 px-6 font-medium rounded-lg cursor-pointer' disabled={!isValid || isPending}>
                  {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  {isPending ? 'Creating...' : 'Create workspace'}
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 450, damping: 25 }}>
                <Button variant='outline' type='button' asChild className='h-10 px-6 font-medium text-muted-foreground rounded-lg hover:bg-secondary hover:text-foreground transition-colors cursor-pointer'>
                  <Link href='/manage-workspace'>Go back</Link>
                </Button>
              </motion.div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
