import React from "react";
import ReactDOM from "react-dom/client";
import "../../assets/popup.css";
import { getUiLocale } from "../../lib/i18n";
import App from "./App.tsx";

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Currency Lens popup root was not found");
}

document.documentElement.lang = getUiLocale();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
