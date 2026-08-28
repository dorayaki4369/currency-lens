// @vitest-environment happy-dom

import { currencies } from "@cl/currency";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App, { type OptionsPreviewData } from "../entrypoints/options/App";
import { type Config, getAmbiguousCurrencySymbolGroups } from "../lib/currency";

const PREVIEW: OptionsPreviewData = {
  config: {
    favorites: ["JPY", "EUR", "GBP"],
    showCurrencyCode: true,
    showCurrencyIcon: true,
    symbolOverrides: {},
    theme: "light",
  },
  locale: "en",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("currency interpretation options", () => {
  it("lists every ambiguous symbol family and every bundled currency", () => {
    render(<App preview={PREVIEW} />);

    const symbolList = screen.getByRole("list", { name: "Ambiguous symbols" });
    const currencyList = screen.getByRole("list", { name: "Supported currencies" });
    expect(screen.getAllByRole("combobox")).toHaveLength(
      getAmbiguousCurrencySymbolGroups().length,
    );
    expect(within(symbolList).getAllByRole("listitem")).toHaveLength(
      getAmbiguousCurrencySymbolGroups().length,
    );
    expect(within(currencyList).getAllByRole("listitem")).toHaveLength(currencies.length);
    expect(screen.getByText(`${currencies.length} currencies`)).toBeDefined();
    expect(
      screen.getByRole("heading", { level: 1, name: "Conversion settings" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Close settings" })).toBeDefined();
  });

  it("filters the complete currency catalog by localized code or name", () => {
    render(<App preview={PREVIEW} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search currencies" }), {
      target: { value: "Japanese Yen" },
    });

    const currencyList = screen.getByRole("list", { name: "Supported currencies" });
    expect(within(currencyList).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("JPY")).toBeDefined();
  });

  it("saves one choice for every alias in an ambiguous symbol family", async () => {
    const dollarGroup = getAmbiguousCurrencySymbolGroups().find((group) =>
      group.tokens.includes("$"),
    );
    if (dollarGroup === undefined) {
      throw new Error("Expected an ambiguous dollar-symbol group");
    }
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      const messageType = readMessageType(message);
      if (messageType === "GET_CONFIG") {
        return Promise.resolve({ data: PREVIEW.config, success: true });
      }
      if (messageType === "SET_CONFIG") {
        return Promise.resolve({
          data: {
            ...PREVIEW.config,
            symbolOverrides: Object.fromEntries(
              dollarGroup.tokens.map((token) => [token, "CAD"]),
            ),
          },
          success: true,
        });
      }
      return Promise.reject(new TypeError("Unexpected message type"));
    });
    vi.stubGlobal("browser", {
      i18n: { getUILanguage: () => "en-US" },
      runtime: { sendMessage },
    });
    render(<App />);

    const dollarSelect = await screen.findByLabelText(dollarGroup.tokens.join(" "));
    fireEvent.change(dollarSelect, { target: { value: "CAD" } });

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        payload: {
          ...PREVIEW.config,
          symbolOverrides: Object.fromEntries(
            dollarGroup.tokens.map((token) => [token, "CAD"]),
          ),
        },
        type: "SET_CONFIG",
      }),
    );
  });

  it("renders Japanese headings and localized currency names", () => {
    render(<App preview={{ ...PREVIEW, locale: "ja" }} />);

    expect(screen.getByRole("heading", { name: "曖昧な通貨記号" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "対応通貨" })).toBeDefined();
    expect(screen.getByRole("heading", { level: 1, name: "換算設定" })).toBeDefined();
    expect(screen.getByText("日本円")).toBeDefined();
  });

  it("shows a mixed state instead of claiming that partial legacy aliases agree", () => {
    const dollarGroup = getAmbiguousCurrencySymbolGroups().find((group) =>
      group.tokens.includes("$"),
    );
    if (dollarGroup === undefined) {
      throw new Error("Expected an ambiguous dollar-symbol group");
    }
    render(
      <App
        preview={{
          ...PREVIEW,
          config: { ...PREVIEW.config, symbolOverrides: { $: "CAD" } },
        }}
      />,
    );

    expect(screen.getByLabelText(dollarGroup.tokens.join(" "))).toHaveProperty(
      "value",
      "__mixed_alias_settings__",
    );
    expect(screen.getByText("Mixed alias settings · choose a value")).toBeDefined();
  });

  it("distinguishes consistent aliases from partially migrated aliases", () => {
    const dollarGroup = requireDollarGroup();
    const consistentOverrides: Config["symbolOverrides"] = Object.fromEntries(
      dollarGroup.tokens.map((token) => [token, "CAD"]),
    );
    const partialOverrides: Config["symbolOverrides"] = {
      [dollarGroup.tokens[1] ?? "$unknown"]: "CAD",
    };
    const { unmount } = render(
      <App
        preview={{
          ...PREVIEW,
          config: { ...PREVIEW.config, symbolOverrides: consistentOverrides },
        }}
      />,
    );

    expect(screen.getByLabelText(dollarGroup.tokens.join(" "))).toHaveProperty(
      "value",
      "CAD",
    );

    unmount();
    render(
      <App
        preview={{
          ...PREVIEW,
          config: { ...PREVIEW.config, symbolOverrides: partialOverrides },
        }}
      />,
    );
    expect(screen.getByLabelText(dollarGroup.tokens.join(" "))).toHaveProperty(
      "value",
      "__mixed_alias_settings__",
    );
  });

  it("clears automatic and unrelated currency choices for a symbol family", () => {
    const dollarGroup = requireDollarGroup();
    render(<App preview={PREVIEW} />);
    const select = screen.getByLabelText<HTMLSelectElement>(dollarGroup.tokens.join(" "));

    fireEvent.change(select, { target: { value: "CAD" } });
    expect(select.value).toBe("CAD");
    fireEvent.change(select, { target: { value: "" } });
    expect(select.value).toBe("");

    const unrelatedOption = document.createElement("option");
    unrelatedOption.value = "JPY";
    unrelatedOption.textContent = "JPY";
    select.append(unrelatedOption);
    fireEvent.change(select, { target: { value: "JPY" } });
    expect(select.value).toBe("");
  });

  it("closes the options page from its localized control", () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
    render(<App preview={PREVIEW} />);

    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));

    expect(close).toHaveBeenCalledOnce();
  });

  it("shows a terminal load failure after removing the loading skeleton", async () => {
    vi.stubGlobal("browser", {
      i18n: { getUILanguage: () => "en-US" },
      runtime: {
        sendMessage: vi.fn<() => Promise<unknown>>(() =>
          Promise.resolve({ error: "Configuration unavailable", success: false }),
        ),
      },
    });
    render(<App />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Couldn’t save your settings.",
    );
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Loading Currency Lens" })).toBeNull(),
    );
  });

  it("hides the save status after an immediate persistence failure", async () => {
    const dollarGroup = requireDollarGroup();
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      if (readMessageType(message) === "GET_CONFIG") {
        return Promise.resolve({ data: PREVIEW.config, success: true });
      }
      return Promise.resolve({ error: "Storage quota exceeded", success: false });
    });
    vi.stubGlobal("browser", {
      i18n: { getUILanguage: () => "en-US" },
      runtime: { sendMessage },
    });
    render(<App />);
    const select = await screen.findByLabelText(dollarGroup.tokens.join(" "));

    fireEvent.change(select, { target: { value: "CAD" } });

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.queryByText("Saved automatically")).toBeNull();
  });

  it("falls back to the currency code when number parts omit a symbol", () => {
    vi.spyOn(Intl.NumberFormat.prototype, "formatToParts").mockReturnValue([
      { type: "integer", value: "0" },
    ]);
    const { container } = render(<App preview={PREVIEW} />);

    expect(container.querySelector(".cl-currency-mark")?.textContent).toBe("A");
  });

  it("falls back to the currency code when number formatting throws", () => {
    vi.spyOn(Intl, "NumberFormat").mockImplementation(() => {
      throw new RangeError("Unsupported currency");
    });
    const { container } = render(<App preview={PREVIEW} />);

    expect(container.querySelector(".cl-currency-mark")?.textContent).toBe("A");
  });
});

/** Returns the dollar group used by symbol override interaction tests. */
function requireDollarGroup() {
  const group = getAmbiguousCurrencySymbolGroups().find((candidate) =>
    candidate.tokens.includes("$"),
  );
  if (group === undefined) {
    throw new Error("Expected an ambiguous dollar-symbol group");
  }
  return group;
}

/** Reads only the request discriminant needed by the test double. */
function readMessageType(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? Reflect.get(message, "type")
    : undefined;
}
