import type { ComponentProps } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Owns open state for a shared Radix popover. */
function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

/** Connects a caller-provided trigger to its popover content. */
function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

interface PopoverContentProps extends ComponentProps<typeof PopoverPrimitive.Content> {
  readonly portalled?: boolean | undefined;
}

/** Positions popover content either in a portal or its local ShadowRoot. */
function PopoverContent({
  align = "center",
  className,
  portalled = true,
  sideOffset = 4,
  ...props
}: PopoverContentProps) {
  const content = (
    <PopoverPrimitive.Content
      align={align}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden",
        className,
      )}
      data-slot="popover-content"
      forceMount
      sideOffset={sideOffset}
      {...props}
    />
  );

  return portalled ? (
    <PopoverPrimitive.Portal forceMount>{content}</PopoverPrimitive.Portal>
  ) : (
    content
  );
}

export { Popover, PopoverContent, PopoverTrigger };
