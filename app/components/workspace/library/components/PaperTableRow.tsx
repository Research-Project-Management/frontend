import { BookOpen, FileText, Trash2 } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router";
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
  const navigate = useNavigate();
  const resolvedUrl = paper.fileUrl?.startsWith("/api/files/")
    ? `${API_URL}${paper.fileUrl}`
    : paper.fileUrl;

  const handleDoubleClick = () => {
    if (resolvedUrl) {
      navigate(`/${workspaceUrl}/library/papers/${paper._id}/reader`);
    }
  };

  return (
    <tr
      onClick={() => onSelect(paper)}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "group cursor-pointer border-b border-border/40 transition-all duration-150 select-none",
        isSelected 
          ? "bg-primary/[0.06] hover:bg-primary/[0.08] border-l-2 border-l-primary" 
          : "hover:bg-muted/50 border-l-2 border-l-transparent",
      )}
    >
      <td className="w-8 pl-3 pr-2 py-3 align-middle text-center">
        <FileText
          className={cn(
            "size-4 shrink-0 transition-transform group-hover:scale-105",
            isSelected ? "text-primary font-semibold" : "text-muted-foreground/60 group-hover:text-muted-foreground",
          )}
        />
      </td>

      <td className="py-3 pr-4 align-middle overflow-hidden">
        <span
          className={cn(
            "text-sm overflow-hidden text-ellipsis whitespace-nowrap block transition-colors",
            isSelected ? "font-semibold text-primary" : "font-medium text-foreground group-hover:text-primary"
          )}
          title={paper.title}
        >
          {paper.title}
        </span>
      </td>

      <td className="py-3 pr-4 align-middle overflow-hidden max-w-[200px]">
        <span
          className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap block"
          title={paper.authors.join(", ")}
        >
          {paper.authors.length > 0 ? paper.authors.join(", ") : <span className="opacity-30">—</span>}
        </span>
      </td>

      <td className="py-3 pr-3 align-middle w-[60px] text-xs whitespace-nowrap text-muted-foreground font-medium">
        {paper.year ?? <span className="opacity-30">—</span>}
      </td>

      <td className="py-3 pr-3 align-middle w-[150px] overflow-hidden">
        <span
          className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap block"
          title={paper.journal || paper.publisher || ""}
        >
          {paper.journal || paper.publisher || <span className="opacity-30">—</span>}
        </span>
      </td>

      <td className="py-3 pr-2 align-middle w-[120px] overflow-hidden">
        {collection ? (
          <span
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold max-w-full overflow-hidden"
            style={{
              backgroundColor: `${collection.color || "#3370ff"}12`,
              color: collection.color || "#3370ff",
            }}
          >
            <span className="truncate">{collection.name}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/30">—</span>
        )}
      </td>

      <td className="py-3 pr-3 align-middle w-[60px]">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {resolvedUrl && (
            <Link
              to={`/${workspaceUrl}/library/papers/${paper._id}/reader`}
              onClick={(e) => e.stopPropagation()}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Open Reader"
            >
              <BookOpen className="size-3.5" />
            </Link>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(paper._id); }}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
