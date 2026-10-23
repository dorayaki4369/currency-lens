import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";

/** Applies the shared input sizing, colors, and focus treatment. */
function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "form-control py-1 disabled:opacity-50 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        FOCUS_RING_CLASS_NAME,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
