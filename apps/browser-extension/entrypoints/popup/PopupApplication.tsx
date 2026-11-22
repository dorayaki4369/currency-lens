import { Outlet, useNavigate } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
} from "react";
import { ArrowLeft, Settings } from "lucide-react";
import type { Config } from "@/lib/currency";
import { getUiLocale, translate, type TranslationKey, type UiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/layout/Brand";
import { Stack } from "@/components/layout/Stack";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { IconButton } from "@/components/ui/icon-button";
import {
  PopupConversionProvider,
  type PopupRatesData,
} from "@/entrypoints/popup/stores/conversion";
import { ConfigStoreProvider, useConfigStore } from "@/stores/config";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { navigatePopupRoute } from "@/entrypoints/popup/popup-route-transition";
import { RateHistoryProvider, type RateHistoryPreview } from "@/stores/rate-history";
import { RatesScreenSwitch } from "@/components/rates/RatesScreenSwitch";
import { ChartColorsProvider } from "@/stores/chart-colors";
import type { ChartColorSettings } from "@/lib/trend-colors";

export interface PopupPreviewData {
  /** Defaults to no choice, so the default colors apply. */
  readonly chartColors?: ChartColorSettings | undefined;
  readonly config: Config;
  /** Defaults to empty history, so previews never request it. */
  readonly history?: RateHistoryPreview | undefined;
  readonly locale?: UiLocale | undefined;
  readonly rates: PopupRatesData;
}

type PopupScreen =
  | "about"
  | "converter"
  | "currencies"
  | "display-settings"
  | "licenses"
  | "rates"
  | "settings"
  | "symbol-settings";

/** Top-level screens that sit side by side behind the screen switcher. */
type PopupPeerScreen = Extract<PopupScreen, "converter" | "rates">;

const PEER_SCREEN_PATHS = { converter: "/", rates: "/rates" } as const satisfies Record<
  PopupPeerScreen,
  string
>;
const EMPTY_HISTORY_PREVIEW: RateHistoryPreview = { kind: "empty" };

export interface PopupRouterContext {
  readonly preview?: PopupPreviewData | undefined;
}

interface PopupApplicationProps {
  readonly preview?: PopupPreviewData | undefined;
}

type UpdateConfig = (update: (current: Config) => Config) => void;

export interface PopupApplicationContextValue {
  readonly aboutTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly backButtonReference: RefObject<HTMLButtonElement | null>;
  readonly config: Config | null;
  readonly currenciesTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly displaySettingsTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly error: string | null;
  readonly licensesTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly loading: boolean;
  readonly locale: UiLocale;
  readonly previousScreenReference: RefObject<PopupScreen | null>;
  readonly screenSwitcherReference: RefObject<HTMLButtonElement | null>;
  readonly settingsReturnScreenReference: RefObject<PopupPeerScreen>;
  readonly settingsTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly symbolSettingsTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly updateConfig: UpdateConfig;
}

const PopupApplicationContext = createContext<PopupApplicationContextValue | null>(null);

/** Installs configuration and conversion stores above all popup routes. */
export function PopupApplication({ preview }: PopupApplicationProps) {
  return (
    <ConfigStoreProvider previewConfig={preview?.config}>
      <PopupConversionProvider previewRates={preview?.rates}>
        <RateHistoryProvider
          preview={
            preview === undefined ? undefined : (preview.history ?? EMPTY_HISTORY_PREVIEW)
          }
        >
          <ChartColorsProvider
            preview={preview === undefined ? undefined : (preview.chartColors ?? {})}
          >
            <PopupApplicationContent locale={preview?.locale ?? getUiLocale()} />
          </ChartColorsProvider>
        </RateHistoryProvider>
      </PopupConversionProvider>
    </ConfigStoreProvider>
  );
}

/** Connects route context and document theming to the scoped stores. */
function PopupApplicationContent({ locale }: { readonly locale: UiLocale }) {
  const config = useConfigStore((state) => state.config);
  const error = useConfigStore((state) => state.error);
  const loading = useConfigStore((state) => state.loading);
  const updateConfig = useConfigStore((state) => state.updateConfig);
  const backButtonReference = useRef<HTMLButtonElement>(null);
  const settingsTriggerReference = useRef<HTMLButtonElement>(null);
  const displaySettingsTriggerReference = useRef<HTMLButtonElement>(null);
  const symbolSettingsTriggerReference = useRef<HTMLButtonElement>(null);
  const currenciesTriggerReference = useRef<HTMLButtonElement>(null);
  const aboutTriggerReference = useRef<HTMLButtonElement>(null);
  const licensesTriggerReference = useRef<HTMLButtonElement>(null);
  const previousScreenReference = useRef<PopupScreen | null>(null);
  const screenSwitcherReference = useRef<HTMLButtonElement>(null);
  const settingsReturnScreenReference = useRef<PopupPeerScreen>("converter");

  const theme = config?.theme ?? "system";
  usePopupDocumentTheme(theme);

  return (
    <PopupApplicationContext.Provider
      value={{
        aboutTriggerReference,
        backButtonReference,
        config,
        currenciesTriggerReference,
        displaySettingsTriggerReference,
        error,
        licensesTriggerReference,
        loading,
        locale,
        previousScreenReference,
        screenSwitcherReference,
        settingsReturnScreenReference,
        settingsTriggerReference,
        symbolSettingsTriggerReference,
        updateConfig,
      }}
    >
      <main
        aria-busy={loading}
        className={cn(
          `theme-${theme}`,
          theme === "dark" && "dark",
          "relative h-150 max-h-dvh w-100 max-w-full overflow-x-hidden overflow-y-auto overscroll-none bg-background",
        )}
        data-slot="popup-root"
        data-theme={theme}
      >
        <Outlet />
      </main>
    </PopupApplicationContext.Provider>
  );
}

interface PopupRouteFrameProps {
  readonly children: ReactNode;
  readonly screen: PopupScreen;
}

/**
 * Supplies common header, loading, and error behavior to every popup route. The converter and
 * rates share one frame that changes its screen in place; other routes mount their own.
 */
export function PopupRouteFrame({ children, screen }: PopupRouteFrameProps) {
  const popup = usePopupApplicationContext();
  const navigate = useNavigate();
  const { settingsReturnScreenReference } = popup;
  const alert =
    popup.error === null ? null : (
      <Alert variant="destructive">
        <AlertDescription>{translate(popup.locale, "autoSaveError")}</AlertDescription>
      </Alert>
    );

  const handleBack = () => {
    void navigatePopupRoute(
      () =>
        navigate({
          to:
            screen === "settings"
              ? PEER_SCREEN_PATHS[settingsReturnScreenReference.current]
              : PARENT_ROUTES[screen],
          viewTransition: true,
        }),
      "backward",
    );
  };

  const handleOpenSettings = (fromScreen: PopupPeerScreen) => {
    settingsReturnScreenReference.current = fromScreen;
    void navigatePopupRoute(
      () => navigate({ to: "/settings", viewTransition: true }),
      "forward",
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-slot="popup-route">
      <PopupHeader
        backButtonReference={popup.backButtonReference}
        locale={popup.locale}
        onBack={handleBack}
        onOpenSettings={handleOpenSettings}
        screen={screen}
        settingsButtonReference={popup.settingsTriggerReference}
      />

      {isPeerScreen(screen) ? (
        <div className="shrink-0 px-section pt-section">
          <RatesScreenSwitch
            checkedItemRef={popup.screenSwitcherReference}
            locale={popup.locale}
            // Peer screens swap in place, without the nested-screen slide.
            onValueChange={(peer) => void navigate({ to: PEER_SCREEN_PATHS[peer] })}
            value={screen}
          />
        </div>
      ) : null}

      {/* Only the body scrolls, so the header stays in place on long screens. */}
      <Stack
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-section"
        data-slot="popup-route-body"
        gap="section"
      >
        {alert}
        {popup.loading ? (
          <PopupSkeleton locale={popup.locale} />
        ) : popup.config === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {translate(popup.locale, "autoSaveError")}
          </p>
        ) : (
          children
        )}
      </Stack>
      {/* Remounts per screen, so a shared frame moves focus like a newly opened route. */}
      <ScreenEntryFocus key={screen} screen={screen} />
    </div>
  );
}

/**
 * Moves focus when a screen opens: back to the control that opened the screen the user
 * returned from, to the back button on nested screens, or to the screen switch when a peer
 * screen replaced the control that opened it. It sits after the route body, so its effect
 * runs after the body's own, including Strict Mode's repeated mount effects.
 */
function ScreenEntryFocus({ screen }: { readonly screen: PopupScreen }) {
  const {
    aboutTriggerReference,
    backButtonReference,
    currenciesTriggerReference,
    displaySettingsTriggerReference,
    licensesTriggerReference,
    previousScreenReference,
    screenSwitcherReference,
    settingsTriggerReference,
    symbolSettingsTriggerReference,
  } = usePopupApplicationContext();
  const enteredFromScreen = useRef(previousScreenReference.current).current;
  useEffect(() => {
    previousScreenReference.current = screen;
    const returnTrigger = findReturnFocusTrigger(
      {
        aboutTriggerReference,
        currenciesTriggerReference,
        displaySettingsTriggerReference,
        licensesTriggerReference,
        settingsTriggerReference,
        symbolSettingsTriggerReference,
      },
      screen,
      enteredFromScreen,
    );
    if (returnTrigger !== undefined) {
      returnTrigger.current?.focus({ preventScroll: true });
      return;
    }
    if (isPeerScreen(screen)) {
      // A sparkline opens the rates in place of itself, so focus moves to the switch's new item.
      if (isPeerScreen(enteredFromScreen)) {
        screenSwitcherReference.current?.focus({ preventScroll: true });
      }
      return;
    }
    backButtonReference.current?.focus({ preventScroll: true });
  }, [
    aboutTriggerReference,
    backButtonReference,
    currenciesTriggerReference,
    displaySettingsTriggerReference,
    enteredFromScreen,
    licensesTriggerReference,
    previousScreenReference,
    screen,
    screenSwitcherReference,
    settingsTriggerReference,
    symbolSettingsTriggerReference,
  ]);
  return null;
}

/**
 * Narrows the configuration for screens inside a shared frame, which renders them only once
 * the configuration has loaded.
 */
export function requireLoadedConfig({
  config,
}: Pick<PopupApplicationContextValue, "config">): Config {
  if (config === null) {
    throw new Error("Popup screen rendered before its configuration loaded");
  }
  return config;
}

/** Reads popup state only from descendants of the root route provider. */
export function usePopupApplicationContext(): PopupApplicationContextValue {
  const context = useContext(PopupApplicationContext);
  if (context === null) {
    throw new Error("Popup route rendered outside the application provider");
  }
  return context;
}

interface PopupHeaderProps {
  readonly backButtonReference: RefObject<HTMLButtonElement | null>;
  readonly locale: UiLocale;
  readonly onBack: () => void;
  readonly onOpenSettings: (fromScreen: PopupPeerScreen) => void;
  readonly screen: PopupScreen;
  readonly settingsButtonReference: RefObject<HTMLButtonElement | null>;
}

/** Renders the product header or the nested settings navigation header. */
function PopupHeader({
  backButtonReference,
  locale,
  onBack,
  onOpenSettings,
  screen,
  settingsButtonReference,
}: PopupHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-section border-b p-section">
      {isPeerScreen(screen) ? (
        <>
          <Brand title={translate(locale, "appName")} />
          <div className="flex items-center gap-2">
            <HoverTooltip content={translate(locale, "openSettings")}>
              <IconButton
                label={translate(locale, "openSettings")}
                onClick={() => onOpenSettings(screen)}
                ref={settingsButtonReference}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Settings aria-hidden="true" className="size-5" />
              </IconButton>
            </HoverTooltip>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <HoverTooltip content={translate(locale, "popupBack")}>
            <IconButton
              label={translate(locale, "popupBack")}
              onClick={onBack}
              ref={backButtonReference}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ArrowLeft aria-hidden="true" />
            </IconButton>
          </HoverTooltip>
          <h1 className="text-lg font-semibold" id={`${screen}-title`}>
            {translate(locale, getScreenTitleKey(screen))}
          </h1>
        </div>
      )}
    </header>
  );
}

const SCREEN_TITLE_KEYS = {
  about: "aboutHeading",
  currencies: "supportedCurrenciesHeading",
  "display-settings": "displayHeading",
  licenses: "licensesHeading",
  settings: "settingsHeading",
  "symbol-settings": "ambiguousHeading",
} as const satisfies Record<Exclude<PopupScreen, PopupPeerScreen>, TranslationKey>;

/** Maps nested screens to their visible header titles. */
function getScreenTitleKey(screen: Exclude<PopupScreen, PopupPeerScreen>): TranslationKey {
  return SCREEN_TITLE_KEYS[screen];
}

/** Routes one level above each screen, which the back button opens. */
const PARENT_ROUTES = {
  about: "/settings",
  converter: "/",
  currencies: "/settings",
  "display-settings": "/settings",
  licenses: "/settings/about",
  rates: "/",
  // Settings returns to whichever peer screen opened it; see handleBack.
  settings: "/",
  "symbol-settings": "/settings",
} as const satisfies Record<PopupScreen, "/" | "/settings" | "/settings/about">;

type ReturnFocusTriggers = Pick<
  PopupApplicationContextValue,
  | "aboutTriggerReference"
  | "currenciesTriggerReference"
  | "displaySettingsTriggerReference"
  | "licensesTriggerReference"
  | "settingsTriggerReference"
  | "symbolSettingsTriggerReference"
>;

/** Finds the control that opened the child screen the user just returned from. */
function findReturnFocusTrigger(
  triggers: ReturnFocusTriggers,
  screen: PopupScreen,
  enteredFromScreen: PopupScreen | null,
): RefObject<HTMLButtonElement | null> | undefined {
  const childTriggers: Partial<
    Record<PopupScreen, Partial<Record<PopupScreen, RefObject<HTMLButtonElement | null>>>>
  > = {
    about: { licenses: triggers.licensesTriggerReference },
    converter: { settings: triggers.settingsTriggerReference },
    rates: { settings: triggers.settingsTriggerReference },
    settings: {
      about: triggers.aboutTriggerReference,
      currencies: triggers.currenciesTriggerReference,
      "display-settings": triggers.displaySettingsTriggerReference,
      "symbol-settings": triggers.symbolSettingsTriggerReference,
    },
  };
  return enteredFromScreen === null
    ? undefined
    : childTriggers[screen]?.[enteredFromScreen];
}

/** Distinguishes the side-by-side top screens from nested settings screens. */
function isPeerScreen(screen: PopupScreen | null): screen is PopupPeerScreen {
  return screen === "converter" || screen === "rates";
}

/** Extends the active theme behind the popup to prevent white browser overscroll gaps. */
function usePopupDocumentTheme(theme: Config["theme"]): void {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const themeClass = `theme-${theme}`;
    root.classList.add(themeClass, "overscroll-none", "popup-document");
    root.classList.toggle("dark", theme === "dark");
    body.classList.add("overscroll-none", "bg-background");

    return () => {
      root.classList.remove(themeClass, "overscroll-none", "popup-document");
      delete root.dataset["popupRouteTransitionDirection"];
      delete root.dataset["popupRouteTransitionState"];
      if (theme === "dark") {
        root.classList.remove("dark");
      }
      body.classList.remove("overscroll-none", "bg-background");
    };
  }, [theme]);
}

/** Preserves the popup frame while synchronized configuration is loading. */
function PopupSkeleton({ locale }: { readonly locale: UiLocale }) {
  return (
    <Stack aria-label={translate(locale, "loadingApp")} gap="section" role="status">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
    </Stack>
  );
}
