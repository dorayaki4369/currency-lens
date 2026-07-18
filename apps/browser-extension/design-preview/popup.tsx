import React from "react";
import { createRoot } from "react-dom/client";
import "../assets/popup.css";
import App, { type PopupPreviewData } from "../entrypoints/popup/App";

const PREVIEW_DATA: PopupPreviewData = {
  config: {
    favorites: ["JPY", "EUR", "GBP"],
    showCurrencyCode: true,
    showCurrencyIcon: true,
    symbolOverrides: { $: "USD", "¥": "JPY" },
    theme: "light",
  },
  rates: {
    base: "USD",
    fetchedAt: Date.now(),
    isStale: false,
    rates: {
      EUR: "0.8621",
      GBP: "0.7428",
      JPY: "149.45",
      USD: "1",
    },
    sourceTimestamp: Date.now() - 7 * 60 * 1_000,
    warnings: [],
  },
};

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Preview root was not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App preview={PREVIEW_DATA} />
  </React.StrictMode>,
);
