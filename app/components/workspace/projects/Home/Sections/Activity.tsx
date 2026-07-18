import React from "react";
import HomeSection from "../HomeSection";
import { useActivityFeed } from "~/query/workspace";
import { useParams, Link } from "react-router";
import { formatDistanceToNow } from "date-fns";
import { Loader2, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export default function Activity() {
  const { workspaceId } = useParams();
  const { data: activities, isLoading } = useActivityFeed(workspaceId!);

  return (
    <HomeSection title="Activity">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : activities && activities.length > 0 ? (
        <div className="space-y-2">
          {activities.map((activity, index) => (
            <Link
              key={index}
              to={
                activity.type === "page_update" && activity.project
                  ? `/${workspaceId}/projects/${activity.project._id}/pages/${activity.itemId}`
                  : activity.type === "task_update" && activity.project
                  ? `/${workspaceId}/projects/${activity.project._id}/tasks`
                  : activity.type === "file_upload" && activity.project
                  ? `/${workspaceId}/projects/${activity.project._id}/storage`
                  : activity.project
                  ? `/${workspaceId}/projects/${activity.project._id}/overview`
                  : `/${workspaceId}`
              }
              className="p-3 flex items-center gap-4 bg-card border border-border/40 rounded-lg hover:bg-secondary/60 hover:border-border/60 transition-all group cursor-pointer"
            >
              <Avatar className="size-8">
                <AvatarImage src={activity.user?.avatar} />
                <AvatarFallback>
                  <User className="size-4" />
                </AvatarFallback>
              </Avatar>
              <p className="text-muted-foreground flex-1">
                <span className="font-semibold text-foreground group-hover:text-primary">
                  {activity.user?.name || "Someone"}
                </span>{" "}
                {activity.content}
              </p>
              {activity.project && (
                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tighter shrink-0 group-hover:text-muted-foreground">
                  {activity.project.name}
                </span>
              )}
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {formatDistanceToNow(new Date(activity.time), {
                  addSuffix: true,
                })}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-4 min-h-32 bg-secondary rounded-lg text-center flex items-center justify-center text-gray-500">
          No recent activity.
        </div>
      )}
    </HomeSection>
  );
}
