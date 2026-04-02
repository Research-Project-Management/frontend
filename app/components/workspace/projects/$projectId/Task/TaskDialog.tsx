import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

import type { Task, Column, TaskMutationInput } from "~/types/task";
import { DEFAULT_TASK_COLUMN_COLORS } from "~/types/task";
import { useProjectDetails } from "~/query/project";
import {
  AlignLeft,
  Calendar,
  Copy,
  Link2,
  MoreHorizontal,
  Paperclip,
  Send,
  Tag,
  Trash2,
  UserRound,
  X,
  CheckSquare,
  MessageSquare,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  card?: Partial<Task>;
  columns: Column[];
  onSave: (card: TaskMutationInput) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
};

type ActivityEntry = {
  id: string;
  author: string;
  authorInitials: string;
  avatarColor: string;
  content: string;
  timestamp: string;
  isComment: boolean;
};

export function TaskDialog({
  open,
  onOpenChange,
  mode,
  card,
  columns,
  onSave,
  onDelete,
  onDuplicate,
}: TaskDialogProps) {
  const { projectId } = useParams();
  const { data: projectData } = useProjectDetails(projectId!);
  const members = projectData?.project?.members || [];
  const firstColumnId = columns[0]?.id ?? columns[0]?._id ?? "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState(firstColumnId);
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);

  const [commentText, setCommentText] = useState("");
  const [showDetailActivity, setShowDetailActivity] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Mock activity / comments for display
  const [activities] = useState<ActivityEntry[]>(() => {
    if (card?.createdAt) {
      const createdDate = new Date(card.createdAt);
      return [
        {
          id: "act-1",
          author: "Người dùng",
          authorInitials: "ND",
          avatarColor: "#F59E0B",
          content: `đã thêm thẻ này vào danh sách ${columns.find(c => (c.id ?? c._id) === card.columnId)?.title ?? ""}`,
          timestamp: createdDate.toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "numeric",
            month: "numeric",
            year: "numeric",
          }),
          isComment: false,
        },
      ];
    }
    return [];
  });

  useEffect(() => {
    if (open && card) {
      setTitle(card.title || "");
      setDescription(card.description || card.content || "");
      setColumnId(card.columnId || firstColumnId);
      setLabels(card.labels || []);
      setDueDate(
        card.dueDate ? new Date(card.dueDate).toISOString().split("T")[0] : ""
      );
      const a = card.assignee;
      setAssigneeId(a && typeof a === "object" ? a._id : (a as string | null | undefined) ?? null);
    } else if (open && !card) {
      setTitle("");
      setDescription("");
      setColumnId(firstColumnId);
      setLabels([]);
      setDueDate("");
      setAssigneeId(null);
    }
    setCommentText("");
    setIsEditingTitle(false);
    setIsEditingDesc(false);
  }, [open, card, firstColumnId]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      content: description,
      description,
      columnId,
      dueDate: dueDate || undefined,
      labels,
      assignee: assigneeId,
    });
  };

  const selectedColumn = columns.find(
    (c) => (c.id ?? c._id ?? "") === columnId
  );
  const columnColor =
    DEFAULT_TASK_COLUMN_COLORS[columnId] ||
    selectedColumn?.accentColor ||
    "#6B7280";

  const assignee = members.find((m: any) => m.user._id === assigneeId);
  const assigneeName = assignee?.user?.name;

  const quickActionButtonClass =
    "h-8 rounded-lg border-border/60 bg-background/90 px-3 text-xs text-foreground/90 shadow-sm transition-all duration-200 hover:border-border hover:bg-accent/50 hover:text-foreground";

  const quickActionTriggerClass =
    "h-8 min-w-[130px] rounded-lg border-border/60 bg-background/90 px-3 text-xs text-foreground/90 shadow-sm transition-all duration-200 hover:border-border hover:bg-accent/50 hover:text-foreground focus:ring-0";

  const cardAttachment = card && mode === "edit" ? {
    projectName: projectData?.project?.name || "Project",
    listName: selectedColumn?.title || "",
    cardTitle: card.title || "",
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden rounded-2xl border-border/60 shadow-2xl"
        style={{ maxWidth: "860px", width: "90vw", maxHeight: "90vh" }}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {mode === "add" ? "Tạo nhiệm vụ mới" : title || "Chi tiết nhiệm vụ"}
        </DialogTitle>
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* ── Top bar ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50 shrink-0">
            {/* Column badge – display only, reflects card's current column */}
            <div
              className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-3 h-8 text-xs font-semibold select-none"
              style={{ color: columnColor }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: columnColor }}
              />
              {selectedColumn?.title ?? ""}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {onDuplicate && (
                    <DropdownMenuItem onClick={onDuplicate}>
                      <Copy className="mr-2 h-4 w-4" />
                      Nhân bản
                    </DropdownMenuItem>
                  )}
                  {onDelete && mode === "edit" && (
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Xóa thẻ
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left column */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Title */}
              <div className="flex items-start gap-3">
                <span className="mt-1 h-5 w-5 rounded-full border-2 border-muted-foreground/40 flex-shrink-0 cursor-pointer hover:border-primary transition-colors" />
                {isEditingTitle ? (
                  <textarea
                    ref={titleRef}
                    autoFocus
                    className="flex-1 text-xl font-bold leading-snug resize-none bg-transparent outline-none border-0 ring-0 focus:ring-0 p-0 min-h-[28px] placeholder:text-muted-foreground/40"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    placeholder={
                      mode === "add" ? "Tiêu đề nhiệm vụ..." : "Tiêu đề..."
                    }
                    rows={1}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = el.scrollHeight + "px";
                    }}
                  />
                ) : (
                  <h2
                    className={cn(
                      "flex-1 text-xl font-bold leading-snug cursor-text break-words",
                      !title && "text-muted-foreground/50 italic font-normal"
                    )}
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {title || (mode === "add" ? "Nhập tiêu đề nhiệm vụ..." : "Không có tiêu đề")}
                  </h2>
                )}
              </div>

              {/* Quick actions */}
              <div className="ml-8 flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-2">
                {/* Labels */}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(quickActionButtonClass, "gap-1.5")}
                  onClick={() => {
                    const val = window.prompt(
                      "Nhãn (phân cách bằng dấu phẩy):",
                      labels.join(", ")
                    );
                    if (val !== null) {
                      setLabels(
                        val
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      );
                    }
                  }}
                >
                  <Tag className="h-3 w-3" />
                  <span>{labels.length > 0 ? `${labels.length} nhãn` : "Nhãn"}</span>
                </Button>

                {/* Due date */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(quickActionButtonClass, "gap-1.5")}
                    asChild
                  >
                    <label className="cursor-pointer inline-flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      <span className={cn(!dueDate && "text-muted-foreground")}>{dueDate
                        ? new Date(dueDate).toLocaleDateString("vi-VN")
                        : "Ngày"}</span>
                      <input
                        type="date"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </label>
                  </Button>
                </div>

                {/* Checklist placeholder */}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(quickActionButtonClass, "gap-1.5")}
                >
                  <CheckSquare className="h-3 w-3" />
                  Việc cần làm
                </Button>

                {/* Assignee */}
                <Select
                  value={assigneeId ?? "none"}
                  onValueChange={(v) => setAssigneeId(v === "none" ? null : v)}
                >
                  <SelectTrigger className={cn(quickActionTriggerClass, "w-auto gap-1.5")}>
                    {assigneeName ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold"
                          style={{ backgroundColor: columnColor }}
                        >
                          {assigneeName[0].toUpperCase()}
                        </span>
                        {assigneeName}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <UserRound className="h-3 w-3" />
                        Thành viên
                      </span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Không giao</span>
                    </SelectItem>
                    {members.map((m: any) => (
                      <SelectItem key={m.user._id} value={m.user._id}>
                        <div className="flex items-center gap-2">
                          {m.user.avatar ? (
                            <img
                              src={m.user.avatar}
                              className="h-5 w-5 rounded-full object-cover"
                              alt=""
                            />
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                              {m.user.name?.[0]?.toUpperCase()}
                            </span>
                          )}
                          {m.user.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="ml-8 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <AlignLeft className="h-4 w-4 text-muted-foreground" />
                  Mô tả
                </div>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <Textarea
                      autoFocus
                      className="min-h-[100px] resize-none text-sm rounded-xl border-border/60 focus:border-primary/50 transition-colors"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Thêm mô tả chi tiết hơn..."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 rounded-lg text-xs"
                        onClick={() => setIsEditingDesc(false)}
                      >
                        Lưu
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 rounded-lg text-xs"
                        onClick={() => setIsEditingDesc(false)}
                      >
                        Huỷ
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "min-h-[80px] rounded-xl px-3 py-2.5 text-sm cursor-text border border-transparent hover:border-border/60 hover:bg-muted/30 transition-all",
                      !description && "text-muted-foreground/60 italic"
                    )}
                    onClick={() => setIsEditingDesc(true)}
                  >
                    {description || "Thêm mô tả chi tiết hơn..."}
                  </div>
                )}
              </div>

              {/* Attachments */}
              <div className="ml-8 space-y-3">
                <div className="flex items-center">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    Các tập tin đính kèm
                  </div>
                </div>

                {/* Linked card attachment preview */}
                {cardAttachment && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Thẻ Trello</p>
                    <div className="rounded-xl border border-border/60 p-3 bg-card max-w-[300px] space-y-1.5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: columnColor }}
                        >
                          {cardAttachment.projectName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {cardAttachment.listName}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                        <p className="text-xs font-medium leading-snug line-clamp-3">
                          {cardAttachment.cardTitle}
                        </p>
                      </div>
                      {card?.content && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          {1}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 rounded-lg text-[11px] text-muted-foreground gap-1 px-2"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 rounded-lg text-[11px] text-muted-foreground gap-1 px-2"
                      >
                        <Link2 className="h-3 w-3" />
                        Đã liên kết
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Labels showcase */}
              {labels.length > 0 && (
                <div className="ml-8 flex flex-wrap gap-1.5">
                  {labels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium"
                    >
                      <Tag className="h-3 w-3" />
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Right column (Comments & Activity) ────────────────────── */}
            <div className="w-[300px] border-l border-border/50 flex flex-col bg-muted/10 shrink-0">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Nhận xét và hoạt động
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-lg text-xs"
                  onClick={() => setShowDetailActivity(!showDetailActivity)}
                >
                  {showDetailActivity ? "Ẩn chi tiết" : "Hiện chi tiết"}
                </Button>
              </div>

              {/* Comment input */}
              <div className="px-4 py-3 border-b border-border/40">
                <div className="flex gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 mt-0.5">
                    {projectData?.project?.name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      className="min-h-[36px] max-h-[120px] resize-none text-sm rounded-xl border-border/60 focus:border-primary/50 transition-colors text-[13px] py-2"
                      placeholder="Viết bình luận..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          setCommentText("");
                        }
                      }}
                    />
                    {commentText.trim() && (
                      <Button
                        size="sm"
                        className="h-7 rounded-lg text-xs gap-1.5"
                        onClick={() => setCommentText("")}
                      >
                        <Send className="h-3 w-3" />
                        Gửi
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Activity list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {activities.map((act) => (
                  <div key={act.id} className="flex gap-2.5">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: act.avatarColor }}
                    >
                      {act.authorInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] leading-snug">
                        <span className="font-semibold">{act.author}</span>{" "}
                        <span className="text-muted-foreground">{act.content}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        {act.timestamp}
                      </p>
                    </div>
                  </div>
                ))}

                {activities.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-4">
                    Chưa có hoạt động nào
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-muted/5 shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {card?.identifier && (
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono">
                  #{card.identifier}
                </span>
              )}
              {card?.createdAt && (
                <span>
                  Tạo lúc{" "}
                  {new Date(card.createdAt).toLocaleDateString("vi-VN")}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => onOpenChange(false)}
              >
                Đóng
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={handleSave}
                disabled={!title.trim()}
              >
                {mode === "add" ? "Tạo nhiệm vụ" : "Lưu thay đổi"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
