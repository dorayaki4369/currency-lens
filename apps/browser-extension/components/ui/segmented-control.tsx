import { useLayoutEffect, useState, type ComponentProps } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";

/** Lays out a single-choice radio group as one track with a thumb that slides to the choice. */
function SegmentedControl({
  children,
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const thumb = useCheckedItemBounds(root);

  return (
    <RadioGroupPrimitive.Root
      data-slot="segmented-control"
      className={cn(
        "relative inline-flex h-8 items-stretch gap-0.5 rounded-md bg-muted p-0.5 text-muted-foreground dark:bg-background",
        className,
      )}
      orientation="horizontal"
      ref={setRoot}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0.5 bottom-0.5 left-0 rounded-sm bg-card shadow-sm transition-[translate,width] duration-200 ease-out dark:bg-muted"
        data-slot="segmented-control-thumb"
        hidden={thumb === null}
        style={
          thumb === null
            ? undefined
            : { translate: `${thumb.left}px 0`, width: thumb.width }
        }
      />
      {children}
    </RadioGroupPrimitive.Root>
  );
}

/** Renders one option above the sliding thumb. */
function SegmentedControlItem({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="segmented-control-item"
      className={cn(
        "relative inline-flex flex-1 items-center justify-center rounded-sm px-3 text-xs font-medium whitespace-nowrap transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:text-foreground",
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
      const checked = root.querySelector<HTMLElement>('[data-state="checked"]');
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

export { SegmentedControl, SegmentedControlItem };
