import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The field.
 *
 * A border rather than a ring, and a shadow under it. The ring version
 * painted outside the box, which is the wrong side for a field that sits in a
 * panel: the shadow has to be *under* the field or the panel reads as a sheet
 * of glass with holes in it.
 *
 * The focus is a wide, soft ring at a quarter of the ink — a field that
 * shouts when it is focused is a field that is always shouting, because
 * people click into fields to read what is in them.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/72 selection:bg-primary selection:text-primary-foreground h-8.5 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-base shadow-xs/5 transition-[border-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/32",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24",
        "aria-invalid:border-destructive/64 aria-invalid:ring-destructive/16",
        className
      )}
      {...props}
    />
  )
}

export { Input }
