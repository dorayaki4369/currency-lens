// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AmbiguousSymbolSettings } from "@/entrypoints/shared/AmbiguousSymbolSettings";
import {
  getAmbiguousCurrencySymbolGroups,
  type AmbiguousCurrencySymbolGroup,
  type Config,
} from "@/lib/currency";
import { translate } from "@/lib/i18n";

interface MockCurrencyComboboxProps {
  readonly ariaLabel: string;
  readonly badge?:
    | { readonly currencyCode: CurrencyCode; readonly label: string }
    | undefined;
  readonly currencyCodes: readonly CurrencyCode[];
  readonly nullValueLabel?: string | undefined;
  readonly onValueChange: (currencyCode: CurrencyCode) => void;
  readonly value: CurrencyCode | null;
}

vi.mock("@/components/currency/CurrencyCombobox", () => ({
  CurrencyCombobox: ({
    ariaLabel,
    badge,
    currencyCodes,
    nullValueLabel,
    onValueChange,
    value,
  }: MockCurrencyComboboxProps) => {
    const alternative = currencyCodes.find((currencyCode) => currencyCode !== value);
    return (
      <div>
        {badge === undefined ? null : <span>{badge.label}</span>}
        <span data-testid={`selection-${ariaLabel}`}>
          {value ?? nullValueLabel ?? "automatic"}
        </span>
        <button
          aria-label={`choose alternative ${ariaLabel}`}
          onClick={() => {
            if (alternative !== undefined) {
              onValueChange(alternative);
            }
          }}
          type="button"
        />
        {currencyCodes.map((currencyCode) => (
          <button
            aria-label={`choose ${currencyCode} ${ariaLabel}`}
            key={currencyCode}
            onClick={() => onValueChange(currencyCode)}
            type="button"
          />
        ))}
        <button
          aria-label={`choose outside ${ariaLabel}`}
          onClick={() => onValueChange("AED")}
          type="button"
        />
      </div>
    );
  },
}));

const CONFIG: Config = {
  favorites: ["JPY", "EUR", "GBP"],
  symbolOverrides: {},
  theme: "light",
};

afterEach(cleanup);

describe("AmbiguousSymbolSettings", () => {
  it("keeps symbol and currency columns in mirrored source-value order", () => {
    renderSettings(CONFIG, () => undefined);

    const row = document.querySelector('[data-slot="ambiguous-symbol-row"]');
    expect(readSlotOrder(row)).toEqual(["ambiguous-symbols", "ambiguous-currency"]);
  });

  it("shows the default currency without an extra default badge", () => {
    renderSettings(CONFIG, () => undefined);

    expect(screen.queryAllByText("Default")).toHaveLength(0);
  });

  it("applies one supported non-default currency to every alias", () => {
    const group = getTestGroup();
    const alternative = getAlternative(group);
    const updateConfig = vi.fn<(update: (current: Config) => Config) => void>();
    renderSettings(CONFIG, updateConfig);

    expect(screen.getByTestId(`selection-${getLabel(group)}`).textContent).toBe(
      group.defaultCurrency,
    );
    fireEvent.click(
      screen.getByRole("button", { name: `choose alternative ${getLabel(group)}` }),
    );

    const updated = applyUpdate(updateConfig, CONFIG);
    expect(group.tokens.map((token) => updated.symbolOverrides[token])).toEqual(
      group.tokens.map(() => alternative),
    );
  });

  it("removes aliases for the default or an unsupported group currency", () => {
    const group = getTestGroup();
    const alternative = getAlternative(group);
    const configured: Config = {
      ...CONFIG,
      symbolOverrides: Object.fromEntries(
        group.tokens.map((token) => [token, alternative]),
      ),
    };
    const updateConfig = vi.fn<(update: (current: Config) => Config) => void>();
    const { rerender } = renderSettings(configured, updateConfig);

    fireEvent.click(
      screen.getByRole("button", {
        name: `choose ${group.defaultCurrency} ${getLabel(group)}`,
      }),
    );
    expect(applyUpdate(updateConfig, configured).symbolOverrides).toEqual({});

    updateConfig.mockClear();
    rerender(
      <AmbiguousSymbolSettings
        config={configured}
        headingId="heading"
        locale="en"
        updateConfig={updateConfig}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: `choose outside ${getLabel(group)}` }),
    );
    expect(applyUpdate(updateConfig, configured).symbolOverrides).toEqual({});
  });

  it("distinguishes consistent and partially migrated alias settings", () => {
    const group = getMultiTokenGroup();
    const alternative = getAlternative(group);
    const updateConfig = vi.fn<(update: (current: Config) => Config) => void>();
    const secondTokenOnly: Config = {
      ...CONFIG,
      symbolOverrides: { [group.tokens[1] ?? ""]: alternative },
    };
    const { rerender } = renderSettings(secondTokenOnly, updateConfig);

    expect(screen.getByTestId(`selection-${getLabel(group)}`).textContent).toBe(
      translate("en", "ambiguousMixed"),
    );

    const firstTokenOnly: Config = {
      ...CONFIG,
      symbolOverrides: { [group.tokens[0] ?? ""]: alternative },
    };
    rerender(
      <AmbiguousSymbolSettings
        config={firstTokenOnly}
        headingId="heading"
        locale="en"
        updateConfig={updateConfig}
      />,
    );
    expect(screen.getByTestId(`selection-${getLabel(group)}`).textContent).toBe(
      translate("en", "ambiguousMixed"),
    );

    const consistent: Config = {
      ...CONFIG,
      symbolOverrides: Object.fromEntries(
        group.tokens.map((token) => [token, alternative]),
      ),
    };
    rerender(
      <AmbiguousSymbolSettings
        config={consistent}
        headingId="heading"
        locale="en"
        updateConfig={updateConfig}
      />,
    );
    expect(screen.getByTestId(`selection-${getLabel(group)}`).textContent).toBe(
      alternative,
    );
  });
});

/** Renders the shared settings list and returns Testing Library controls. */
function renderSettings(
  config: Config,
  updateConfig: (update: (current: Config) => Config) => void,
) {
  return render(
    <AmbiguousSymbolSettings
      config={config}
      headingId="heading"
      listClassName="test-list"
      locale="en"
      updateConfig={updateConfig}
    />,
  );
}

/** Applies the latest updater captured at the store boundary. */
function applyUpdate(
  updateConfig: ReturnType<typeof vi.fn<(update: (current: Config) => Config) => void>>,
  current: Config,
): Config {
  const update = updateConfig.mock.lastCall?.[0];
  if (update === undefined) {
    throw new Error("Expected a configuration update");
  }
  return update(current);
}

/** Selects a stable ambiguous-symbol group with at least two currencies. */
function getTestGroup(): AmbiguousCurrencySymbolGroup {
  const group = getAmbiguousCurrencySymbolGroups()[0];
  if (group === undefined) {
    throw new Error("Expected at least one ambiguous symbol group");
  }
  return group;
}

/** Selects a group that can represent a partially migrated alias set. */
function getMultiTokenGroup(): AmbiguousCurrencySymbolGroup {
  const group = getAmbiguousCurrencySymbolGroups().find(
    (candidate) => candidate.tokens.length > 1,
  );
  if (group === undefined) {
    throw new Error("Expected an ambiguous symbol group with aliases");
  }
  return group;
}

/** Selects a supported non-default option from the group. */
function getAlternative(group: AmbiguousCurrencySymbolGroup): CurrencyCode {
  const alternative = group.currencyCodes.find(
    (currencyCode) => currencyCode !== group.defaultCurrency,
  );
  if (alternative === undefined) {
    throw new Error("Expected a non-default ambiguous currency");
  }
  return alternative;
}

/** Matches the accessible label supplied to the combobox. */
function getLabel(group: AmbiguousCurrencySymbolGroup): string {
  return group.tokens.join(" ");
}

/** Reads the direct semantic columns from one symbol-mapping row. */
function readSlotOrder(element: Element | null): Array<string | null> {
  return [...(element?.children ?? [])].map((child) => child.getAttribute("data-slot"));
}
