import * as React from "react"
import { AlertCircle } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/shared/components/ui-version/alert"

export interface ErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
}

export function ErrorMessage({ title = "Có lỗi xảy ra", message, className, ...props }: ErrorMessageProps) {
  return (
    <div className={cn("w-full max-w-md mx-auto", className)} {...props}>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          {message}
        </AlertDescription>
      </Alert>
    </div>
  )
}
