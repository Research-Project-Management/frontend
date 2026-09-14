'use client';

import React, { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, Input, Skeleton, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui";
import { DeleteModal } from '@/features/workspaces/settings/components/modal/DeleteModal';
import { TopBar } from '../components/layout/TopBar';
import {
  Tag,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  CornerDownRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/shared/lib/utils";
import {
  useWorkspaceLabels,
  useCreateWorkspaceLabel,
  useUpdateWorkspaceLabel,
  useDeleteWorkspaceLabel,
} from '../hooks/use-workspace-labels';
import { labelFormSchema, type LabelFormValues } from '@/features/workspaces/projects/project-id/settings/schemas/label.schema';
import type { Label } from '@/features/workspaces/projects/project-id/settings/types/label.types';

// ── Color Preset Palette ──────────────────────────────────────────────────

export const COLOR_PALETTE = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Slate', hex: '#64748b' },
];

export default function LabelsPage() {
  const { data: rawLabels = [], isLoading: isLoadingLabels, isError } = useWorkspaceLabels();
  const createMutation = useCreateWorkspaceLabel();
  const updateMutation = useUpdateWorkspaceLabel();
  const deleteMutation = useDeleteWorkspaceLabel();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Collapsed Parent Groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);

  // Form Setup using React Hook Form & Zod
  const form = useForm<LabelFormValues>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: {
      name: '',
      color: '#3b82f6',
      description: '',
      parentId: null,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    control,
    formState: { errors },
  } = form;

  const formColor = useWatch({ control, name: 'color' });
  const formParentId = useWatch({ control, name: 'parentId' });

  // Delete State
  const [deletingLabel, setDeletingLabel] = useState<Label | null>(null);

  // ── Hierarchical Label Processing ──────────────────────────────────────────

  const { rootLabels, childMap, allLabelsCount } = useMemo(() => {
    const roots: Label[] = [];
    const childrenByParent: Record<string, Label[]> = {};

    rawLabels.forEach((label) => {
      if (label.parentId) {
        if (!childrenByParent[label.parentId]) {
          childrenByParent[label.parentId] = [];
        }
        childrenByParent[label.parentId].push(label);
      } else {
        roots.push(label);
      }
    });

    // Also attach children from server if present
    roots.forEach((root) => {
      if (root.children && root.children.length > 0) {
        if (!childrenByParent[root.id]) {
          childrenByParent[root.id] = root.children;
        }
      }
    });

    return {
      rootLabels: roots,
      childMap: childrenByParent,
      allLabelsCount: rawLabels.length,
    };
  }, [rawLabels]);

  const filteredRoots = useMemo(() => {
    if (!searchQuery.trim()) return rootLabels;
    const q = searchQuery.toLowerCase().trim();

    return rootLabels.filter((root) => {
      const matchRoot = root.name.toLowerCase().includes(q);
      const matchChildren = (childMap[root.id] || []).some((c) =>
        c.name.toLowerCase().includes(q),
      );
      return matchRoot || matchChildren;
    });
  }, [rootLabels, childMap, searchQuery]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const toggleGroupCollapse = (id: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const openCreateModal = (parentId?: string) => {
    setEditingLabel(null);
    reset({
      name: '',
      color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].hex,
      description: '',
      parentId: parentId || null,
    });
    setIsFormOpen(true);
  };

  const openEditModal = (label: Label) => {
    setEditingLabel(label);
    reset({
      name: label.name,
      color: label.color || '#3b82f6',
      description: label.description || '',
      parentId: label.parentId || null,
    });
    setIsFormOpen(true);
  };

  const handleSaveLabel = async (values: LabelFormValues) => {
    // Duplicate check client-side
    const normalized = values.name.trim().toLowerCase();
    const isDuplicate = rawLabels.some(
      (l) => l.name.toLowerCase() === normalized && l.id !== editingLabel?.id,
    );
    if (isDuplicate) {
      setError('name', { message: `A label with name "${values.name.trim()}" already exists` });
      return;
    }

    try {
      if (editingLabel) {
        await updateMutation.mutateAsync({
          labelId: editingLabel.id,
          name: values.name.trim(),
          color: values.color,
          description: values.description.trim() || null,
          parentId: values.parentId,
        });
      } else {
        await createMutation.mutateAsync({
          name: values.name.trim(),
          color: values.color,
          description: values.description.trim() || undefined,
          parentId: values.parentId || undefined,
        });
      }
      setIsFormOpen(false);
    } catch {
      // Handled by mutation
    }
  };

  const handleUngroup = async (label: Label) => {
    try {
      await updateMutation.mutateAsync({
        labelId: label.id,
        parentId: null,
      });
      toast.success(`Ungrouped "${label.name}"`);
    } catch {
      // Handled by mutation
    }
  };

  const confirmDelete = async () => {
    if (!deletingLabel) return;
    try {
      await deleteMutation.mutateAsync(deletingLabel.id);
      setDeletingLabel(null);
    } catch {
      // Handled by mutation
    }
  };

  if (isLoadingLabels) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="Labels" Icon={Tag} />
        <div className="flex-1 overflow-y-auto px-6 md:px-10 lg:px-12 py-8 md:py-10">
          <div className="w-full max-w-5xl mx-auto space-y-6">
            <Skeleton className="h-8 w-44 rounded-md" />
            <Skeleton className="h-48 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="Labels" Icon={Tag} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Error loading labels.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar
        title="Labels"
        description="Organize, categorize, and group research projects across your account."
        Icon={Tag}
      />

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="w-full max-w-5xl mx-auto space-y-5">
          {/* ── Toolbar ── */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-xs">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search labels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-12 rounded-md border-border bg-background shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-12 text-muted-foreground mr-1 hidden sm:inline-block">
                {allLabelsCount} {allLabelsCount === 1 ? 'label' : 'labels'}
              </span>
              <Button
                size="sm"
                onClick={() => openCreateModal()}
                className="h-8 text-12 font-medium px-3 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-2xs gap-1.5"
              >
                <Plus className="size-3.5 shrink-0" />
                <span>Add label</span>
              </Button>
            </div>
          </div>

          {/* ── Labels Hierarchical List ── */}
          {filteredRoots.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-md border border-dashed border-border bg-card">
              <Tag className="size-8 text-muted-foreground/60 mb-2.5 shrink-0" />
              <h3 className="text-13 font-medium text-foreground">No labels found</h3>
              <p className="text-12 text-muted-foreground mt-1 max-w-sm">
                {searchQuery
                  ? `No labels matching "${searchQuery}".`
                  : 'Create labels to categorize, differentiate, and group research projects across your account.'}
              </p>
              {!searchQuery && (
                <Button
                  size="sm"
                  onClick={() => openCreateModal()}
                  className="mt-4 h-8 text-12 font-medium px-3.5 rounded-md bg-primary text-primary-foreground shadow-2xs cursor-pointer"
                >
                  Create your first label
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRoots.map((root) => {
                const children = childMap[root.id] || [];
                const hasChildren = children.length > 0;
                const isCollapsed = collapsedGroups[root.id] ?? false;

                return (
                  <div
                    key={root.id}
                    className="rounded-md border border-border bg-card overflow-hidden transition-colors shadow-none"
                  >
                    {/* Root Row */}
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-muted/40 transition-colors group">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleGroup(root.id)}
                            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                            title={isCollapsed ? 'Expand group' : 'Collapse group'}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="size-3.5 shrink-0" />
                            ) : (
                              <ChevronDown className="size-3.5 shrink-0" />
                            )}
                          </button>
                        ) : (
                          <div className="size-5" />
                        )}

                        <span
                          className="size-3.5 rounded-full shrink-0 ring-1 ring-border"
                          style={{ backgroundColor: root.color || '#3b82f6' }}
                        />

                        <span className="text-sm font-semibold text-foreground truncate">
                          {root.name}
                        </span>

                        {hasChildren && (
                          <span className="text-11 font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                            {children.length} {children.length === 1 ? 'sub-label' : 'sub-labels'}
                          </span>
                        )}

                        {root.description && (
                          <span className="text-xs text-muted-foreground truncate hidden md:inline max-w-md">
                            — {root.description}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCreateModal(root.id)}
                          className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                          title="Add sub-label inside this group"
                        >
                          <Plus className="size-3.5 shrink-0" />
                          <span className="hidden sm:inline">Add sub-label</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(root)}
                          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit label"
                        >
                          <Pencil className="size-3.5 shrink-0" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingLabel(root)}
                          className="size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Delete label"
                        >
                          <Trash2 className="size-3.5 shrink-0" />
                        </Button>
                      </div>
                    </div>

                    {/* Indented Sub-labels (if expanded) */}
                    {hasChildren && !isCollapsed && (
                      <div className="border-t border-border/60 bg-muted/20 pl-8 pr-3.5 divide-y divide-border/40">
                        {children.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center justify-between gap-3 py-2 text-xs hover:bg-muted/40 transition-colors group/sub px-2 rounded-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <CornerDownRight className="size-3.5 text-muted-foreground/50 shrink-0" />
                              <span
                                className="size-2.5 rounded-full shrink-0 ring-1 ring-border"
                                style={{ backgroundColor: child.color || '#3b82f6' }}
                              />
                              <span className="font-medium text-foreground truncate">
                                {child.name}
                              </span>
                              {child.description && (
                                <span className="text-muted-foreground truncate hidden md:inline">
                                  — {child.description}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUngroup(child)}
                                className="h-6 text-11 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Ungroup into independent label"
                              >
                                Ungroup
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(child)}
                                className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Edit sub-label"
                              >
                                <Pencil className="size-3 shrink-0" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingLabel(child)}
                                className="size-6 text-muted-foreground hover:text-destructive cursor-pointer"
                                title="Delete sub-label"
                              >
                                <Trash2 className="size-3 shrink-0" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Create / Edit Label Modal ── */}
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="sm:max-w-md p-5 bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-foreground">
                  {editingLabel ? 'Edit Label' : formParentId ? 'Add Sub-label' : 'Create Label'}
                </DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={handleSubmit(handleSaveLabel)} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Label Name *</label>
                    <Input
                      placeholder="e.g. Theoretical Physics, Quantum Optics, Clinical Trials"
                      {...register('name')}
                      maxLength={255}
                      autoFocus
                      className={cn(
                        "h-8.5 text-xs bg-background border-border",
                        errors.name && "border-destructive focus-visible:ring-destructive/30"
                      )}
                    />
                    {errors.name && (
                      <p className="text-11 text-destructive pl-0.5">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Color Palette */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Color Palette</label>
                    <div className="grid grid-cols-5 gap-2">
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setValue('color', c.hex, { shouldValidate: true })}
                          className={cn(
                            'h-7 rounded flex items-center justify-center gap-1.5 text-xs font-medium text-white transition-transform cursor-pointer shadow-none',
                            formColor.toLowerCase() === c.hex.toLowerCase() &&
                              'ring-2 ring-primary ring-offset-1 ring-offset-background scale-105',
                          )}
                          style={{ backgroundColor: c.hex }}
                        >
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">Custom Hex:</span>
                      <Input
                        value={formColor}
                        onChange={(e) => setValue('color', e.target.value, { shouldValidate: true })}
                        className={cn(
                          "h-7 w-28 text-xs font-mono bg-background border-border",
                          errors.color && "border-destructive"
                        )}
                        placeholder="#000000"
                      />
                    </div>
                    {errors.color && (
                      <p className="text-11 text-destructive pl-0.5">{errors.color.message}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                    <Input
                      placeholder="Context or criteria for applying this label"
                      {...register('description')}
                      maxLength={1000}
                      className="h-8.5 text-xs bg-background border-border"
                    />
                  </div>

                  {/* Parent Selection (Strict 1-Level Nesting) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Parent Group (Optional)</label>
                    <select
                      value={formParentId || ''}
                      onChange={(e) => setValue('parentId', e.target.value || null)}
                      disabled={Boolean(editingLabel && childMap[editingLabel.id]?.length > 0)}
                      className="w-full h-8.5 text-xs rounded-md border border-border bg-background px-3 text-foreground outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    >
                      <option value="">None (Independent Root Label)</option>
                      {rootLabels
                        .filter((r) => r.id !== editingLabel?.id)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                    {editingLabel && childMap[editingLabel.id]?.length > 0 && (
                      <p className="text-11 text-muted-foreground">
                        This label contains sub-labels. Nesting is limited to 1 level deep.
                      </p>
                    )}
                  </div>

                  <DialogFooter className="pt-3 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFormOpen(false)}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="h-8 text-xs px-4"
                    >
                      {editingLabel ? 'Save Changes' : 'Create Label'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* ── Safe Cascade Delete Modal ── */}
          <DeleteModal
            isOpen={Boolean(deletingLabel)}
            onClose={() => setDeletingLabel(null)}
            onConfirm={confirmDelete}
            loading={deleteMutation.isPending}
            title="Delete label"
            description={
              deletingLabel && childMap[deletingLabel.id]?.length > 0
                ? `Warning: "${deletingLabel.name}" contains ${childMap[deletingLabel.id].length} sub-labels. Deleting this parent group will delete all sub-labels.`
                : `Are you sure you want to delete "${deletingLabel?.name || ''}"?`
            }
            confirmText="Delete permanently"
            cancelText="Cancel"
          />
        </div>
      </div>
    </div>
  );
}
