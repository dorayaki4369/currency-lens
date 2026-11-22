import { AppLogo } from "@/components/layout/AppLogo";

interface BrandProps {
  readonly eyebrow?: string;
  readonly title: string;
}

/** Pairs the app logo with the product title. */
export function Brand({ eyebrow, title }: BrandProps) {
  return (
    <div className="flex items-center gap-3">
      <AppLogo />
      <div className="min-w-0">
        {eyebrow === undefined ? null : (
          <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="truncate text-lg font-semibold leading-none">{title}</h1>
      </div>
    </div>
  );
}
