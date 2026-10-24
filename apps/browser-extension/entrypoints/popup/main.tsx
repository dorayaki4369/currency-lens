import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "@/assets/style.css";
import { getUiLocale } from "@/lib/i18n";
import App, { createPopupRouter } from "@/entrypoints/popup/App.tsx";

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Currency Lens popup root was not found");
}

document.documentElement.lang = getUiLocale();
const router = createPopupRouter();

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <App router={router} />
  </StrictMode>,
);
