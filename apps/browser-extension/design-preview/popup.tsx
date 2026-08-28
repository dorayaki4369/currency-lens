import React from "react";
import { createRoot } from "react-dom/client";
import "../assets/popup.css";
import App, { type PopupPreviewData } from "../entrypoints/popup/App";
import { PREVIEW_CONFIG, PREVIEW_RATES } from "./data";

const PREVIEW_DATA: PopupPreviewData = {
  config: PREVIEW_CONFIG,
  locale: "ja",
  rates: PREVIEW_RATES,
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
