import React from "react";
import { cn } from "@/shared/lib/utils";

export interface ToolbarBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  isActive?: boolean;
}

export const ToolbarBtn = React.forwardRef<HTMLButtonElement, ToolbarBtnProps>(function ToolbarBtn({
  children,
  title,
  type = "button",
  danger,
  isActive,
  className,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      title={title}
      aria-label={title}
      className={cn(
        "flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-md transition-colors disabled:opacity-30",
        danger
          ? "text-current opacity-50 hover:opacity-100 hover:bg-destructive/10"
          : cn(
              "text-current transition-colors",
              isActive 
                ? "opacity-100 bg-muted text-foreground" 
                : "opacity-50 hover:opacity-100 hover:bg-muted"
            ),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
