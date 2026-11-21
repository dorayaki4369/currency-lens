import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import { DollarSign, Info, Palette, RefreshCw } from "lucide-react";
import { translate, type UiLocale } from "@/lib/i18n";
import { List } from "@/components/ui/list";
import {
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import { navigatePopupRoute } from "@/entrypoints/popup/popup-route-transition";
import { SettingsMenuItem } from "@/entrypoints/popup/SettingsMenuItem";

export const Route = createFileRoute("/settings/")({
  component: SettingsIndexRoute,
});

/** Renders the settings index and navigates to its typed child routes. */
function SettingsIndexRoute() {
  const popup = usePopupApplicationContext();
  const navigate = useNavigate();

  return (
    <PopupRouteFrame screen="settings">
      <SettingsMenu
        aboutTriggerReference={popup.aboutTriggerReference}
        currenciesTriggerReference={popup.currenciesTriggerReference}
        displayTriggerReference={popup.displaySettingsTriggerReference}
        locale={popup.locale}
        onOpenAbout={() =>
          void navigatePopupRoute(
            () =>
              navigate({
                to: "/settings/about",
                viewTransition: true,
              }),
            "forward",
          )
        }
        onOpenCurrencies={() =>
          void navigatePopupRoute(
            () =>
              navigate({
                to: "/settings/currencies",
                viewTransition: true,
              }),
            "forward",
          )
        }
        onOpenDisplay={() =>
          void navigatePopupRoute(
            () =>
              navigate({
                to: "/settings/display",
                viewTransition: true,
              }),
            "forward",
          )
        }
        onOpenSymbols={() =>
          void navigatePopupRoute(
            () =>
              navigate({
                to: "/settings/symbols",
                viewTransition: true,
              }),
            "forward",
          )
        }
        symbolTriggerReference={popup.symbolSettingsTriggerReference}
      />
    </PopupRouteFrame>
  );
}

interface SettingsMenuProps {
  readonly aboutTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly currenciesTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly displayTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly locale: UiLocale;
  readonly onOpenAbout: () => void;
  readonly onOpenCurrencies: () => void;
  readonly onOpenDisplay: () => void;
  readonly onOpenSymbols: () => void;
  readonly symbolTriggerReference: RefObject<HTMLButtonElement | null>;
}

/** Renders settings as a list whose rows open focused detail routes. */
function SettingsMenu({
  aboutTriggerReference,
  currenciesTriggerReference,
  displayTriggerReference,
  locale,
  onOpenAbout,
  onOpenCurrencies,
  onOpenDisplay,
  onOpenSymbols,
  symbolTriggerReference,
}: SettingsMenuProps) {
  return (
    <nav aria-label={translate(locale, "settingsHeading")}>
      <List as="ul" className="flex flex-col gap-2">
        <SettingsMenuItem
          buttonReference={displayTriggerReference}
          icon={Palette}
          label={translate(locale, "displayHeading")}
          onClick={onOpenDisplay}
        />
        <SettingsMenuItem
          buttonReference={symbolTriggerReference}
          icon={RefreshCw}
          label={translate(locale, "ambiguousHeading")}
          onClick={onOpenSymbols}
        />
        <SettingsMenuItem
          buttonReference={currenciesTriggerReference}
          icon={DollarSign}
          label={translate(locale, "supportedCurrenciesHeading")}
          onClick={onOpenCurrencies}
        />
        <SettingsMenuItem
          buttonReference={aboutTriggerReference}
          icon={Info}
          label={translate(locale, "aboutHeading")}
          onClick={onOpenAbout}
        />
      </List>
    </nav>
  );
}
