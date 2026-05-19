import { FileText, ExternalLink, Trash2, User, CalendarDays } from "lucide-react";
import { cn } from "~/lib/utils";
import { API_URL } from "~/lib/api";
import type { Paper } from "~/types/library";

interface Props {
  paper: Paper;
  onDelete: (id: string) => void;
}

export default function PaperRow({ paper, onDelete }: Props) {
  const resolvedUrl = paper.fileUrl?.startsWith("/api/files/")
    ? `${API_URL}${paper.fileUrl}`
    : paper.fileUrl;

  return (
    <div
      className={cn(
        "group flex items-start gap-4 rounded-lg border border-border bg-card px-4 py-3",
        "transition-all duration-150 hover:shadow-sm hover:border-primary/20",
      )}
    >
      {/* Icon */}
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <FileText className="size-5 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-semibold text-foreground line-clamp-1">
          {paper.title}
        </p>

        {paper.authors.length > 0 && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="size-3 shrink-0" />
            {paper.authors.join(", ")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {paper.year && (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" />
              {paper.year}
            </span>
          )}
          {paper.doi && (
            <span className="truncate max-w-[200px]">DOI: {paper.doi}</span>
          )}
          {paper.journal && (
            <span className="italic truncate max-w-[180px]">{paper.journal}</span>
          )}
        </div>

        {paper.abstract && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {paper.abstract}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {resolvedUrl && (
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Open PDF"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
        <button
          onClick={() => onDelete(paper._id)}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete paper"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
