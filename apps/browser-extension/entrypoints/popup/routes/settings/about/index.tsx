import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import extensionVersion from "virtual:extension-version";
import { Code, Scale, ShieldCheck, Star } from "lucide-react";
import {
  APP_LICENSE,
  COPYRIGHT_NOTICE,
  getStoreReviewLink,
  PRIVACY_POLICY_URL,
  RATE_SOURCE_NAME,
  RATE_SOURCE_URL,
  REPOSITORY_URL,
} from "@/lib/about";
import { translate, type UiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/layout/AppLogo";
import { Stack } from "@/components/layout/Stack";
import { Card } from "@/components/ui/card";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";
import { List, ListItem, ListItemRow } from "@/components/ui/list";
import {
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import { navigatePopupRoute } from "@/entrypoints/popup/popup-route-transition";
import { SettingsMenuItem } from "@/entrypoints/popup/SettingsMenuItem";

export const Route = createFileRoute("/settings/about/")({
  component: AboutRoute,
});

/** Renders product information under settings. */
function AboutRoute() {
  const popup = usePopupApplicationContext();
  const navigate = useNavigate();

  return (
    <PopupRouteFrame screen="about">
      <About
        browserName={import.meta.env.BROWSER}
        licensesTriggerReference={popup.licensesTriggerReference}
        locale={popup.locale}
        onOpenLicenses={() =>
          void navigatePopupRoute(
            () =>
              navigate({
                to: "/settings/about/licenses",
                viewTransition: true,
              }),
            "forward",
          )
        }
        version={extensionVersion}
      />
    </PopupRouteFrame>
  );
}

interface AboutProps {
  /** Build target from WXT; unknown targets hide the store review link. */
  readonly browserName: string | undefined;
  readonly licensesTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly locale: UiLocale;
  readonly onOpenLicenses: () => void;
  readonly version: string;
}

/** Shows the product identity, its terms, and links to related pages. */
function About({
  browserName,
  licensesTriggerReference,
  locale,
  onOpenLicenses,
  version,
}: AboutProps) {
  const review = getStoreReviewLink(browserName);
  const newTabLabel = translate(locale, "openInNewTab");

  return (
    <Stack as="section" aria-labelledby="about-title" gap="section">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <AppLogo className="size-12" />
        <div>
          <h2 className="text-base font-semibold">{translate(locale, "appName")}</h2>
          <p className="text-xs text-muted-foreground">
            {translate(locale, "aboutVersion", { version })}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {translate(locale, "extensionDescription")}
        </p>
      </div>

      <Card spacing="flush">
        <List>
          <ListItem>
            <ListItemRow className="justify-between gap-4 text-sm">
              <span>{translate(locale, "aboutRateSource")}</span>
              <a
                className={cn(
                  "rounded-sm text-primary underline-offset-4 hover:underline",
                  FOCUS_RING_CLASS_NAME,
                )}
                href={RATE_SOURCE_URL}
                rel="noreferrer"
                target="_blank"
              >
                {RATE_SOURCE_NAME}
                <span className="sr-only">{newTabLabel}</span>
              </a>
            </ListItemRow>
          </ListItem>
          <ListItem>
            <ListItemRow className="justify-between gap-4 text-sm">
              <span>{translate(locale, "aboutLicense")}</span>
              <span className="text-muted-foreground">{APP_LICENSE}</span>
            </ListItemRow>
          </ListItem>
        </List>
      </Card>

      <List as="ul" className="flex flex-col gap-2">
        {review === null ? null : (
          <SettingsMenuItem
            href={review.url}
            icon={Star}
            label={translate(locale, "aboutReview", {
              store: translate(locale, review.storeNameKey),
            })}
            newTabLabel={newTabLabel}
          />
        )}
        <SettingsMenuItem
          href={REPOSITORY_URL}
          icon={Code}
          label={translate(locale, "aboutSourceCode")}
          newTabLabel={newTabLabel}
        />
        <SettingsMenuItem
          href={PRIVACY_POLICY_URL}
          icon={ShieldCheck}
          label={translate(locale, "aboutPrivacyPolicy")}
          newTabLabel={newTabLabel}
        />
        <SettingsMenuItem
          buttonReference={licensesTriggerReference}
          icon={Scale}
          label={translate(locale, "licensesHeading")}
          onClick={onOpenLicenses}
        />
      </List>

      <p className="text-center text-xs text-muted-foreground">{COPYRIGHT_NOTICE}</p>
    </Stack>
  );
}
