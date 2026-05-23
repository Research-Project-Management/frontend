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
  showCollection = true,
}: {
  paper: Paper;
  collection: Collection | null;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: (p: Paper) => void;
  showCollection?: boolean;
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
        "group cursor-pointer border-b border-border/30 transition-all duration-200 select-none",
        isSelected 
          ? "bg-[#3370ff]/[0.04] hover:bg-[#3370ff]/[0.06] border-l-[3px] border-l-primary" 
          : "hover:bg-slate-50/80 border-l-[3px] border-l-transparent",
      )}
    >
      <td className="w-14 pl-4 pr-1 py-3.5 align-middle text-center select-none">
        <div className={cn(
          "flex size-7 items-center justify-center rounded-md transition-all duration-200",
          isSelected ? "bg-primary/10" : "bg-zinc-100 group-hover:bg-primary/10"
        )}>
          <FileText
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110",
              isSelected ? "text-primary font-semibold" : "text-zinc-400 group-hover:text-primary",
            )}
          />
        </div>
      </td>

      <td className="py-3.5 pr-4 align-middle overflow-hidden select-none">
        <span
          className={cn(
            "text-sm overflow-hidden text-ellipsis whitespace-nowrap block transition-colors duration-200",
            isSelected ? "font-semibold text-primary" : "font-medium text-[#202222] group-hover:text-primary"
          )}
          title={paper.title}
        >
          {paper.title}
        </span>
      </td>

      <td className="py-3.5 pr-4 align-middle overflow-hidden max-w-[200px] select-none">
        <span
          className="text-xs text-[#5f6368]/90 overflow-hidden text-ellipsis whitespace-nowrap block font-normal"
          title={paper.authors.join(", ")}
        >
          {paper.authors.length > 0 ? paper.authors.join(", ") : <span className="opacity-30">—</span>}
        </span>
      </td>

      <td className="py-3.5 pr-3 align-middle w-[60px] text-xs whitespace-nowrap text-[#5f6368]/90 font-medium select-none">
        {paper.year ?? <span className="opacity-30">—</span>}
      </td>

      <td className="py-3.5 pr-3 align-middle w-[150px] overflow-hidden select-none">
        <span
          className="text-xs text-[#5f6368]/80 overflow-hidden text-ellipsis whitespace-nowrap block italic"
          title={paper.journal || paper.publisher || ""}
        >
          {paper.journal || paper.publisher || <span className="opacity-30">—</span>}
        </span>
      </td>

      {showCollection && (
        <td className="py-3.5 pr-2 align-middle w-[120px] overflow-hidden select-none">
          {collection ? (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-semibold max-w-full overflow-hidden border transition-all duration-200"
              style={{
                backgroundColor: `${collection.color || "#3370ff"}0a`,
                color: collection.color || "#3370ff",
                borderColor: `${collection.color || "#3370ff"}1e`,
              }}
            >
              <span className="truncate">{collection.name}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/30 select-none">—</span>
          )}
        </td>
      )}

      <td className="py-3.5 pr-4 align-middle w-[60px] select-none">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {resolvedUrl && (
            <Link
              to={`/${workspaceUrl}/library/papers/${paper._id}/reader`}
              onClick={(e) => e.stopPropagation()}
              className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:text-primary hover:bg-primary/10 transition-all duration-200"
              title="Open Reader"
            >
              <BookOpen className="size-3.5" />
            </Link>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(paper._id); }}
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
