import { PRIORITY_CONFIG, type Priority } from "~/types/task";

export default function PriorityBadge({
  priority,
  showLabel = false,
}: {
  priority: Priority;
  showLabel?: boolean;
}) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.none;

  if (priority === "none" && !showLabel) return null;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs shrink-0"
      title={config.label}
    >
      <span
        className="size-3 rounded-full border"
        style={{
          backgroundColor: `${config.color}20`,
          borderColor: config.color,
        }}
      />
      {showLabel && (
        <span style={{ color: config.color }} className="font-medium">
          {config.label}
        </span>
      )}
    </span>
  );
}
