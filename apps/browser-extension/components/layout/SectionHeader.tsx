import type { ReactNode } from "react";
import { Stack } from "@/components/layout/Stack";

interface SectionHeaderProps {
  readonly action?: ReactNode | undefined;
  readonly description?: ReactNode | undefined;
  readonly headingLevel?: 2 | 3 | undefined;
  readonly id: string;
  readonly title: ReactNode;
}

/** Keeps section titles, descriptions, and optional actions visually consistent. */
export function SectionHeader({
  action,
  description,
  headingLevel = 2,
  id,
  title,
}: SectionHeaderProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <Stack gap={1}>
      <div className="flex items-center justify-between gap-4">
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
