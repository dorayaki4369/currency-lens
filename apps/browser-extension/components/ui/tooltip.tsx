import type { ComponentProps } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Configures shared timing for descendant Radix tooltips. */
function TooltipProvider({
  delayDuration = 300,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

/** Owns one tooltip's open and close state. */
function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

/** Connects an interactive child to its tooltip content. */
function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

interface TooltipContentProps extends ComponentProps<typeof TooltipPrimitive.Content> {
  readonly portalled?: boolean | undefined;
}

/** Positions tooltip content in a portal or the local rendering root. */
function TooltipContent({
  children,
  className,
  portalled = true,
  sideOffset = 4,
  ...props
}: TooltipContentProps) {
  const content = (
    <TooltipPrimitive.Content
      className={cn(
        "pointer-events-none z-50 max-w-64 rounded-md bg-primary px-2 py-1 text-center text-xs text-primary-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0",
        className,
      )}
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_--spacing(0.5))] rotate-45 rounded-xs bg-primary fill-primary" />
    </TooltipPrimitive.Content>
  );

  return portalled ? <TooltipPrimitive.Portal>{content}</TooltipPrimitive.Portal> : content;
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
