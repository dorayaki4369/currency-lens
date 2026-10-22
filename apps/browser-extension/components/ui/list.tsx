import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const LIST_DIVIDER_INSET_CLASS_NAMES = {
  content: "before:inset-x-3",
  edge: "before:inset-x-0",
} as const;
const LIST_DIVIDER_VISIBILITY_CLASS_NAMES = {
  auto: "first:before:hidden",
  hidden: "before:hidden",
  visible: "before:block",
} as const;

type ListDividerInset = keyof typeof LIST_DIVIDER_INSET_CLASS_NAMES;
type ListDividerVisibility = keyof typeof LIST_DIVIDER_VISIBILITY_CLASS_NAMES;
type ListItemElement = "div" | "li";

type ListProps =
  | ({ readonly as?: "div" | undefined } & ComponentProps<"div">)
  | ({ readonly as: "ol" } & ComponentProps<"ol">)
  | ({ readonly as: "ul" } & ComponentProps<"ul">);

type ListItemProps = {
  readonly as?: ListItemElement | undefined;
  readonly dividerInset?: ListDividerInset | undefined;
  readonly dividerVisibility?: ListDividerVisibility | undefined;
} & HTMLAttributes<HTMLElement>;

/** Groups related rows inside one card surface while preserving caller-selected semantics. */
export function List(props: ListProps) {
  if (props.as === "ol") {
    const { as: _as, className, ...elementProps } = props;
    return (
      <ol
        className={cn("overflow-hidden rounded-lg bg-card", className)}
        data-slot="list"
        {...elementProps}
      />
    );
  }
  if (props.as === "ul") {
    const { as: _as, className, ...elementProps } = props;
    return (
      <ul
        className={cn("overflow-hidden rounded-lg bg-card", className)}
        data-slot="list"
        {...elementProps}
      />
    );
  }
  const { as: _as, className, ...elementProps } = props;
  return (
    <div
      className={cn("overflow-hidden rounded-lg bg-card", className)}
      data-slot="list"
      {...elementProps}
    />
  );
}

/** Aligns each leading separator with either the row content or the list edge. */
export function ListItem({
  as = "div",
  className,
  dividerInset = "content",
  dividerVisibility = "auto",
  ...props
}: ListItemProps) {
  const itemClassName = cn(
    "relative before:pointer-events-none before:absolute before:top-0 before:h-px before:bg-border before:content-['']",
    LIST_DIVIDER_INSET_CLASS_NAMES[dividerInset],
    LIST_DIVIDER_VISIBILITY_CLASS_NAMES[dividerVisibility],
    className,
  );
  if (as === "li") {
    return <li className={itemClassName} data-slot="list-item" {...props} />;
  }
  return <div className={itemClassName} data-slot="list-item" {...props} />;
}
