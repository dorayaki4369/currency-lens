import { createFileRoute } from "@tanstack/react-router";
import { type Config, configSchema } from "@/lib/currency";
import { useId } from "react";
import { translate, type UiLocale } from "@/lib/i18n";
import { Stack } from "@/components/layout/Stack";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { List, ListItem, ListItemRow } from "@/components/ui/list";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import {
  type PopupApplicationContextValue,
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";

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
    <Stack as="section" aria-labelledby="display-settings-title" gap={2}>
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
        </List>
      </Card>
    </Stack>
  );
}
