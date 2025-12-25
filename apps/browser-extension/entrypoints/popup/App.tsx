import { useState, useEffect } from "react";
import { getConfig, setConfig } from "../../lib/storage";
import { currencies } from "@cl/currency";
import type { z } from "zod/v4";
import type { configSchema } from "../../lib/currency";

type Config = z.infer<typeof configSchema>;
type CurrencyCode = Config["favorites"][number];

function App() {
  const [favorites, setFavorites] = useState<CurrencyCode[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getConfig().then((config) => {
      setFavorites(config.favorites);
    });
  }, []);

  const handleAddFavorite = () => {
    if (!selectedCurrency || favorites.includes(selectedCurrency as CurrencyCode)) {
      return;
    }
    setFavorites([...favorites, selectedCurrency as CurrencyCode]);
    setSelectedCurrency("");
  };

  const handleRemoveFavorite = (code: CurrencyCode) => {
    setFavorites(favorites.filter((f) => f !== code));
  };

  const handleSave = async () => {
    const config = await getConfig();
    await setConfig({
      ...config,
      favorites,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const majorCurrencies = ["USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF"];
  const sortedCurrencies = [
    ...currencies.filter((c) => majorCurrencies.includes(c.code)),
    ...currencies.filter((c) => !majorCurrencies.includes(c.code)),
  ];

  return (
    <div className="w-96 p-4 bg-white">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Currency Lens Settings</h1>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-700">Favorite Currencies</h2>
        <p className="text-sm text-gray-500 mb-3">
          Select your preferred currencies. The first one will be used for conversions.
        </p>

        {favorites.length > 0 && (
          <div className="mb-3 space-y-2">
            {favorites.map((code, index) => {
              const currencyInfo = currencies.find((c) => c.code === (code as string));
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
