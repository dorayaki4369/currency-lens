import type { ReactNode } from "react";
import { Stack } from "@/components/layout/Stack";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  readonly action?: ReactNode | undefined;
  readonly description?: ReactNode | undefined;
  readonly headingLevel?: 2 | 3 | undefined;
  readonly id: string;
  /**
   * Keeps the title row as tall as one with a small icon action, so a header without one
   * lines up with a peer screen's header that has one.
   */
  readonly reserveActionHeight?: boolean | undefined;
  readonly title: ReactNode;
}

/** Keeps section titles, descriptions, and optional actions visually consistent. */
export function SectionHeader({
  action,
  description,
  headingLevel = 2,
  id,
  reserveActionHeight = false,
  title,
}: SectionHeaderProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <Stack gap={1}>
      <div
        className={cn(
          "flex items-center justify-between gap-4",
          reserveActionHeight && "min-h-8",
        )}
      >
        <Heading className="text-sm font-semibold" id={id}>
          {title}
        </Heading>
        {action}
      </div>
      {description === undefined ? null : (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </Stack>
  );
}
