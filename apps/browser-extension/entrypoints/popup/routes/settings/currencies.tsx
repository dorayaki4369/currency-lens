import { createFileRoute } from "@tanstack/react-router";
import { CURRENCY_CODES_BY_ISO_CODE } from "@/lib/currency-order";
import { translate, type UiLocale } from "@/lib/i18n";
import { CurrencyCatalog } from "@/components/currency/CurrencyCatalog";
import { Stack } from "@/components/layout/Stack";
import { Badge } from "@/components/ui/badge";
import {
  PopupRouteFrame,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";

export const Route = createFileRoute("/settings/currencies")({
  component: SupportedCurrenciesRoute,
});

/** Renders the read-only supported-currency catalog under settings. */
function SupportedCurrenciesRoute() {
  const popup = usePopupApplicationContext();

  return (
    <PopupRouteFrame screen="currencies">
      <SupportedCurrencies locale={popup.locale} />
    </PopupRouteFrame>
  );
}

/** Shows the supported catalog without exposing target-editing actions. */
function SupportedCurrencies({ locale }: { readonly locale: UiLocale }) {
  return (
    <Stack
      as="section"
      aria-labelledby="currencies-title"
      className="min-h-0 flex-1"
      gap={3}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {translate(locale, "supportedCurrenciesDescription")}
        </p>
        <div className="shrink-0">
          <Badge variant="secondary">
            {translate(locale, "supportedCurrenciesCount", {
              count: CURRENCY_CODES_BY_ISO_CODE.length,
            })}
          </Badge>
        </div>
      </div>
      <CurrencyCatalog
        className="min-h-0 flex-1"
        headingId="currencies-title"
        listClassName="min-h-0 flex-1"
        locale={locale}
      />
    </Stack>
  );
}
