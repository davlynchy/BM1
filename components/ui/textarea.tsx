import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-32 w-full rounded-xl border border-border bg-panel px-3 py-3 text-sm text-text outline-none placeholder:text-muted focus:border-brand",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
