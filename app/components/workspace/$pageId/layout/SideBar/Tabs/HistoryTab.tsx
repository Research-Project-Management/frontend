import React, { useState } from "react";
import { useParams } from "react-router";
import {
  Clock,
  FilePlus2,
  FileText,
  FileX2,
  FolderClock,
  History,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  usePageVersions,
  useSavePageVersion,
  useRestorePageVersion,
  useDeletePageVersion,
  useProjectHistory,
  useRestoreProjectToEvent,
} from "~/query/page";
import type { PageEvent } from "~/types/page";
import { usePageContext } from "../../PageContext";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";

type View = "file" | "project";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

const EVENT_META: Record<
  PageEvent["eventType"],
  {
    icon: React.ElementType;
    color: string;
    label: (e: PageEvent) => string;
  }
> = {
  manual_save: {
    icon: Save,
    color: "text-primary",
    label: (e) => e.label || `Saved "${e.fileName}"`,
  },
  auto_save: {
    icon: Clock,
    color: "text-muted-foreground",
    label: (e) => `Auto-saved "${e.fileName}"`,
  },
  file_created: {
    icon: FilePlus2,
    color: "text-green-500",
    label: (e) => `Created "${e.fileName}"`,
  },
  file_deleted: {
    icon: FileX2,
    color: "text-destructive",
    label: (e) => `Deleted "${e.fileName}"`,
  },
  asset_uploaded: {
    icon: Upload,
    color: "text-blue-500",
    label: (e) => `Uploaded "${e.fileName}"`,
  },
  asset_deleted: {
    icon: Trash2,
    color: "text-destructive",
    label: (e) => `Removed "${e.fileName}"`,
  },
};

export default function HistoryTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const { currentPage, editorRef } = usePageContext();

  /** The root page ID for this project (used for project-level history). */
  const rootPageId = currentPage
    ? currentPage.parentPage
      ? String(currentPage.parentPage)
      : currentPage._id
    : null;

  const [view, setView] = useState<View>("project");
  const [labelInput, setLabelInput] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // ── "This file" data ────────────────────────────────────────────────────────
  const { data: versions, isLoading: versionsLoading } = usePageVersions(
    pageId ?? null,
  );
  const saveMutation = useSavePageVersion();
  const restoreFileMutation = useRestorePageVersion();
  const deleteMutation = useDeletePageVersion();

  // ── "Project" data ──────────────────────────────────────────────────────────
  const { data: events, isLoading: eventsLoading } =
    useProjectHistory(rootPageId);
  const restoreProjectMutation = useRestoreProjectToEvent();

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!pageId) return;
    saveMutation.mutate(
      { pageId, label: labelInput.trim(), rootPageId: rootPageId ?? undefined },
      { onSuccess: () => setLabelInput("") },
    );
  };

  const handleRestoreFile = (versionId: string) => {
    if (!pageId) return;
    restoreFileMutation.mutate(
      { pageId, versionId },
      {
        onSuccess: (restoredPage) => {
          if (restoredPage.content !== undefined)
            editorRef.current?.setValue(restoredPage.content);
          setConfirmId(null);
        },
      },
    );
  };

  const handleRestoreProject = (eventId: string) => {
    if (!rootPageId) return;
    restoreProjectMutation.mutate(
      { rootPageId, eventId },
      {
        onSuccess: (data) => {
          const me = data.restored.find((r) => r.pageId === pageId);
          if (me) editorRef.current?.setValue(me.content);
          setConfirmId(null);
        },
      },
    );
  };

  // Group project events by day for display
  const groupedEvents = React.useMemo(() => {
    if (!events) return [] as { label: string; items: PageEvent[] }[];
    const days: { label: string; items: PageEvent[] }[] = [];
    let curDay = "";
    for (const e of events) {
      const day = formatDay(e.createdAt);
      if (day !== curDay) {
        days.push({ label: day, items: [] });
        curDay = day;
      }
      days[days.length - 1].items.push(e);
    }
    return days;
  }, [events]);

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-8 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          History
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* View toggle */}
      <div className="flex px-2 py-1.5 gap-1 border-b border-border shrink-0">
        <button
          onClick={() => setView("file")}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
            view === "file"
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <FileText className="size-3" />
          This File
        </button>
        <button
          onClick={() => setView("project")}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
            view === "project"
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <FolderClock className="size-3" />
          Project
        </button>
      </div>

      {/* ── "This File" view ─────────────────────────────────────────────────── */}
      {view === "file" && (
        <>
          {/* Save snapshot */}
          <div className="px-2 py-2 border-b border-border shrink-0 flex gap-1.5">
            <Input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Label (optional)"
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              title="Save current file as a snapshot"
              className="flex items-center gap-1 h-7 px-2 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </button>
          </div>

          {/* File version list */}
          <div className="flex-1 overflow-y-auto py-1">
            {versionsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : !versions?.length ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <History className="size-7 opacity-25" />
                <p className="text-xs text-center leading-relaxed">
                  No snapshots yet.
                  <br />
                  Click <strong>Save</strong> to create one.
                </p>
              </div>
            ) : (
              versions.map((v) => (
                <div
                  key={v._id}
                  className="group flex items-start gap-2 px-3 py-2 hover:bg-primary/5 transition-colors"
                >
                  <Clock className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {v.label || "Snapshot"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {timeAgo(v.createdAt)} · {v.savedBy?.name ?? "Unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {confirmId === v._id ? (
                      <>
                        <button
                          onClick={() => handleRestoreFile(v._id)}
                          disabled={restoreFileMutation.isPending}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                        >
                          {restoreFileMutation.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            "Confirm"
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmId(v._id)}
                          title="Restore this file to this snapshot"
                          className="p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            deleteMutation.mutate({
                              pageId: pageId!,
                              versionId: v._id,
                            })
                          }
                          disabled={deleteMutation.isPending}
                          title="Delete snapshot"
                          className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── "Project" view ───────────────────────────────────────────────────── */}
      {view === "project" && (
        <div className="flex-1 overflow-y-auto py-1">
          {eventsLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : !groupedEvents.length ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <History className="size-7 opacity-25" />
              <p className="text-xs text-center leading-relaxed px-4">
                No activity yet.
                <br />
                Changes are tracked automatically.
              </p>
            </div>
          ) : (
            groupedEvents.map(({ label: dayLabel, items }) => (
              <div key={dayLabel}>
                {/* Day separator */}
                <div className="sticky top-0 z-10 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-background border-b border-border/50">
                  {dayLabel}
                </div>

                {items.map((evt) => {
                  const meta = EVENT_META[evt.eventType];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  // Only manual_save events can trigger a project-wide restore
                  const canRestore = evt.eventType === "manual_save";

                  return (
                    <div
                      key={evt._id}
                      className="group flex items-start gap-2 px-3 py-2 hover:bg-primary/5 transition-colors"
                    >
                      <Icon
                        className={cn("size-3.5 shrink-0 mt-0.5", meta.color)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {meta.label(evt)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {timeAgo(evt.createdAt)} ·{" "}
                          {evt.savedBy?.name ?? "Unknown"}
                        </p>
                      </div>

                      {canRestore && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {confirmId === evt._id ? (
                            <>
                              <button
                                onClick={() => handleRestoreProject(evt._id)}
                                disabled={restoreProjectMutation.isPending}
                                title="Restore all project files to this snapshot"
                                className="text-[10px] px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                              >
                                {restoreProjectMutation.isPending ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  "Confirm"
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmId(null)}
                                className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:bg-muted transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmId(evt._id)}
                              title="Restore all project files to their state at this snapshot"
                              className="p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
