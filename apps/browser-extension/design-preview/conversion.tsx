import React from "react";
import { createRoot } from "react-dom/client";
import { z } from "zod/v4";
import { ConversionPopup } from "../entrypoints/content/components/ConversionPopup";
import { PREVIEW_CONVERSION_DATA, PREVIEW_DETECTION } from "./data";
import "./preview.css";

const previewStateSchema = z
  .enum(["empty", "error", "loading", "success"])
  .catch("success");
const previewMotionSchema = z.enum(["default", "reduce"]).catch("default");

const previewSearchParameters = new URLSearchParams(window.location.search);
const previewState = previewStateSchema.parse(previewSearchParameters.get("state"));
const previewMotion = previewMotionSchema.parse(previewSearchParameters.get("motion"));
const previewMotionClassName = {
  default: "",
  reduce: " cl-preview-reduced-motion",
}[previewMotion];
const previewStateProps = {
  empty: {
    data: null,
    detection: null,
    error: null,
    loading: false,
  },
  error: {
    data: null,
    detection: PREVIEW_DETECTION,
    error: "RATES_UNAVAILABLE",
    loading: false,
  },
  loading: {
    data: null,
    detection: PREVIEW_DETECTION,
    error: null,
    loading: true,
  },
  success: {
    data: PREVIEW_CONVERSION_DATA,
    detection: PREVIEW_DETECTION,
    error: null,
    loading: false,
  },
} as const;

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
      <div className={`cl-root cl-theme-light cl-preview-lens${previewMotionClassName}`}>
        <ConversionPopup
          {...previewStateProps[previewState]}
          floatingStyles={{ position: "relative" }}
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
