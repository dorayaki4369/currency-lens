import type { ComponentProps } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";

/** Styles a native select while preserving platform selection behavior. */
function NativeSelect({
  className,
  wrapperClassName,
  ...props
}: ComponentProps<"select"> & {
  wrapperClassName?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        wrapperClassName,
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className={cn(
          "form-control appearance-none py-2 pr-9 dark:hover:bg-input/50",
          FOCUS_RING_CLASS_NAME,
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

/** Applies shared text colors to one native select option. */
function NativeSelectOption({ className, ...props }: ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-popover text-popover-foreground", className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOption };
