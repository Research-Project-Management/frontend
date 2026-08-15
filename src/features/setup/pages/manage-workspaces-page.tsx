'use client';

import { useRouter } from 'next/navigation';
import { Plus, ArrowRight, Pencil, Trash2, Users } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  
} from '@/shared/components/ui';
import { useWorkspaces } from '@/features/workspaces/shell/hooks/use-workspace';
import DeleteModal from '@/features/workspaces/settings/components/DeleteModal';

import { useEditWorkspace, useDeleteWorkspace } from '../hooks/use-workspace';
import type { Workspace } from '../types/workspace-types';

export default function ManageWorkspacesPage() {
  const router = useRouter();
  const { workspaces, isLoading } = useWorkspaces();

  const editWorkspace = useEditWorkspace();
  const deleteWorkspace = useDeleteWorkspace();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className='flex min-h-screen items-start justify-center bg-background px-4 py-12 sm:py-24'>
      <div className='mx-auto w-full max-w-2xl flex flex-col gap-8'>

        {/* Header */}
        <div className='flex items-start justify-between'>
          <div>
            <h1 className='text-2xl font-bold'>Workspaces</h1>
            <p className='text-sm text-muted-foreground mt-1'>
              Manage and switch between your workspaces.
            </p>
          </div>
          <Button onClick={() => router.push('/create-workspace')} className='h-9 gap-2 cursor-pointer'>
            <Plus className='w-4 h-4' />
            New workspace
          </Button>
        </div>

        {/* Workspace List */}
        <div className='flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden'>
          {workspaces?.length === 0 && (
            <div className='py-16 text-center text-muted-foreground text-sm'>
              No workspaces yet.{' '}
              <button onClick={() => router.push('/create-workspace')} className='text-primary hover:underline cursor-pointer'>
                Create one
              </button>
            </div>
          )}
          {workspaces?.map((workspace: Workspace) => (
            <div
              key={workspace._id}
              className='flex items-center gap-4 px-4 py-3 bg-background hover:bg-secondary/40 transition-colors group'
            >
              {/* Avatar */}
              <div className='h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0 overflow-hidden'>
                {workspace.avatar
                  ? <img src={workspace.avatar} alt={workspace.name} className='h-full w-full object-cover' />
                  : workspace.name.charAt(0).toUpperCase()
                }
              </div>

              {/* Info */}
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-semibold truncate'>{workspace.name}</p>
                <p className='text-xs text-muted-foreground font-mono truncate'>/{workspace.url}</p>
              </div>

              {/* Member count + role */}
              <div className='hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground'>
                <Users className='w-3.5 h-3.5' />
                <span>{workspace.members?.length ?? 0}</span>
              </div>

              {/* Actions */}
              <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 w-7 p-0 cursor-pointer'
                  onClick={() => editWorkspace.open(workspace)}
                  aria-label='Edit workspace'
                >
                  <Pencil className='w-3.5 h-3.5' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer'
                  onClick={() => deleteWorkspace.open(workspace)}
                  aria-label='Delete workspace'
                >
                  <Trash2 className='w-3.5 h-3.5' />
                </Button>
              </div>

              {/* Open */}
              <Button
                size='sm'
                className='h-8 gap-1.5 text-xs cursor-pointer'
                onClick={() => router.push(`/${workspace.url}`)}
              >
                Open
                <ArrowRight className='w-3 h-3' />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editWorkspace.editingWorkspace}
        onOpenChange={(open) => { if (!open && !editWorkspace.isPending && !editWorkspace.isUploadingAvatar) editWorkspace.close(); }}
      >
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Edit workspace</DialogTitle>
            <DialogDescription>Update your workspace name or avatar.</DialogDescription>
          </DialogHeader>

          <div className='flex flex-col gap-4 py-2'>
            {/* Avatar */}
            <div className='flex flex-col gap-1.5'>
              <Label>Avatar</Label>
              <div className='flex items-center gap-3'>
                {editWorkspace.displayAvatar && (
                  <img
                    src={editWorkspace.displayAvatar}
                    alt='Avatar'
                    className='h-10 w-10 rounded-md object-cover border border-border'
                  />
                )}
                <input
                  type='file'
                  id='edit-avatar-input'
                  accept='image/*'
                  className='hidden'
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) editWorkspace.handleAvatarSelect(file);
                  }}
                />
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-9 cursor-pointer'
                  onClick={() => document.getElementById('edit-avatar-input')?.click()}
                >
                  {editWorkspace.isUploadingAvatar ? 'Uploading...' : 'Change avatar'}
                </Button>
              </div>
            </div>

            {/* Name */}
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='edit-name'>Workspace name</Label>
              <Input
                id='edit-name'
                value={editWorkspace.editName}
                onChange={(e) => editWorkspace.setEditName(e.target.value)}
                placeholder='Enter workspace name'
                className='h-10'
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={editWorkspace.close} disabled={editWorkspace.isPending} className='cursor-pointer'>
              Cancel
            </Button>
            <Button onClick={editWorkspace.confirm} disabled={editWorkspace.isPending || editWorkspace.isUploadingAvatar || !editWorkspace.hasChanges} className='cursor-pointer'>
              {editWorkspace.isUploadingAvatar ? 'Uploading...' : editWorkspace.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <DeleteModal
        isOpen={!!deleteWorkspace.deletingWorkspace}
        onClose={deleteWorkspace.close}
        onConfirm={deleteWorkspace.confirm}
        title='Delete workspace?'
        description={`Are you sure you want to delete "${deleteWorkspace.deletingWorkspace?.name}"? This action cannot be undone.`}
        confirmText='Delete'
        cancelText='Cancel'
        loading={deleteWorkspace.isPending}
      />
    </div>
  );
}
