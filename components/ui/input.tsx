import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        suppressHydrationWarning
        className={cn(
          "flex h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-brand",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
