'use client';

import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Loader2, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/shared/components/ui';
import { InviteMembersFormSchema } from '../../schemas/settings.schema';
import type { InviteMembersFormValues } from '../../types/settings.types';
import type { WorkspaceRole } from '../../types/member.types';

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (emails: string[], role: WorkspaceRole) => Promise<void>;
  isInviting?: boolean;
}

export function InviteModal({
  open,
  onOpenChange,
  onInvite,
  isInviting,
}: InviteModalProps) {
  const form = useForm<InviteMembersFormValues>({
    resolver: zodResolver(InviteMembersFormSchema),
    defaultValues: {
      emails: [{ email: '' }],
      role: 'member',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'emails',
  });

  const handleSubmit = async (values: InviteMembersFormValues) => {
    const validEmails = values.emails
      .map((item) => item.email.trim())
      .filter((email) => email.length > 0);

    if (validEmails.length === 0) return;

    await onInvite(validEmails, values.role as WorkspaceRole);
    form.reset({
      emails: [{ email: '' }],
      role: 'member',
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          form.reset({ emails: [{ email: '' }], role: 'member' });
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-md p-6 rounded-lg border border-border/80 bg-background shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold text-foreground">
            Invite members
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Invite colleagues and collaborators to join your workspace.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
            {/* Email inputs with useFieldArray */}
            <div className="space-y-2">
              <FormLabel className="text-xs font-medium text-foreground">
                Email addresses
              </FormLabel>
              <div className="space-y-2 max-h-48 overflow-y-auto p-0.5">
                {fields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`emails.${index}.email`}
                    render={({ field: inputField }) => (
                      <FormItem className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="colleague@example.com"
                                {...inputField}
                                className="h-8.5 pl-8 text-xs rounded-lg border-border/80 bg-background focus:ring-0 focus:outline-none"
                              />
                            </FormControl>
                          </div>

                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md cursor-pointer shrink-0"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => append({ email: '' })}
                className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <Plus className="size-3.5" />
                <span>Add another</span>
              </button>
            </div>

            {/* Role selection */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="space-y-1.5 pt-1">
                  <FormLabel className="text-xs font-medium text-foreground">
                    Role
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-8.5 text-xs rounded-lg border-border/80 bg-background focus:ring-0 focus:outline-none px-3 capitalize">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="text-xs">
                      <SelectItem value="admin">
                        Admin - Can manage workspace settings & members
                      </SelectItem>
                      <SelectItem value="member">
                        Member - Can create & participate in projects
                      </SelectItem>
                      <SelectItem value="viewer">
                        Viewer - View only access
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-8 px-3.5 text-xs font-medium rounded-lg cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isInviting}
                className="h-8 px-4 text-xs font-medium bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg cursor-pointer shadow-2xs shrink-0"
              >
                {isInviting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Send invite
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export { InviteModal as InviteDialog };
export default InviteModal;
