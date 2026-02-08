import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
  MoreHorizontal,
  Plus,
  User,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface Comment {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  line?: number;
  status: "open" | "resolved";
  createdAt: string;
  replies?: number;
}

const mockComments: Comment[] = [
  {
    id: "1",
    author: "John Doe",
    content:
      "Consider using \\cref instead of \\ref for better cross-referencing.",
    line: 42,
    status: "open",
    createdAt: "2 hours ago",
    replies: 2,
  },
  {
    id: "2",
    author: "Jane Smith",
    content: "The equation formatting looks good!",
    line: 58,
    status: "resolved",
    createdAt: "1 day ago",
    replies: 0,
  },
  {
    id: "3",
    author: "Alex Chen",
    content: "Missing citation for this claim.",
    line: 105,
    status: "open",
    createdAt: "3 days ago",
    replies: 5,
  },
];

export default function ReviewTab() {
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const filteredComments = mockComments.filter((comment) => {
    if (filter === "all") return true;
    return comment.status === filter;
  });

  const openCount = mockComments.filter((c) => c.status === "open").length;
  const resolvedCount = mockComments.filter(
    (c) => c.status === "resolved"
  ).length;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex w-full text-primary justify-between items-center px-3 py-3 border-b border-border">
        <span className="font-semibold">Review</span>
        <Tooltip>
          <TooltipTrigger>
            <button className="p-1 hover:bg-primary/10 rounded cursor-pointer">
              <Plus className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Add Comment</TooltipContent>
        </Tooltip>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-border">
        {[
          { key: "all", label: "All", count: mockComments.length },
          { key: "open", label: "Open", count: openCount },
          { key: "resolved", label: "Resolved", count: resolvedCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              filter === tab.key
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-primary hover:bg-primary/5"
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto">
        {filteredComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <MessageSquare className="size-8 mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {filteredComments.map((comment) => (
              <li
                key={comment.id}
                className="px-3 py-3 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="size-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-primary truncate">
                        {comment.author}
                      </span>
                      <div className="flex items-center gap-1">
                        {comment.status === "open" ? (
                          <Circle className="size-3 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="size-3 text-green-500" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-foreground mt-1 line-clamp-2">
                      {comment.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      {comment.line && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">
                          Line {comment.line}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {comment.createdAt}
                      </span>
                      {comment.replies > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="size-3" />
                          {comment.replies}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
