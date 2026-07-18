import React from "react";
import { createRoot } from "react-dom/client";
import "./preview.css";
import {
  ConversionPopup,
  type ConversionPopupData,
} from "../entrypoints/content/components/ConversionPopup";
import type { DetectedCurrency } from "../lib/currency-detection";

const DETECTIONS: readonly DetectedCurrency[] = [
  {
    amount: 249,
    currencyCode: "USD",
    index: 0,
    originalText: "$249.00",
  },
  {
    amount: 129.5,
    currencyCode: "EUR",
    index: 22,
    originalText: "€129.50",
  },
];

const DATA: ConversionPopupData = {
  base: "USD",
  fetchedAt: Date.now(),
  isStale: false,
  results: [
    {
      amount: 249,
      convertedAmount: "37212",
      fractionDigits: 0,
      fromCurrency: "USD",
      rate: "149.445",
      sourceIndex: 0,
      status: "converted",
      toCurrency: "JPY",
    },
    {
      amount: 249,
      convertedAmount: "214.66",
      fractionDigits: 2,
      fromCurrency: "USD",
      rate: "0.8621",
      sourceIndex: 0,
      status: "converted",
      toCurrency: "EUR",
    },
    {
      amount: 129.5,
      convertedAmount: "22444",
      fractionDigits: 0,
      fromCurrency: "EUR",
      rate: "173.315",
      sourceIndex: 1,
      status: "converted",
      toCurrency: "JPY",
    },
    {
      amount: 129.5,
      convertedAmount: "111.63",
      fractionDigits: 2,
      fromCurrency: "EUR",
      rate: "0.8621",
      sourceIndex: 1,
      status: "converted",
      toCurrency: "USD",
    },
  ],
  sourceTimestamp: Date.now() - 7 * 60 * 1_000,
};

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Preview root was not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <main className="cl-preview-page">
      <article className="cl-preview-article">
        <nav>ATLAS / FIELD NOTES / TOKYO</nav>
        <p className="cl-preview-kicker">Equipment report · 07</p>
        <h1>A compact kit for a quiet week in Tokyo.</h1>
        <p>
          The everyday camera body is now <mark>$249.00</mark>, while the small field
          recorder has dropped to <mark>€129.50</mark>. Both fit in the same shoulder bag
          and leave room for one fast prime.
        </p>
        <div className="cl-preview-photo" aria-hidden="true">
          <span>FIELD OPTICS</span>
        </div>
      </article>
      <div className="cl-root cl-theme-light cl-preview-lens">
        <ConversionPopup
          data={DATA}
          detections={DETECTIONS}
          error={null}
          floatingStyles={{ position: "relative" }}
          loading={false}
          onClose={() => undefined}
          setFloating={() => undefined}
          showCurrencyCode
          showCurrencyIcon
          visible
        />
      </div>
    </main>
  </React.StrictMode>,
);
