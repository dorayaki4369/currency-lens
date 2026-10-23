import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

interface IconButtonProps extends Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "size"
> {
  readonly label: string;
  readonly size?: "icon" | "icon-xs" | "icon-sm" | "icon-lg" | undefined;
}

/** Renders one consistently round icon-only button with an accessible name. */
export function IconButton({ label, size = "icon", ...props }: IconButtonProps) {
  return <Button aria-label={label} size={size} {...props} />;
}
