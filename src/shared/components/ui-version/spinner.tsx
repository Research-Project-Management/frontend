import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg" | "xl";
  fullScreen?: boolean;
}

export function Spinner({ className, size = "default", fullScreen, ...props }: SpinnerProps) {
  const loaderSize = {
    sm: "h-4 w-4",
    default: "h-8 w-8",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  }[size];

  const content = (
    <Loader2 className={cn("animate-spin text-primary", loaderSize)} />
  );

  if (fullScreen) {
    return (
      <div 
        className={cn("flex h-[50vh] w-full items-center justify-center", className)} 
        {...props}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center", className)} {...props}>
      {content}
    </div>
  );
}
