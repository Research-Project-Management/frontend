import { BookOpen, ExternalLink, FileText, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router";
import { cn } from "~/lib/utils";
import { API_URL } from "~/lib/api";
import type { Paper, Collection } from "~/types/library";

export function PaperTableRow({
  paper,
  collection,
  onDelete,
  isSelected,
  onSelect,
}: {
  paper: Paper;
  collection: Collection | null;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: (p: Paper) => void;
}) {
  const { workspaceId: workspaceUrl } = useParams();
  const resolvedUrl = paper.fileUrl?.startsWith("/api/files/")
    ? `${API_URL}${paper.fileUrl}`
    : paper.fileUrl;

  return (
    <tr
      onClick={() => onSelect(paper)}
      className={cn(
        "group cursor-pointer border-b border-border/50 transition-colors",
        isSelected ? "bg-primary/10" : "hover:bg-accent/40",
      )}
    >
      <td className="w-8 pl-3 pr-2 py-2 align-middle">
        <FileText
          className={cn(
            "size-4 shrink-0",
            isSelected ? "text-primary" : "text-muted-foreground/60",
          )}
        />
      </td>

      <td className="py-2 pr-4 align-middle overflow-hidden">
        <span
          className={cn(
            "text-sm overflow-hidden text-ellipsis whitespace-nowrap block",
            isSelected ? "font-semibold text-primary" : "font-medium text-foreground"
          )}
          title={paper.title}
        >
          {paper.title}
        </span>
      </td>

      <td className="py-2 pr-4 align-middle overflow-hidden max-w-[200px]">
        <span
          className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap block"
          title={paper.authors.join(", ")}
        >
          {paper.authors.length > 0 ? paper.authors.join(", ") : <span className="opacity-30">—</span>}
        </span>
      </td>

      <td className="py-2 pr-3 align-middle w-[60px] text-xs whitespace-nowrap text-muted-foreground">
        {paper.year ?? <span className="opacity-30">—</span>}
      </td>

      <td className="py-2 pr-3 align-middle w-[150px] overflow-hidden">
        <span
          className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap block"
          title={paper.journal || paper.publisher || ""}
        >
          {paper.journal || paper.publisher || <span className="opacity-30">—</span>}
        </span>
      </td>

      <td className="py-2 pr-2 align-middle w-[120px] overflow-hidden">
        {collection ? (
          <span
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium max-w-full overflow-hidden"
            style={{
              backgroundColor: `${collection.color || "#3370ff"}15`,
              color: collection.color || "#3370ff",
            }}
          >
            <span className="truncate">{collection.name}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/30">—</span>
        )}
      </td>

      <td className="py-2 pr-2 align-middle w-[60px]">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {resolvedUrl && (
            <Link
              to={`/${workspaceUrl}/library/papers/${paper._id}/reader`}
              onClick={(e) => e.stopPropagation()}
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Open Reader"
            >
              <BookOpen className="size-3" />
            </Link>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(paper._id); }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
