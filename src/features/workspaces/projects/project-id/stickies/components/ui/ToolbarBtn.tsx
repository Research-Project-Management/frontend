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
        "flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-lg transition-colors disabled:opacity-30",
        danger
          ? "text-current opacity-50 hover:opacity-100 hover:text-red-500 hover:bg-red-50"
          : cn(
              "text-current transition-colors",
              isActive 
                ? "opacity-100 bg-black/20" 
                : "opacity-50 hover:opacity-100 hover:bg-black/10"
            ),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
