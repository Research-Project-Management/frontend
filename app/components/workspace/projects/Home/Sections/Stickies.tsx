import { useCallback, useMemo } from "react";
import { useParams, Link } from "react-router";
import { Plus, ArrowRight, Loader2 } from "lucide-react";
import { useStickies, useCreateSticky, useDeleteSticky } from "~/query/sticky";
import {
  type Note,
  NOTE_COLOR_MAP,
  NOTE_COLOR_CYCLE,
} from "~/types/sticky";
import HomeSection from "../HomeSection";

// Strip HTML tags → plain text for preview
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Mini card ───────────────────────────────────────────────────────────────

function MiniCard({
  note,
  workspaceUrl,
}: {
  note: Note;
  workspaceUrl: string;
}) {
  const colorConfig = NOTE_COLOR_MAP[note.color];
  const accentStyle = {
    backgroundColor: colorConfig.bg,
    filter: "brightness(0.85)",
  };
  const plainContent = useMemo(
    () => stripHtml(note.content || ""),
    [note.content],
  );

  return (
    <Link
      to={`/${workspaceUrl}/stickies`}
      className="group relative flex flex-col rounded-md overflow-hidden shadow-sm
                 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{ backgroundColor: colorConfig.bg, color: colorConfig.text }}
    >
      {/* Accent bar */}
      <div className="h-1.5 w-full shrink-0" style={accentStyle} />

      {/* Body */}
      <div className="flex flex-col gap-1 px-3 py-2.5">
        {note.title ? (
          <p className="text-sm font-semibold leading-snug truncate">
            {note.title}
          </p>
        ) : null}
        <p className="text-xs leading-relaxed line-clamp-4 opacity-70">
          {plainContent || (
            <span className="italic opacity-50">Empty note</span>
          )}
        </p>
      </div>

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-2.5 mt-auto">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag._id}
              className="px-1.5 py-0.5 text-[9px] rounded font-semibold text-white leading-none"
              style={{ backgroundColor: tag.color || "#aaa" }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ─── Add card ────────────────────────────────────────────────────────────────

function AddCard({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2
                 border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/5
                 text-muted-foreground/40 hover:text-primary/60 transition-all duration-200
                 disabled:opacity-40 disabled:cursor-not-allowed min-h-24"
    >
      {disabled ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Plus className="h-4 w-4" />
          <span className="text-xs font-medium">New note</span>
        </>
      )}
    </button>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export default function Stickies() {
  const { workspaceId } = useParams();
  const { data: notes = [], isLoading } = useStickies(workspaceId || "", []);
  const createSticky = useCreateSticky();
  const deleteSticky = useDeleteSticky();

  const handleAdd = useCallback(() => {
    if (!workspaceId) return;
    const lastColor = notes[0]?.color;
    const idx = lastColor ? NOTE_COLOR_CYCLE.indexOf(lastColor) : -1;
    const color = NOTE_COLOR_CYCLE[(idx + 1) % NOTE_COLOR_CYCLE.length];
    createSticky.mutate({
      workspaceId,
      content: "<p></p>",
      color,
      title: "",
      position: { x: 0, y: 0 },
    });
  }, [workspaceId, notes, createSticky]);

  const preview = useMemo(() => notes.slice(0, 5), [notes]);

  const viewAllAction = notes.length > 0 && (
    <Link
      to={`/${workspaceId}/stickies`}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      View all
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
  return (
    <HomeSection title="Quick Notes" action={viewAllAction}>
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {preview.map((note) => (
            <MiniCard
              workspaceUrl={workspaceId || ""}
              key={note._id}
              note={note}
            />
          ))}
          <AddCard onClick={handleAdd} disabled={createSticky.isPending} />
        </div>
      )}
    </HomeSection>
  );
}
