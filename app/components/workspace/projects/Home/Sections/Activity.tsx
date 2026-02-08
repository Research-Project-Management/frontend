import React from "react";
import HomeSection from "../HomeSection";
import { useActivityFeed } from "~/query/workspace-home";
import { useParams } from "react-router";
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
            <div
              key={index}
              className="p-2 py-2 flex items-center gap-4 bg-white border-gray-200 rounded-lg"
            >
              <Avatar className="size-8">
                <AvatarImage src={activity.user?.avatar} />
                <AvatarFallback>
                  <User className="size-4" />
                </AvatarFallback>
              </Avatar>
              <p className="text-primary/60 flex-1">
                <span className="font-semibold text-primary">
                  {activity.user?.name || "Someone"}
                </span>{" "}
                {activity.content}
              </p>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
              </span>
            </div>
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
