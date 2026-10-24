import { TriangleAlert } from "lucide-react";
import { translate, type UiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface RateTimestampProps {
  readonly isStale: boolean;
  readonly locale: UiLocale;
  readonly sourceTimestamp: number;
}

/** Shows the source rate time and turns the same footer into a stale-data warning. */
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
