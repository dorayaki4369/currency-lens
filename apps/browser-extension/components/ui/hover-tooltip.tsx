import { useState, type ReactElement, type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HoverTooltipProps {
  readonly children: ReactElement;
  readonly content: ReactNode;
  readonly portalled?: boolean | undefined;
}

/** Adds a hover-only shadcn tooltip to an explicitly wrapped target. */
export function HoverTooltip({ children, content, portalled = true }: HoverTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip open={open}>
        <TooltipTrigger
          asChild
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent onEscapeKeyDown={() => setOpen(false)} portalled={portalled}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
