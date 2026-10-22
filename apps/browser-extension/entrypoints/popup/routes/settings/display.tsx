import { createFileRoute } from "@tanstack/react-router";
import type { Config } from "@/lib/currency";
import { translate, type UiLocale } from "@/lib/i18n";
import { Stack } from "@/components/layout/Stack";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
  return (
    <Stack as="section" aria-labelledby="display-settings-title" gap={3}>
      <p className="text-xs text-muted-foreground">
        {translate(locale, "displayDescription")}
      </p>
      <Card className="shadow-none" spacing="row">
        <CardContent>
          <div className="flex items-center justify-between gap-4">
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
          </div>
        </CardContent>
      </Card>
    </Stack>
  );
}
