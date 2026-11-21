import type { Ref } from "react";
import { cn } from "@/lib/utils";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";

export interface SegmentedControlOption<Value extends string> {
  readonly label: string;
  readonly value: Value;
}

interface SegmentedControlProps<Value extends string> {
  readonly className?: string | undefined;
  readonly label: string;
  readonly onValueChange: (value: Value) => void;
  readonly options: readonly SegmentedControlOption<Value>[];
  readonly selectedButtonRef?: Ref<HTMLButtonElement> | undefined;
  readonly value: Value;
  readonly variant?: keyof typeof VARIANT_CLASS_NAMES | undefined;
}

// "screen" switches whole screens, "compact" filters within a card, and "pill" picks a range.
const VARIANT_CLASS_NAMES = {
  compact: {
    button: "h-6 rounded-md text-xs font-semibold",
    group: "gap-0.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900",
    selected: "bg-card text-foreground shadow-xs dark:bg-zinc-700",
    unselected: "text-muted-foreground hover:text-foreground",
  },
  pill: {
    button: "h-7 rounded-full border text-xs",
    group: "gap-1",
    selected:
      "border-zinc-300 bg-zinc-100 font-semibold text-foreground dark:border-zinc-600 dark:bg-zinc-700",
    unselected:
      "border-transparent font-medium text-muted-foreground hover:text-foreground",
  },
  screen: {
    button: "h-7 rounded-md text-sm font-semibold",
    group: "gap-0.5 rounded-lg bg-zinc-200 p-0.5 dark:bg-zinc-800",
    selected: "bg-card text-foreground shadow-sm dark:bg-zinc-600",
    unselected: "text-muted-foreground hover:text-foreground",
  },
} as const;

/** Offers mutually exclusive choices as pressed buttons in one labelled group. */
export function SegmentedControl<Value extends string>({
  className,
  label,
  onValueChange,
  options,
  selectedButtonRef,
  value,
  variant = "screen",
}: SegmentedControlProps<Value>) {
  const classNames = VARIANT_CLASS_NAMES[variant];
  return (
    <div
      aria-label={label}
      className={cn("flex", classNames.group, className)}
      data-slot="segmented-control"
      data-variant={variant}
      role="group"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            aria-pressed={selected}
            className={cn(
              "min-w-0 flex-1 truncate px-1 transition-colors",
              FOCUS_RING_CLASS_NAME,
              classNames.button,
              selected ? classNames.selected : classNames.unselected,
            )}
            key={option.value}
            onClick={() => {
              if (!selected) {
                onValueChange(option.value);
              }
            }}
            ref={selected ? selectedButtonRef : undefined}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
