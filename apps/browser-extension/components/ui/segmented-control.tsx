import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ComponentProps,
} from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";

type SegmentedControlSize = "default" | "lg" | "sm";
type SegmentedControlVariant = "pill" | "track";
type SegmentedControlSurface = "card" | "page";

interface SegmentedControlAppearance {
  readonly size: SegmentedControlSize;
  readonly variant: SegmentedControlVariant;
}

// "track" sits the choices on a filled track; "pill" floats them, for a quieter choice
// such as a period. Sizes set the height and type: "sm" inside cards, "lg" for screens.
// Both variants inset the choices and the thumb 2px from the top and bottom, so a size
// gives every variant the same height.
const ROOT_CLASS_NAMES = {
  pill: "gap-1",
  track: "gap-0.5 rounded-md px-0.5",
} as const satisfies Record<SegmentedControlVariant, string>;
// A track sits on a card by default. On the page layer, beside the cards, it takes a deeper
// fill to read on the muted background and the card's corner radius, with its thumb's
// corners kept concentric inside the 2px inset. Pills have no track, so the surface does
// not change them.
const TRACK_SURFACE_CLASS_NAMES = {
  card: "bg-muted dark:bg-background",
  page: "rounded-xl bg-zinc-200 dark:bg-zinc-800",
} as const satisfies Record<SegmentedControlSurface, string>;
const TRACK_SURFACE_THUMB_CLASS_NAMES = {
  card: "",
  page: "rounded-[calc(var(--radius-xl)-2px)]",
} as const satisfies Record<SegmentedControlSurface, string>;
const THUMB_CLASS_NAMES = {
  pill: "rounded-full bg-zinc-200 dark:bg-zinc-600",
  track: "rounded-sm bg-card shadow-sm dark:bg-muted",
} as const satisfies Record<SegmentedControlVariant, string>;
// Pills read lighter than the size's type and only bolden the checked choice.
const ITEM_CLASS_NAMES = {
  pill: "rounded-full px-1 font-medium data-[state=checked]:font-semibold",
  track: "rounded-sm",
} as const satisfies Record<SegmentedControlVariant, string>;
const HEIGHT_CLASS_NAMES = {
  default: "h-8",
  lg: "h-8",
  sm: "h-7",
} as const satisfies Record<SegmentedControlSize, string>;
const ITEM_SIZE_CLASS_NAMES = {
  default: "px-3 text-xs font-medium",
  lg: "px-3 text-sm font-semibold",
  sm: "min-w-0 px-1 text-xs font-semibold",
} as const satisfies Record<SegmentedControlSize, string>;

const SegmentedControlContext = createContext<SegmentedControlAppearance>({
  size: "default",
  variant: "track",
});

type SegmentedControlProps = Omit<
  ComponentProps<typeof RadioGroupPrimitive.Root>,
  "orientation" | "ref"
> &
  Partial<SegmentedControlAppearance> & {
    /** Spans the available width and shares it among the choices. */
    readonly stretch?: boolean | undefined;
    /** What the control sits on, which sets the track's fill. */
    readonly surface?: SegmentedControlSurface | undefined;
  };

/** Lays out a single-choice radio group as one track with a thumb that slides to the choice. */
function SegmentedControl({
  children,
  className,
  size = "default",
  stretch = false,
  surface = "card",
  variant = "track",
  ...props
}: SegmentedControlProps) {
  // The thumb only slides horizontally and needs the root element, so neither is configurable.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const thumb = useCheckedItemBounds(root);

  return (
    <RadioGroupPrimitive.Root
      data-size={size}
      data-slot="segmented-control"
      data-variant={variant}
      className={cn(
        "relative items-stretch py-0.5 text-muted-foreground",
        stretch ? "flex w-full" : "inline-flex",
        HEIGHT_CLASS_NAMES[size],
        ROOT_CLASS_NAMES[variant],
        variant === "track" && TRACK_SURFACE_CLASS_NAMES[surface],
        className,
      )}
      {...props}
      orientation="horizontal"
      ref={setRoot}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-0.5 bottom-0.5 left-0 motion-safe:transition-[translate,width] motion-safe:duration-200 motion-safe:ease-out",
          THUMB_CLASS_NAMES[variant],
          variant === "track" && TRACK_SURFACE_THUMB_CLASS_NAMES[surface],
        )}
        data-slot="segmented-control-thumb"
        hidden={thumb === null}
        style={
          thumb === null
            ? undefined
            : { translate: `${thumb.left}px 0`, width: thumb.width }
        }
      />
      <SegmentedControlContext.Provider value={{ size, variant }}>
        {children}
      </SegmentedControlContext.Provider>
    </RadioGroupPrimitive.Root>
  );
}

/** Renders one option above the sliding thumb. */
function SegmentedControlItem({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  const { size, variant } = useContext(SegmentedControlContext);
  return (
    <RadioGroupPrimitive.Item
      data-slot="segmented-control-item"
      className={cn(
        "relative inline-flex flex-1 items-center justify-center whitespace-nowrap transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:text-foreground",
        ITEM_SIZE_CLASS_NAMES[size],
        ITEM_CLASS_NAMES[variant],
        FOCUS_RING_CLASS_NAME,
        className,
      )}
      {...props}
    />
  );
}

interface ItemBounds {
  readonly left: number;
  readonly width: number;
}

/** Tracks where the checked item sits so the thumb can follow selection and resizes. */
function useCheckedItemBounds(root: HTMLElement | null): ItemBounds | null {
  const [bounds, setBounds] = useState<ItemBounds | null>(null);

  useLayoutEffect(() => {
    if (root === null) {
      return undefined;
    }
    const measure = () => {
      const checked = root.querySelector<HTMLElement>(
        '[data-slot="segmented-control-item"][data-state="checked"]',
      );
      setBounds(
        checked === null ? null : { left: checked.offsetLeft, width: checked.offsetWidth },
      );
    };
    measure();
    // Radix flips data-state on selection, which covers controlled and uncontrolled use alike.
    const selection = new MutationObserver(measure);
    selection.observe(root, { attributeFilter: ["data-state"], subtree: true });
    const size = new ResizeObserver(measure);
    size.observe(root);
    return () => {
      selection.disconnect();
      size.disconnect();
    };
  }, [root]);

  return bounds;
}

/**
 * Narrows the radio group's string value back to one of the caller's typed options;
 * values that are not among them are ignored.
 */
function selectSegmentedOption<Value extends string>(
  options: readonly Value[],
  onSelect: (value: Value) => void,
): (value: string) => void {
  return (value) => {
    const option = options.find((candidate) => candidate === value);
    if (option !== undefined) {
      onSelect(option);
    }
  };
}

export { SegmentedControl, SegmentedControlItem, selectSegmentedOption };
