'use client';

import { useParams } from 'next/navigation';
import { Settings, Camera, Loader2 } from 'lucide-react';

import { Skeleton, Avatar, AvatarFallback, AvatarImage, Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';

import { useGeneral } from '@/features/workspaces/settings/hooks/use-general';
import TopBar from '@/features/workspaces/settings/components/TopBar';
import DeleteModal from '@/features/workspaces/settings/components/DeleteModal';

const TEAM_SIZES = [
  { value: "1", label: "Just me" },
  { value: "2-10", label: "2–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-500", label: "201–500" },
  { value: "500+", label: "500+" },
] as const;

export default function GeneralPage() {
  const { workspaceId } = useParams() as { workspaceId: string };
  
  const {
    form,
    workspace,
    isLoading,
    isError,
    host,
    currentAvatar,
    isUploadingAvatar,
    fileRef,
    isDeleteOpen,
    setIsDeleteOpen,
    handleUpdate,
    handleAvatarUpload,
    handleDelete,
    isSubmitting,
    isDeleting,
    hasChanges
  } = useGeneral(workspaceId);

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="General Settings" Icon={Settings} />
        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="General Settings" Icon={Settings} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Error loading workspace settings.
        </div>
      </div>
    );
  }

  const initial = (workspace.name || "X").charAt(0).toUpperCase();
  const slug = `${host}/${workspace.url}`;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar title="General Settings" Icon={Settings} />

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          
          {/* Profile Section */}
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploadingAvatar}
              className="relative group size-16 shrink-0 rounded-lg flex items-center justify-center text-2xl font-semibold overflow-hidden transition-opacity hover:opacity-90 cursor-pointer"
            >
              <div className="size-full">
                <Avatar className="size-full">
                  {currentAvatar && <AvatarImage src={currentAvatar} className="object-cover" />}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg uppercase">{initial}</AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingAvatar ? (
                  <Loader2 className="size-5 text-white animate-spin" />
                ) : (
                  <Camera className="size-5 text-white" />
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
              />
            </button>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-semibold text-foreground">
                {workspace.name || "Untitled"}
              </h2>
              <p className="text-sm text-muted-foreground">{slug}</p>
            </div>
          </div>

          <hr className="border-border" />

          {/* General Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teamSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team size</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder="Select team size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TEAM_SIZES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-1.5">
                  <FormLabel className="text-sm font-medium text-foreground">URL</FormLabel>
                  <Input
                    readOnly
                    value={slug}
                    className="bg-muted/50 text-muted-foreground cursor-not-allowed h-10 font-medium"
                  />
                </div>
                
              </div>

              <div>
                <Button type="submit" disabled={!hasChanges || isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                  {isSubmitting ? "Saving…" : "Update workspace"}
                </Button>
              </div>
            </form>
          </Form>

          <hr className="border-border" />

          {/* Danger Zone */}
          <div className="rounded-lg border border-destructive/30 p-6">
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Delete this workspace
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  This action is irreversible. All data, projects, pages, and member
                  access will be permanently removed.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleteOpen(true)}
                className="shrink-0 transition-colors hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>

        </div>
      </div>

      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Workspace"
        description="Are you sure you want to delete this workspace? This action cannot be undone."
        loading={isDeleting}
      />
    </div>
  );
}
