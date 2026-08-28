import React from "react";
import { createRoot } from "react-dom/client";
import { ConversionPopup } from "../entrypoints/content/components/ConversionPopup";
import { PREVIEW_CONVERSION_DATA, PREVIEW_DETECTION } from "./data";
import "./preview.css";

const rootElement = document.querySelector("#root");
if (rootElement === null) {
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
          The everyday camera body is now <mark>$249.00</mark>. It fits in the same shoulder
          bag and leaves room for one fast prime.
        </p>
        <div className="cl-preview-photo" aria-hidden="true">
          <span>FIELD OPTICS</span>
        </div>
      </article>
      <div className="cl-root cl-theme-light cl-preview-lens">
        <ConversionPopup
          data={PREVIEW_CONVERSION_DATA}
          detection={PREVIEW_DETECTION}
          error={null}
          floatingStyles={{ position: "relative" }}
          loading={false}
          locale="ja"
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
