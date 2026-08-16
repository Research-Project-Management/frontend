// ── Types & Schemas ──────────────────────────────────────────────────────────
export * from "./types/task.types";
export * from "./types/label.types";
export * from "./schemas/task.schema";
export * from "./schemas/label.schema";

// ── Services & Hooks ────────────────────────────────────────────────────────
export * from "./services/task.service";
export * from "./services/label.service";
export * from "./hooks/use-task";
export * from "./hooks/use-kanban";
export * from "./hooks/use-topbar";

// ── Components ──────────────────────────────────────────────────────────────
export { default as TaskPage } from "./pages/TaskPage";
export { TaskDetailModal, TaskDialog, type TaskDetailModalProps } from "./components/modals/task/TaskDetailModal";
export { TaskActivities, type ActivityEntry, type TaskActivitiesProps } from "./components/modals/task/TaskActivities";
export { TaskChecklist, type TaskChecklistProps } from "./components/modals/task/TaskChecklist";
export { TaskAttachments, type TaskAttachment, type TaskAttachmentsProps } from "./components/modals/task/TaskAttachments";
export { TransferModal, type TransferModalProps } from "./components/modals/TransferModal";
export { AddExistingTaskModal, type AddExistingTaskModalProps } from "./components/modals/AddExistingTaskModal";
export { Topbar as TaskTopbar } from "./components/layout/Topbar";
export { TaskViews, BoardView, ListView, CalendarView, type TaskViewsProps } from "./components/views/TaskViews";
export { Board as TaskBoard, Board, Board as KanbanBoard } from "./components/kanban/Board";
export { Card as TaskCard, Card, CardUI, type TaskCardLabel } from "./components/kanban/Card";
export { Column as TaskColumn, Column } from "./components/kanban/Column";
