import { createFileRoute } from "@tanstack/react-router";
import type { Config } from "@/lib/currency";
import { translate, type UiLocale } from "@/lib/i18n";
import { Stack } from "@/components/layout/Stack";
import { Card, CardContent } from "@/components/ui/card";
import {
  type PopupApplicationContextValue,
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import { AmbiguousSymbolSettings } from "@/entrypoints/shared/AmbiguousSymbolSettings";

export const Route = createFileRoute("/settings/symbols")({
  component: SymbolSettingsRoute,
});

/** Renders ambiguous-symbol preferences under the settings route. */
function SymbolSettingsRoute() {
  const popup = usePopupApplicationContext();

  return (
    <PopupRouteFrame screen="symbol-settings">
      {popup.config === null ? null : (
        <SymbolSettings
          config={popup.config}
          locale={popup.locale}
          updateConfig={popup.updateConfig}
        />
      )}
    </PopupRouteFrame>
  );
}

interface SymbolSettingsProps {
  readonly config: Config;
  readonly locale: UiLocale;
  readonly updateConfig: PopupApplicationContextValue["updateConfig"];
}

/** Edits persisted interpretations for ambiguous currency symbols. */
function SymbolSettings({ config, locale, updateConfig }: SymbolSettingsProps) {
  return (
    <Stack
      as="section"
      aria-labelledby="symbol-settings-title"
      className="min-h-0 flex-1"
      gap={3}
    >
      <p className="text-xs text-muted-foreground">
        {translate(locale, "ambiguousDescription")}
      </p>
      <Card className="flex-1" spacing="none">
        <CardContent>
          <AmbiguousSymbolSettings
            config={config}
            headingId="symbol-settings-title"
            listClassName="min-h-0 flex-1"
            locale={locale}
            updateConfig={updateConfig}
          />
        </CardContent>
      </Card>
    </Stack>
  );
}
