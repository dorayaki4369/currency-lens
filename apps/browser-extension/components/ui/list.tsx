import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ROW_INSET_CLASS_NAME } from "@/components/ui/row-control";

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

type ListItemRowLayout = "inline" | "stacked";

type ListItemRowProps = HTMLAttributes<HTMLDivElement> & {
  /** "inline" sets a label and its control side by side; "stacked" puts a block below its heading. */
  readonly layout?: ListItemRowLayout | undefined;
};

const LIST_ITEM_ROW_LAYOUT_CLASS_NAMES = {
  inline: "items-center",
  stacked: "flex-col",
} as const satisfies Record<ListItemRowLayout, string>;

type ListItemProps = {
  readonly as?: ListItemElement | undefined;
  readonly dividerInset?: ListDividerInset | undefined;
  readonly dividerVisibility?: ListDividerVisibility | undefined;
} & HTMLAttributes<HTMLElement>;

/** Groups related rows while preserving caller-selected semantics; surfaces come from Card. */
export function List(props: ListProps) {
  if (props.as === "ol") {
    const { as: _as, className, ...elementProps } = props;
    return <ol className={className} data-slot="list" {...elementProps} />;
  }
  if (props.as === "ul") {
    const { as: _as, className, ...elementProps } = props;
    return <ul className={className} data-slot="list" {...elementProps} />;
  }
  const { as: _as, className, ...elementProps } = props;
  return <div className={className} data-slot="list" {...elementProps} />;
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

/** Gives every list row the same 12px inset so rows differ only by their content. */
export function ListItemRow({ className, layout = "inline", ...props }: ListItemRowProps) {
  return (
    <div
      className={cn(
        "flex gap-2",
        ROW_INSET_CLASS_NAME,
        LIST_ITEM_ROW_LAYOUT_CLASS_NAMES[layout],
        className,
      )}
      data-slot="list-item-row"
      {...props}
    />
  );
}
