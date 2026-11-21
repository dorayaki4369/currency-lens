import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import thirdPartyLicenses from "virtual:third-party-licenses";
import type { ThirdPartyLicense } from "@/scripts/about-metadata";
import { translate, type UiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Stack } from "@/components/layout/Stack";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";
import { List, ListItem } from "@/components/ui/list";
import {
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";

export const Route = createFileRoute("/settings/about/licenses")({
  component: LicensesRoute,
});

/** Renders the notices of open source packages shipped in the extension. */
function LicensesRoute() {
  const popup = usePopupApplicationContext();

  return (
    <PopupRouteFrame screen="licenses">
      <Licenses licenses={thirdPartyLicenses} locale={popup.locale} />
    </PopupRouteFrame>
  );
}

interface LicensesProps {
  readonly licenses: readonly ThirdPartyLicense[];
  readonly locale: UiLocale;
}

/** Lists each package with its license, expanding to the full notice on demand. */
function Licenses({ licenses, locale }: LicensesProps) {
  return (
    <Stack as="section" aria-labelledby="licenses-title" className="min-h-0 flex-1" gap={3}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {translate(locale, "licensesDescription")}
        </p>
        <div className="shrink-0">
          <Badge variant="secondary">
            {translate(locale, "licensesCount", { count: licenses.length })}
          </Badge>
        </div>
      </div>
      <Card className="min-h-0 flex-1 overflow-hidden" spacing="none">
        <List
          aria-labelledby="licenses-title"
          as="ul"
          className="h-full overflow-y-auto overscroll-contain"
        >
          {licenses.map((entry) => (
            <ListItem as="li" key={`${entry.name}@${entry.version}`}>
              <LicenseDisclosure entry={entry} locale={locale} />
            </ListItem>
          ))}
        </List>
      </Card>
    </Stack>
  );
}

/** Keeps long notices collapsed so the package list stays scannable. */
function LicenseDisclosure({
  entry,
  locale,
}: {
  readonly entry: ThirdPartyLicense;
  readonly locale: UiLocale;
}) {
  return (
    <details className="group">
      <summary
        className={cn(
          "flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-sm focus-visible:ring-inset [&::-webkit-details-marker]:hidden",
          FOCUS_RING_CLASS_NAME,
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="min-w-0 flex-1 truncate">
          <span>{entry.name}</span>
          <span className="ml-1.5 text-xs text-muted-foreground">{entry.version}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{entry.license}</span>
      </summary>
      <div className="px-3 pb-3">
        {entry.licenseText === null ? (
          <p className="text-xs text-muted-foreground">
            {translate(locale, "licensesNoText", { license: entry.license })}
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-md bg-muted p-2.5 text-xs leading-relaxed break-words text-foreground">
            {splitLicenseParagraphs(entry.licenseText).map((paragraph, index) => (
              // License paragraphs never reorder, and identical paragraphs can repeat.
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

/** Reflows hard-wrapped license files so paragraphs fit the narrow popup width. */
function splitLicenseParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.replaceAll(/\s*\n\s*/gu, " ").trim())
    .filter((paragraph) => paragraph !== "");
}
