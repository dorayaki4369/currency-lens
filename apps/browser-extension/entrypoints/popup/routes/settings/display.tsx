import { createFileRoute } from "@tanstack/react-router";
import type { Config } from "@/lib/currency";
import { translate, type UiLocale } from "@/lib/i18n";
import { Stack } from "@/components/layout/Stack";
import { TrendColorPicker } from "@/components/rates/TrendColorPicker";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { List, ListItem, ListItemRow } from "@/components/ui/list";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  type PopupApplicationContextValue,
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import {
  usePopupChartColors,
  useTrendPalette,
} from "@/entrypoints/popup/stores/chart-colors";
import {
  getDefaultTrendColor,
  getTrendColorScheme,
  type ChangeDirection,
} from "@/lib/trend-colors";

export const Route = createFileRoute("/settings/display")({
  component: DisplaySettingsRoute,
});

const CHANGE_DIRECTIONS = ["up", "down"] as const satisfies readonly ChangeDirection[];

/** Renders display preferences under the settings route. */
function DisplaySettingsRoute() {
  const popup = usePopupApplicationContext();

  return (
    <PopupRouteFrame screen="display-settings">
      {popup.config === null ? null : (
        <DisplaySettings
          config={popup.config}
          locale={popup.locale}
          updateConfig={popup.updateConfig}
        />
      )}
    </PopupRouteFrame>
  );
}

interface DisplaySettingsProps {
  readonly config: Config;
  readonly locale: UiLocale;
  readonly updateConfig: PopupApplicationContextValue["updateConfig"];
}

/** Edits the persisted popup appearance preference. */
function DisplaySettings({ config, locale, updateConfig }: DisplaySettingsProps) {
  return (
    <Stack as="section" aria-labelledby="display-settings-title" gap={3}>
      <p className="text-xs text-muted-foreground">
        {translate(locale, "displayDescription")}
      </p>
      <Card spacing="none">
        <List>
          <ListItem>
            <ListItemRow className="justify-between gap-4">
              <Label htmlFor="theme-select">{translate(locale, "displayTheme")}</Label>
              <NativeSelect
                className="h-8 px-2 py-1 pr-8"
                id="theme-select"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "light" || value === "dark" || value === "system") {
                    updateConfig((current) => ({ ...current, theme: value }));
                  }
                }}
                value={config.theme}
                wrapperClassName="w-32"
              >
                <NativeSelectOption value="system">
                  {translate(locale, "displayThemeSystem")}
                </NativeSelectOption>
                <NativeSelectOption value="light">
                  {translate(locale, "displayThemeLight")}
                </NativeSelectOption>
                <NativeSelectOption value="dark">
                  {translate(locale, "displayThemeDark")}
                </NativeSelectOption>
              </NativeSelect>
            </ListItemRow>
          </ListItem>
          <ListItem>
            <ChartColorSettingsRow locale={locale} />
          </ListItem>
        </List>
      </Card>
    </Stack>
  );
}

/** Lets the user replace the rise and fall colors used by charts and sparklines. */
function ChartColorSettingsRow({ locale }: { readonly locale: UiLocale }) {
  const settings = usePopupChartColors((state) => state.settings);
  const saveFailed = usePopupChartColors((state) => state.saveFailed);
  const setColor = usePopupChartColors((state) => state.setColor);
  const palette = useTrendPalette(locale);
  const scheme = getTrendColorScheme(locale);

  return (
    <Stack className="px-3 py-3.5" gap={2}>
      <Stack gap={0}>
        <h2 className="text-sm font-medium">{translate(locale, "chartColorsHeading")}</h2>
        <p className="text-xs text-muted-foreground">
          {translate(locale, "chartColorsDescription")}
        </p>
      </Stack>
      <div className="grid grid-cols-2 gap-2">
        {CHANGE_DIRECTIONS.map((direction) => {
          const fallback = getDefaultTrendColor(direction, scheme);
          return (
            <TrendColorPicker
              color={palette[direction].line}
              defaultColor={fallback.line}
              defaultHex={fallback.hex}
              direction={direction}
              key={direction}
              locale={locale}
              onColorChange={(color) => setColor(direction, color)}
              selectedHex={settings[direction] ?? null}
            />
          );
        })}
      </div>
      {saveFailed ? (
        <p className="text-xs text-destructive" role="alert">
          {translate(locale, "autoSaveError")}
        </p>
      ) : null}
    </Stack>
  );
}
