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
        <div className="grid gap-3">
          {items.map((item) => {
            const linkTo =
              item.type === "project"
                ? `/workspace/${workspaceId}/${item.id}`
                : item.type === "page" && item.project
                  ? `/workspace/${workspaceId}/${item.project._id}/page/${item.id}`
                  : `/workspace/${workspaceId}/storage`;

            return (
              <Link
                key={item.id}
                to={linkTo}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent
                           hover:bg-secondary/60 hover:border-border/40 transition-all duration-150 group cursor-pointer"
              >
                <span className="text-base shrink-0">{item.icon}</span>

                <span className="flex-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {item.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(item.lastEdited), {
                    addSuffix: true,
                  })}
                </span>

                <ChevronRight
                  className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary
                                        opacity-0 group-hover:opacity-100 transition-all shrink-0"
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="p-4 min-h-32 bg-secondary rounded-lg text-center flex items-center justify-center text-gray-500">
          No recent items
        </div>
      )}
    </HomeSection>
  );
}
