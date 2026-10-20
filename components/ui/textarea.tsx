import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-lg bg-transparent px-3 py-2 text-base ring-1 ring-border transition-shadow outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:ring-input",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
