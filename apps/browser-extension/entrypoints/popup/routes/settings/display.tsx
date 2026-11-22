import { createFileRoute } from "@tanstack/react-router";
import { type Config, configSchema } from "@/lib/currency";
import { useId } from "react";
import { translate, type UiLocale } from "@/lib/i18n";
import { Stack } from "@/components/layout/Stack";
import { TrendColorPicker } from "@/components/rates/TrendColorPicker";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { List, ListItem, ListItemRow } from "@/components/ui/list";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import {
  type PopupApplicationContextValue,
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import { useChartColors, useTrendPalette } from "@/stores/chart-colors";
import { CHANGE_DIRECTIONS, getDefaultTrendColor } from "@/lib/trend-colors";

export const Route = createFileRoute("/settings/display")({
  component: DisplaySettingsRoute,
});

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
  const themeLabelId = useId();
  return (
    <Stack as="section" aria-labelledby="display-settings-title" gap="inset">
      <p className="text-xs text-muted-foreground">
        {translate(locale, "displayDescription")}
      </p>
      <Card spacing="flush">
        <List>
          <ListItem>
            <ListItemRow className="justify-between gap-4">
              <Label id={themeLabelId}>{translate(locale, "displayTheme")}</Label>
              <SegmentedControl
                aria-labelledby={themeLabelId}
                onValueChange={(value) => {
                  updateConfig((current) => ({
                    ...current,
                    theme: configSchema.shape.theme.catch(current.theme).parse(value),
                  }));
                }}
                value={config.theme}
              >
                <SegmentedControlItem value="system">
                  {translate(locale, "displayThemeSystem")}
                </SegmentedControlItem>
                <SegmentedControlItem value="light">
                  {translate(locale, "displayThemeLight")}
                </SegmentedControlItem>
                <SegmentedControlItem value="dark">
                  {translate(locale, "displayThemeDark")}
                </SegmentedControlItem>
              </SegmentedControl>
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
  const settings = useChartColors((state) => state.settings);
  const saveFailed = useChartColors((state) => state.saveFailed);
  const setColor = useChartColors((state) => state.setColor);
  const palette = useTrendPalette();

  return (
    <ListItemRow layout="stacked">
      <Stack gap={0}>
        <h2 className="text-sm font-medium">{translate(locale, "chartColorsHeading")}</h2>
        <p className="text-xs text-muted-foreground">
          {translate(locale, "chartColorsDescription")}
        </p>
      </Stack>
      <div className="grid grid-cols-2 gap-2">
        {CHANGE_DIRECTIONS.map((direction) => {
          const fallback = getDefaultTrendColor(direction);
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
    </ListItemRow>
  );
}
