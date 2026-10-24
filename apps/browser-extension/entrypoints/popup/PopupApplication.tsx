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
import { getUiLocale, translate, type UiLocale } from "@/lib/i18n";
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

export interface PopupPreviewData {
  readonly config: Config;
  readonly locale?: UiLocale | undefined;
  readonly rates: PopupRatesData;
}

type PopupScreen =
  | "converter"
  | "currencies"
  | "display-settings"
  | "settings"
  | "symbol-settings";

export interface PopupRouterContext {
  readonly preview?: PopupPreviewData | undefined;
}

interface PopupApplicationProps {
  readonly preview?: PopupPreviewData | undefined;
}

type UpdateConfig = (update: (current: Config) => Config) => void;

export interface PopupApplicationContextValue {
  readonly backButtonReference: RefObject<HTMLButtonElement | null>;
  readonly config: Config | null;
  readonly currenciesTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly displaySettingsTriggerReference: RefObject<HTMLButtonElement | null>;
  readonly error: string | null;
  readonly loading: boolean;
  readonly locale: UiLocale;
  readonly previousScreenReference: RefObject<PopupScreen | null>;
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
        <PopupApplicationContent locale={preview?.locale ?? getUiLocale()} />
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
  const previousScreenReference = useRef<PopupScreen | null>(null);

  const theme = config?.theme ?? "system";
  usePopupDocumentTheme(theme);

  return (
    <PopupApplicationContext.Provider
      value={{
        backButtonReference,
        config,
        currenciesTriggerReference,
        displaySettingsTriggerReference,
        error,
        loading,
        locale,
        previousScreenReference,
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

/** Supplies common header, loading, and error behavior to every popup route. */
export function PopupRouteFrame({ children, screen }: PopupRouteFrameProps) {
  const popup = usePopupApplicationContext();
  const navigate = useNavigate();
  const {
    backButtonReference,
    currenciesTriggerReference,
    displaySettingsTriggerReference,
    previousScreenReference,
    settingsTriggerReference,
    symbolSettingsTriggerReference,
  } = popup;
  const enteredFromScreen = useRef(previousScreenReference.current).current;
  const alert =
    popup.error === null ? null : (
      <Alert variant="destructive">
        <AlertDescription>{translate(popup.locale, "autoSaveError")}</AlertDescription>
      </Alert>
    );
  useEffect(() => {
    previousScreenReference.current = screen;
    if (screen === "converter") {
      if (enteredFromScreen === "settings") {
        settingsTriggerReference.current?.focus({ preventScroll: true });
      }
      return;
    }
    if (screen === "settings") {
      const previousTrigger =
        enteredFromScreen === "currencies"
          ? currenciesTriggerReference
          : enteredFromScreen === "display-settings"
            ? displaySettingsTriggerReference
            : enteredFromScreen === "symbol-settings"
              ? symbolSettingsTriggerReference
              : undefined;
      if (previousTrigger !== undefined) {
        previousTrigger.current?.focus({ preventScroll: true });
        return;
      }
    }
    backButtonReference.current?.focus({ preventScroll: true });
  }, [
    backButtonReference,
    currenciesTriggerReference,
    displaySettingsTriggerReference,
    enteredFromScreen,
    previousScreenReference,
    screen,
    settingsTriggerReference,
    symbolSettingsTriggerReference,
  ]);

  const handleBack = () => {
    void navigatePopupRoute(
      () =>
        navigate({
          to: screen === "settings" ? "/" : "/settings",
          viewTransition: true,
        }),
      "backward",
    );
  };

  const handleOpenSettings = () => {
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

      <Stack className="min-h-0 flex-1 p-4" gap={4}>
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
    </div>
  );
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
  readonly onOpenSettings: () => void;
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
    <header className="flex shrink-0 items-center justify-between gap-4 border-b p-4">
      {screen === "converter" ? (
        <>
          <Brand title={translate(locale, "appName")} />
          <div className="flex items-center gap-2">
            <HoverTooltip content={translate(locale, "openSettings")}>
              <IconButton
                label={translate(locale, "openSettings")}
                onClick={onOpenSettings}
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

/** Maps nested screens to their visible header titles. */
function getScreenTitleKey(
  screen: Exclude<PopupScreen, "converter">,
):
  | "ambiguousHeading"
  | "displayHeading"
  | "settingsHeading"
  | "supportedCurrenciesHeading" {
  if (screen === "display-settings") {
    return "displayHeading";
  }
  if (screen === "symbol-settings") {
    return "ambiguousHeading";
  }
  if (screen === "currencies") {
    return "supportedCurrenciesHeading";
  }
  return "settingsHeading";
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
    <Stack aria-label={translate(locale, "loadingApp")} gap={4} role="status">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
    </Stack>
  );
}
