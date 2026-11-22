import { createFileRoute } from "@tanstack/react-router";
import { RatesScreen } from "@/components/rates/RatesScreen";
import {
  requireLoadedConfig,
  usePopupApplicationContext,
} from "@/entrypoints/popup/PopupApplication";
import { usePopupConversion } from "@/entrypoints/popup/stores/conversion";

export const Route = createFileRoute("/_peer/rates")({
  component: RatesRoute,
});

/** Renders the rate history screen beside the converter, with the converter's source as base. */
function RatesRoute() {
  const popup = usePopupApplicationContext();
  const rates = usePopupConversion((state) => state.rates);
  const sourceCurrency = usePopupConversion((state) => state.sourceCurrency);
  const setSourceCurrency = usePopupConversion((state) => state.setSourceCurrency);

  return (
    <RatesScreen
      baseCurrency={sourceCurrency}
      favorites={requireLoadedConfig(popup).favorites}
      locale={popup.locale}
      onBaseCurrencyChange={setSourceCurrency}
      rateTime={rates.data}
    />
  );
}
