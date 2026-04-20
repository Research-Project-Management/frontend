import React from "react";
import HomeSection from "../HomeSection";
import { ChevronRight, Loader2 } from "lucide-react";
import { useRecentItems } from "~/query/workspace-home";
import { useParams, Link } from "react-router";
import { formatDistanceToNow } from "date-fns";

export default function Recent() {
  const { workspaceId } = useParams();
  const { data: items, isLoading } = useRecentItems(workspaceId!);

  return (
    <HomeSection title="Recent">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : items && items.length > 0 ? (
        <div className="grid gap-2">
          {items.map((item) => {
            const linkTo =
              item.type === "project"
                ? `/workspace/${workspaceId}/project/${item.id}/overview`
                : item.type === "page" && item.project
                  ? `/workspace/${workspaceId}/project/${item.project._id}/page/${item.id}`
                  : `/workspace/${workspaceId}/storage`;

            return (
              <Link
                key={item.id}
                to={linkTo}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent
                           hover:bg-secondary/60 hover:border-border/40 transition-all duration-200 group cursor-pointer"
              >
                <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">{item.icon}</span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.type !== "project" && item.project && (
                      <>
                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
                          {item.project.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/20">•</span>
                      </>
                    )}
                    <span className="text-[10px] font-medium text-muted-foreground/60">
                      {formatDistanceToNow(new Date(item.lastEdited), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>

                <ChevronRight
                  className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary
                                        opacity-0 group-hover:opacity-100 transition-all shrink-0"
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="p-8 bg-secondary/20 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
          No recent items
        </div>
      )}
    </HomeSection>
  );
}
