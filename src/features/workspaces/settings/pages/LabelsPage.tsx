'use client';

import React, { useState, useMemo } from 'react';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/components/ui";
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

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formDescription, setFormDescription] = useState('');
  const [formParentId, setFormParentId] = useState<string | null>(null);

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

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openCreateModal = (parentId?: string) => {
    setEditingLabel(null);
    setFormName('');
    setFormColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].hex);
    setFormDescription('');
    setFormParentId(parentId || null);
    setIsFormOpen(true);
  };

  const openEditModal = (label: Label) => {
    setEditingLabel(label);
    setFormName(label.name);
    setFormColor(label.color || '#3b82f6');
    setFormDescription(label.description || '');
    setFormParentId(label.parentId || null);
    setIsFormOpen(true);
  };

  const handleSaveLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Label name is required');
      return;
    }

    // Duplicate check client-side
    const normalized = formName.trim().toLowerCase();
    const isDuplicate = rawLabels.some(
      (l) => l.name.toLowerCase() === normalized && l.id !== editingLabel?.id,
    );
    if (isDuplicate) {
      toast.error(`A label with name "${formName.trim()}" already exists`);
      return;
    }

    try {
      if (editingLabel) {
        await updateMutation.mutateAsync({
          labelId: editingLabel.id,
          name: formName.trim(),
          color: formColor,
          description: formDescription.trim() || null,
          parentId: formParentId,
        });
      } else {
        await createMutation.mutateAsync({
          name: formName.trim(),
          color: formColor,
          description: formDescription.trim() || undefined,
          parentId: formParentId || undefined,
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
      <TopBar title="Labels" Icon={Tag} />

      <div className="flex-1 overflow-y-auto px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="w-full max-w-5xl mx-auto space-y-8">
          {/* ── Page Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">Labels</h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {allLabelsCount}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Organize, categorize, and group research projects across your account, similar to labels in Overleaf and Google Drive.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => openCreateModal()}
                className="h-8 text-xs font-medium px-3.5 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none gap-1.5"
              >
                <Plus className="size-3.5 shrink-0" />
                <span>Add label</span>
              </Button>
            </div>
          </div>

          {/* ── Search Bar ── */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search labels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 pl-8 text-xs rounded-md border-border bg-background"
              />
            </div>
          </div>

          {/* ── Labels Hierarchical List ── */}
          {filteredRoots.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-md border border-dashed border-border bg-card">
              <Tag className="size-9 text-muted-foreground/60 mb-3 shrink-0" />
              <h3 className="text-sm font-semibold text-foreground">No labels found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {searchQuery
                  ? `No labels matching "${searchQuery}".`
                  : 'Create labels to categorize, differentiate, and group research projects across your account.'}
              </p>
              {!searchQuery && (
                <Button
                  size="sm"
                  onClick={() => openCreateModal()}
                  className="mt-4 h-8 text-xs font-medium px-3.5 rounded-md bg-primary text-primary-foreground"
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

              <form onSubmit={handleSaveLabel} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Label Name *</label>
                  <Input
                    placeholder="e.g. Theoretical Physics, Quantum Optics, Clinical Trials"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    maxLength={255}
                    autoFocus
                    className="h-8.5 text-xs bg-background border-border"
                  />
                </div>

                {/* Color Palette */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">Color Palette</label>
                  <div className="grid grid-cols-5 gap-2">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setFormColor(c.hex)}
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
                      onChange={(e) => setFormColor(e.target.value)}
                      className="h-7 w-28 text-xs font-mono bg-background border-border"
                      placeholder="#000000"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                  <Input
                    placeholder="Context or criteria for applying this label"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    maxLength={1000}
                    className="h-8.5 text-xs bg-background border-border"
                  />
                </div>

                {/* Parent Selection (Strict 1-Level Nesting) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Parent Group (Optional)</label>
                  <select
                    value={formParentId || ''}
                    onChange={(e) => setFormParentId(e.target.value || null)}
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
                    disabled={!formName.trim() || createMutation.isPending || updateMutation.isPending}
                    className="h-8 text-xs px-4"
                  >
                    {editingLabel ? 'Save Changes' : 'Create Label'}
                  </Button>
                </DialogFooter>
              </form>
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
