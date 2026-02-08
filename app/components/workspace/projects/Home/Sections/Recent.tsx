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
                className="flex items-center gap-4 px-2 transition-all duration-200 cursor-pointer group"
              >
                <span className="text-xl">{item.icon}</span>

                <span className="font-medium hover:underline underline-offset-2 text-gray-900 group-hover:text-primary transition-all">
                  {item.name}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(item.lastEdited), { addSuffix: true })}
                </span>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary" />
                </div>
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
