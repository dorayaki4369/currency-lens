import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import "@/test/integration/browser-stub";
import "@/test/integration/style.css";
import shadowStyleText from "@/test/integration/style.css?inline";
import { Stack } from "@/components/layout/Stack";
import App, { createPopupRouter, type PopupPreviewData } from "@/entrypoints/popup/App";
import { ConversionPopup } from "@/entrypoints/content/components/ConversionPopup";
import { cn } from "@/lib/utils";
import {
  FIXTURE_CONFIG,
  FIXTURE_CONVERSION_DATA,
  FIXTURE_DETECTION,
  FIXTURE_RATES,
} from "@/test/integration/fixture-data";
import { ComponentFixture } from "@/test/integration/component-fixtures/ComponentFixture";
import type { COMPONENT_FIXTURES } from "@/test/integration/component-fixtures/fixtures";

export type ConversionCardState = "empty" | "error" | "loading" | "success";

export interface ConversionScreenOptions {
  readonly motion: "default" | "reduce";
  readonly root: "document" | "shadow";
  readonly state: ConversionCardState;
}

export interface PopupScreenOptions {
  readonly theme: PopupPreviewData["config"]["theme"];
}

const conversionStateProps = {
  empty: {
    data: null,
    detection: null,
    error: null,
    loading: false,
  },
  error: {
    data: null,
    detection: FIXTURE_DETECTION,
    error: "RATES_UNAVAILABLE",
    loading: false,
  },
  loading: {
    data: null,
    detection: FIXTURE_DETECTION,
    error: null,
    loading: true,
  },
  success: {
    data: FIXTURE_CONVERSION_DATA,
    detection: FIXTURE_DETECTION,
    error: null,
    loading: false,
  },
} as const;

/** Renders the popup with deterministic settings and rates. */
export function mountPopupScreen(container: Element, options: PopupScreenOptions): Root {
  const root = createRoot(container);
  const preview: PopupPreviewData = {
    config: { ...FIXTURE_CONFIG, theme: options.theme },
    locale: "ja",
    rates: FIXTURE_RATES,
  };
  root.render(
    <StrictMode>
      <App router={createPopupRouter({ preview })} />
    </StrictMode>,
  );
  return root;
}

/** Renders the conversion card beside a representative host article. */
export function mountConversionScreen(
  container: Element,
  options: ConversionScreenOptions,
): Root {
  const renderRoot = options.root === "shadow" ? createShadowRoot(container) : container;
  const motionClassName =
    options.motion === "reduce" ? "[&_*]:!animate-none [&_*]:!transition-none" : "";
  const root = createRoot(renderRoot);
  root.render(
    <StrictMode>
      <main
        className={cn(
          "theme-light min-h-screen bg-muted/40 p-8 text-foreground",
          motionClassName,
        )}
        data-motion={options.motion}
      >
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_20rem]">
          <Stack
            as="article"
            className="rounded-xl border bg-card p-8 text-card-foreground shadow-sm"
            gap={6}
          >
            <nav className="text-xs font-medium text-muted-foreground">
              ATLAS / FIELD NOTES / TOKYO
            </nav>
            <p className="text-sm text-muted-foreground">Equipment report · 07</p>
            <h1 className="text-4xl font-semibold tracking-tight">
              A compact kit for a quiet week in Tokyo.
            </h1>
            <p className="text-lg leading-8">
              The everyday camera body is now <mark>$249.00</mark>. It fits in the same
              shoulder bag and leaves room for one fast prime.
            </p>
            <div
              className="flex aspect-video items-end rounded-lg bg-muted p-6 text-sm font-medium text-muted-foreground"
              aria-hidden="true"
            >
              <span>FIELD OPTICS</span>
            </div>
          </Stack>
          <div data-slot="conversion-host">
            <ConversionPopup
              {...conversionStateProps[options.state]}
              floatingStyles={{ position: "relative" }}
              locale="ja"
              onClose={() => undefined}
              onReorderTarget={() => undefined}
              setFloating={() => undefined}
              targetCurrencies={FIXTURE_CONFIG.favorites}
              targetEditing={{ onAdd: () => undefined, onRemove: () => undefined }}
              visible
            />
          </div>
        </div>
      </main>
    </StrictMode>,
  );
  return root;
}

/** Renders one component fixture in both themes. */
export function mountComponentFixture(
  container: Element,
  fixture: (typeof COMPONENT_FIXTURES)[number],
): Root {
  document.body.dataset["componentFixture"] = fixture.id;
  const root = createRoot(container);
  root.render(<ComponentFixture fixture={fixture} />);
  return root;
}

/** Mirrors the extension's style injection when exercising a Shadow DOM screen. */
function createShadowRoot(host: Element): ShadowRoot {
  const shadowRoot = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = shadowStyleText;
  shadowRoot.append(style);
  return shadowRoot;
}
