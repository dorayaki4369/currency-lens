import { TriangleAlert } from "lucide-react";
import { translate, type UiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Rate provider credited next to every displayed rate time. */
const RATE_SOURCE = {
  name: "Open Exchange Rates",
  url: "https://openexchangerates.org/",
} as const;

interface RateTimestampProps {
  readonly isStale: boolean;
  readonly locale: UiLocale;
  readonly sourceTimestamp: number;
}

/** Shows the source rate time and provider, and turns the same footer into a stale-data warning. */
export function RateTimestamp({ isStale, locale, sourceTimestamp }: RateTimestampProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-1.5 text-xs",
        isStale ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground",
      )}
      role={isStale ? "status" : undefined}
    >
      {isStale ? (
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      ) : null}
      <span>
        <span className="block">
          {translate(locale, "ratesFrom", {
            timestamp: formatRateTimestamp(sourceTimestamp, locale),
          })}
          <span aria-hidden="true"> • </span>
          <a
            className="underline underline-offset-2 hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            href={RATE_SOURCE.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {RATE_SOURCE.name}
          </a>
        </span>
        {isStale ? <span className="block">{translate(locale, "ratesStale")}</span> : null}
      </span>
    </div>
  );
}

/** Formats a source timestamp in the language used by the surrounding converter. */
function formatRateTimestamp(timestamp: number, locale: UiLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}
