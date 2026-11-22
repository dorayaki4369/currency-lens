import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const STACK_GAP_CLASS_NAMES = {
  0: "gap-0",
  1: "gap-1",
  1.5: "gap-1.5",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
} as const;

type StackGap = keyof typeof STACK_GAP_CLASS_NAMES;
type StackElement = "article" | "div" | "nav" | "section" | "span";

type StackProps<T extends StackElement> = {
  readonly as?: T | undefined;
  readonly gap?: StackGap | undefined;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "gap">;

/** Arranges children vertically with one shared spacing scale and configurable semantics. */
export function Stack<T extends StackElement = "div">({
  as,
  className,
  gap = 2,
  ...props
}: StackProps<T>) {
  const Component = as ?? "div";
  return (
    <Component
      className={cn("flex flex-col", STACK_GAP_CLASS_NAMES[gap], className)}
      {...props}
    />
  );
}
