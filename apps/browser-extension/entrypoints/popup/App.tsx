import { useState, useEffect, useCallback } from "react";
import { getConfig, setConfig } from "../../lib/storage";
import { currencies } from "@cl/currency";
import { sendMessage, messageTypes, type GetRatesResponse } from "../../lib/messages";

interface RateData {
  rates: Record<string, string>;
  timestamp: number;
}

function App() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [rateData, setRateData] = useState<RateData | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(true);

  const fetchRates = useCallback(async () => {
    setIsLoadingRates(true);
    setRateError(null);
    try {
      const response = await sendMessage<GetRatesResponse>({
        type: messageTypes.GET_RATES,
      });
      if (response.success && response.data) {
        setRateData(response.data);
      } else {
        setRateError(response.error || "Failed to fetch rates");
      }
    } catch {
      setRateError("Failed to fetch exchange rates");
    } finally {
      setIsLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    getConfig().then((config) => {
      setFavorites(config.favorites as string[]);
    });
    fetchRates();
  }, [fetchRates]);

  const handleAddFavorite = () => {
    if (!selectedCurrency || favorites.includes(selectedCurrency)) {
      return;
    }
    setFavorites([...favorites, selectedCurrency]);
    setSelectedCurrency("");
  };

  const handleRemoveFavorite = (code: string) => {
    setFavorites(favorites.filter((f) => f !== code));
  };

  const handleSave = async () => {
    const config = await getConfig();
    await setConfig({
      ...config,
      // Type assertion needed because internal state uses string[] for simplicity
      // while storage uses branded CurrencyCode type. Zod validates at runtime.
      favorites: favorites as typeof config.favorites,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const majorCurrencies = ["USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF"];
  const sortedCurrencies = [
    ...currencies.filter((c) => majorCurrencies.includes(c.code)),
    ...currencies.filter((c) => !majorCurrencies.includes(c.code)),
  ];

  const calculateRate = (from: string, to: string): string | null => {
    if (!rateData?.rates) return null;
    const fromRate = rateData.rates[from];
    const toRate = rateData.rates[to];
    if (!fromRate || !toRate) return null;
    const rate = Number.parseFloat(toRate) / Number.parseFloat(fromRate);
    if (rate < 0.01) return rate.toFixed(6);
    if (rate < 1) return rate.toFixed(4);
    return rate.toFixed(2);
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const renderRateContent = () => {
    if (isLoadingRates) return <div className="text-sm text-gray-500">Loading rates...</div>;
    if (rateError) return <div className="text-sm text-red-500">{rateError}</div>;
    if (favorites.length === 0) return <div className="text-sm text-gray-500">Add favorite currencies below to see rates.</div>;
    return (
      <div className="space-y-2">
        {favorites.slice(0, 1).map((baseCurrency) => (
          <div key={baseCurrency}>
            <div className="text-sm text-gray-600 mb-2">1 {baseCurrency} equals:</div>
            <div className="space-y-1">
              {favorites.slice(1).map((targetCurrency) => {
                const rate = calculateRate(baseCurrency, targetCurrency);
                return (
                  <div key={targetCurrency} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                    <span className="text-sm font-medium text-gray-800">{targetCurrency}</span>
                    <span className="text-sm font-semibold text-blue-700">{rate || "N/A"}</span>
                  </div>
                );
              })}
            </div>
            {rateData && (
              <div className="text-xs text-gray-400 mt-2">Updated: {formatTimestamp(rateData.timestamp)}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-96 p-4 bg-white">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Currency Lens</h1>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Exchange Rates</h2>
        {renderRateContent()}
      </div>

      <div className="mb-6 pt-4 border-t border-gray-200">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Favorite Currencies</h2>
        <p className="text-sm text-gray-500 mb-3">
          Select your preferred currencies. The first one will be used for conversions.
        </p>

        {favorites.length > 0 && (
          <div className="mb-3 space-y-2">
            {favorites.map((code, index) => {
              const currencyInfo = currencies.find((c) => c.code === code);
              return (
                <div key={code} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm">
                    {index === 0 && <span className="text-blue-600 font-semibold">(Primary) </span>}
                    {code}
                    {currencyInfo && ` - ${currencyInfo.countries.join(", ")}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFavorite(code)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2">
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            aria-label="Select currency"
          >
            <option value="">Select currency...</option>
            {sortedCurrencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.countries.join(", ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddFavorite}
            disabled={!selectedCurrency}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleSave}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 text-sm font-semibold"
        >
          Save Settings
        </button>
        {saved && <span className="text-green-600 text-sm">Settings saved!</span>}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold mb-2 text-gray-700">How to use:</h3>
        <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
          <li>Select text containing a price on any webpage</li>
          <li>Click the blue icon that appears</li>
          <li>View the converted price in your favorite currency</li>
        </ol>
      </div>
    </div>
  );
}

export default App;
