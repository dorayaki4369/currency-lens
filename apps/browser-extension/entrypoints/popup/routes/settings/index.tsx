import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import {
  ChevronRight,
  DollarSign,
  Palette,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { translate, type UiLocale } from "@/lib/i18n";
import { Stack } from "@/components/layout/Stack";
import { Button } from "@/components/ui/button";
import {
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import { navigatePopupRoute } from "@/entrypoints/popup/popup-route-transition";

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
        currenciesTriggerReference={popup.currenciesTriggerReference}
        displayTriggerReference={popup.displaySettingsTriggerReference}
        locale={popup.locale}
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
  readonly currenciesTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly displayTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly locale: UiLocale;
  readonly onOpenCurrencies: () => void;
  readonly onOpenDisplay: () => void;
  readonly onOpenSymbols: () => void;
  readonly symbolTriggerReference: RefObject<HTMLButtonElement | null>;
}

/** Renders settings as a list whose rows open focused detail routes. */
function SettingsMenu({
  currenciesTriggerReference,
  displayTriggerReference,
  locale,
  onOpenCurrencies,
  onOpenDisplay,
  onOpenSymbols,
  symbolTriggerReference,
}: SettingsMenuProps) {
  return (
    <Stack as="nav" aria-label={translate(locale, "settingsHeading")}>
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
    </Stack>
  );
}

interface SettingsMenuItemProps {
  readonly buttonReference: RefObject<HTMLButtonElement | null>;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
}

/** Renders one keyboard-operable destination in the popup settings index. */
function SettingsMenuItem({
  buttonReference,
  icon: Icon,
  label,
  onClick,
}: SettingsMenuItemProps) {
  return (
    <Button
      className="h-11 w-full justify-between bg-card px-3 font-normal focus-visible:ring-inset"
      onClick={onClick}
      ref={buttonReference}
      type="button"
      variant="secondary"
    >
      <Icon aria-hidden="true" />
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight aria-hidden="true" />
    </Button>
  );
}
