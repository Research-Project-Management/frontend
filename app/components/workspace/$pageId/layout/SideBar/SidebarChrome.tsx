import type { ElementType, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

export function SidebarPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground">
      {children}
    </div>
  );
}

export function SidebarHeader({
  title,
  icon: Icon,
  badge,
  actions,
  onClose,
}: {
  title: string;
  icon?: ElementType;
  badge?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {badge}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {actions}
        {onClose ? (
          <SidebarIconButton label="Close" onClick={onClose}>
            <X className="size-3.5" />
          </SidebarIconButton>
        ) : null}
      </div>
    </div>
  );
}

export function SidebarIconButton({
  children,
  label,
  active,
  className,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label?: string;
  active?: boolean;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30",
        active && "bg-accent text-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SidebarSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border-b border-border px-3 py-3", className)}>{children}</div>;
}

export function SidebarEmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: ElementType;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-5 py-10 text-center text-muted-foreground">
      <Icon className="size-8 opacity-25" />
      <p className="text-xs font-medium text-foreground/70">{title}</p>
      {children ? <div className="text-xs leading-relaxed text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function SidebarSegmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string; count?: number; icon?: ElementType }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1 border-b border-border px-2 py-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              "flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
              active
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
            <span className="truncate">{item.label}</span>
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1 text-[9px]",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
