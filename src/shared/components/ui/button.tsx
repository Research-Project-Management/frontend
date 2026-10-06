import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/shared/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-13 font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover focus-visible:ring-destructive/20 dark:bg-destructive dark:hover:bg-destructive-hover dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border bg-background hover:bg-muted text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted",
        ghost:
          "hover:bg-muted text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        ai: "bg-ai text-ai-foreground hover:bg-ai-hover font-medium focus-visible:ring-ai/30",
        "ai-outline":
          "border border-ai-border bg-transparent text-ai hover:bg-ai-subtle font-medium focus-visible:ring-ai/30",
        "ai-subtle":
          "bg-ai-subtle text-ai hover:bg-ai-subtle/80 border border-ai-border font-medium focus-visible:ring-ai/30",
      },
      size: {
        default: "h-8 py-1.5 gap-1.5 rounded-md px-3 text-13 has-[>svg]:px-2.5",
        xs: "h-6 py-1 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 py-1 gap-1.5 rounded-md px-2.5 text-11 has-[>svg]:px-2",
        md: "h-8 py-1.5 gap-1.5 rounded-md px-3 text-13 has-[>svg]:px-2.5",
        lg: "h-9 py-2 gap-1.5 rounded-md px-4 text-13 has-[>svg]:px-3",
        xl: "h-11 py-2.5 gap-2 rounded-md px-5 text-14 has-[>svg]:px-4",
        icon: "size-8 rounded-md p-1.5",
        "icon-xs": "size-6 rounded-md p-1 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-md p-1.5",
        "icon-md": "size-8 rounded-md p-1.5",
        "icon-lg": "size-9 rounded-md p-2",
        "icon-xl": "size-11 rounded-md p-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
