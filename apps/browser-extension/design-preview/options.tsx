import React from "react";
import { createRoot } from "react-dom/client";
import "../assets/options.css";
import App from "../entrypoints/options/App";
import { PREVIEW_CONFIG } from "./data";

const rootElement = document.querySelector("#root");
if (rootElement === null) {
  throw new Error("Preview root was not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App preview={{ config: PREVIEW_CONFIG, locale: "ja" }} />
  </React.StrictMode>,
);
