import { cn } from "@/shared/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse motion-reduce:animate-none rounded-md bg-muted/80",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
