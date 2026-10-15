import * as React from "react"

import { cn } from "@/lib/utils"

/* Ring-based field. A 1px ring replaces the border: it
   paints outside the box, so the field's height stays a clean 9, the inner
   text never shifts by a border width, and the focus ring can simply widen the
   same ring instead of stacking a second outline on top of a border. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-9 w-full min-w-0 rounded-lg bg-transparent px-3 py-1 text-base ring-1 ring-border transition-shadow outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:ring-input",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "aria-invalid:ring-2 aria-invalid:ring-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
