'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useChangePassword } from '../../hooks/use-security';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Eye, EyeOff, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema } from '../../types/security.schema';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui";

export function SecurityTab() {
  const { user } = useAuth();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const changePasswordMutation = useChangePassword();

  const isOAuth = !!(user as any)?.googleId || !!(user as any)?.githubId;

  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: z.infer<typeof changePasswordSchema>) => {
    if (isOAuth) {
      toast.error('Password changes are not available for Google/GitHub accounts');
      return;
    }

    changePasswordMutation.mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      },
      {
        onSuccess: () => {
          form.reset();
        },
      }
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 md:p-8 space-y-6">
      {isOAuth ? (
        <div className="rounded-md border border-border bg-muted/30 p-4 flex items-start gap-3">
          <ShieldAlert className="size-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
          <div className="space-y-0.5">
            <h4 className="text-13 font-semibold text-foreground tracking-tight">
              Managed by external provider
            </h4>
            <p className="text-12 text-muted-foreground leading-normal">
              Your account is authenticated via Google or GitHub. Password changes are managed directly with your identity provider.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Section Header ── */}
          <div className="pb-3 border-b border-border">
            <h3 className="text-14 font-semibold text-foreground tracking-tight">
              Password Management
            </h3>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              {/* Current Password Field */}
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-12 font-medium text-foreground">
                      Current password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showCurrent ? 'text' : 'password'}
                          placeholder="Enter current password"
                          autoComplete="current-password"
                          className="h-8 text-13 px-3 pr-9 border-border bg-background hover:border-foreground/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-border transition-colors shadow-none"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1 md:before:hidden"
                          aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                        >
                          {showCurrent ? (
                            <EyeOff className="size-3.5 shrink-0" strokeWidth={1.5} />
                          ) : (
                            <Eye className="size-3.5 shrink-0" strokeWidth={1.5} />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-11 text-destructive font-medium" />
                  </FormItem>
                )}
              />

              {/* New Password Field */}
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-12 font-medium text-foreground">
                      New password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showNew ? 'text' : 'password'}
                          placeholder="Enter new password"
                          autoComplete="new-password"
                          className="h-8 text-13 px-3 pr-9 border-border bg-background hover:border-foreground/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-border transition-colors shadow-none"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1 md:before:hidden"
                          aria-label={showNew ? 'Hide new password' : 'Show new password'}
                        >
                          {showNew ? (
                            <EyeOff className="size-3.5 shrink-0" strokeWidth={1.5} />
                          ) : (
                            <Eye className="size-3.5 shrink-0" strokeWidth={1.5} />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-11 text-destructive font-medium" />
                  </FormItem>
                )}
              />

              {/* Confirm Password Field */}
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-12 font-medium text-foreground">
                      Confirm password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="Confirm password"
                          autoComplete="new-password"
                          className="h-8 text-13 px-3 pr-9 border-border bg-background hover:border-foreground/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-border transition-colors shadow-none"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1 md:before:hidden"
                          aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showConfirm ? (
                            <EyeOff className="size-3.5 shrink-0" strokeWidth={1.5} />
                          ) : (
                            <Eye className="size-3.5 shrink-0" strokeWidth={1.5} />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-11 text-destructive font-medium" />
                  </FormItem>
                )}
              />

              {/* Action Row */}
              <div className="pt-2 flex items-center justify-start">
                <Button
                  type="submit"
                  size="sm"
                  disabled={changePasswordMutation.isPending}
                  className="h-8 px-4 text-12 font-medium rounded-md cursor-pointer shadow-none relative before:absolute before:-inset-1 md:before:hidden"
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none shrink-0" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}

export default SecurityTab;
