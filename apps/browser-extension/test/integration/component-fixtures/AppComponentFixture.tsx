import type { CurrencyCode } from "@cl/currency";
import { Settings, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "@/components/layout/Brand";
import {
  ConversionEditor,
  type ConversionTargetAmount,
} from "@/components/conversion/ConversionEditor";
import { CurrencyValueRow } from "@/components/conversion/CurrencyValueRow";
import { ReorderableCurrencyList } from "@/components/conversion/ReorderableCurrencyList";
import { CurrencyCatalog } from "@/components/currency/CurrencyCatalog";
import { CurrencyCombobox } from "@/components/currency/CurrencyCombobox";
import { CurrencyIcon } from "@/components/currency/CurrencyIcon";
import { CurrencyIdentity } from "@/components/currency/CurrencyIdentity";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Stack } from "@/components/layout/Stack";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { IconButton } from "@/components/ui/icon-button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ConversionPopup } from "@/entrypoints/content/components/ConversionPopup";
import { FloatingIcon } from "@/entrypoints/content/components/FloatingIcon";
import { AmbiguousSymbolSettings } from "@/entrypoints/shared/AmbiguousSymbolSettings";
import { formatConvertedAmount, getCurrencyDisplayName } from "@/lib/i18n";
import {
  FIXTURE_CONFIG,
  FIXTURE_CONVERSION_DATA,
  FIXTURE_DETECTION,
} from "@/test/integration/fixture-data";
import type { ComponentFixtureId } from "@/test/integration/component-fixtures/fixtures";
import type { UiFixtureId } from "@/test/integration/component-fixtures/UiComponentFixture";

const LIST_CURRENCIES = ["JPY", "USD", "EUR"] as const satisfies readonly CurrencyCode[];
const LIST_AMOUNTS: Readonly<Record<(typeof LIST_CURRENCIES)[number], string>> = {
  EUR: "0.86",
  JPY: "149.45",
  USD: "1.00",
};
const EDITOR_TARGET_AMOUNTS: ReadonlyMap<CurrencyCode, ConversionTargetAmount> = new Map([
  [
    "JPY",
    {
      status: "converted",
      text: formatConvertedAmount("1267165358", "ja"),
      value: 1_267_165_358,
    },
  ],
  ["EUR", { status: "converted", text: "214.66", value: 214.66 }],
  ["GBP", { status: "converted", text: "184.96", value: 184.96 }],
]);
const FULL_EDITOR_TARGET_CURRENCIES = [
  "USD",
  "EUR",
  "JPY",
  "CNY",
  "BTC",
] as const satisfies readonly CurrencyCode[];
const FULL_EDITOR_TARGET_AMOUNTS: ReadonlyMap<CurrencyCode, ConversionTargetAmount> =
  new Map([
    ["USD", { status: "converted", text: "249.00", value: 249 }],
    ["EUR", { status: "converted", text: "214.66", value: 214.66 }],
    ["JPY", { status: "converted", text: "37,228.05", value: 37_228.05 }],
    ["CNY", { status: "converted", text: "1,788.52", value: 1_788.52 }],
    ["BTC", { status: "converted", text: "0.00", value: 0 }],
  ]);

export type AppFixtureId = Exclude<ComponentFixtureId, UiFixtureId>;

/** Renders one Currency Lens component with stable browser-integration data. */
export function AppComponentFixture({ fixtureId }: { readonly fixtureId: AppFixtureId }) {
  const fixtures = {
    brand: <Brand eyebrow="選択した金額をその場で換算" title="Currency Lens" />,
    "conversion-popup-empty": <ConversionPopupFixture state="empty" />,
    "conversion-popup-error": <ConversionPopupFixture state="error" />,
    "conversion-popup-loading": <ConversionPopupFixture state="loading" />,
    "conversion-popup-success": <ConversionPopupFixture state="success" />,
    "conversion-editor": <ConversionEditorFixture full={false} />,
    "conversion-editor-editing": <ConversionEditorFixture full={false} singleTarget />,
    "conversion-editor-full": <ConversionEditorFixture full />,
    "currency-value-row": (
      <CurrencyValueRow
        amount={<AnimatedNumber text="149.45" value={149.45} />}
        identity={<CurrencyIdentity currencyCode="JPY" description="日本円" />}
        currencyCode="JPY"
        mode="display"
      />
    ),
    "currency-catalog": (
      <Stack as="section" gap={3}>
        <h2 className="font-semibold" id="fixture-currency-catalog">
          対応通貨一覧
        </h2>
        <CurrencyCatalog
          headingId="fixture-currency-catalog"
          listClassName="max-h-80"
          locale="ja"
        />
      </Stack>
    ),
    "currency-combobox": <CurrencyComboboxFixture open={false} />,
    "currency-combobox-open": <CurrencyComboboxFixture open />,
    "currency-icons": (
      <div className="flex items-center gap-5">
        {(["JPY", "USD", "EUR", "BTC", "XAU"] as const).map((currencyCode) => (
          <Stack as="span" className="text-center" key={currencyCode}>
            <CurrencyIcon className="mx-auto" currencyCode={currencyCode} />
            <small className="block text-xs">{currencyCode}</small>
          </Stack>
        ))}
      </div>
    ),
    "currency-identity": <CurrencyIdentity currencyCode="USD" description="米ドル" />,
    "floating-icon": (
      <div className="grid gap-4">
        {["bg-white text-black", "bg-zinc-950 text-white"].map((surface) => (
          <div className={`${surface} rounded-lg p-5 shadow-inner`} key={surface}>
            <p className="mb-4">Europe: €100.50</p>
            <FloatingIcon
              floatingStyles={{ position: "relative" }}
              locale="ja"
              onClick={() => undefined}
              setFloating={() => undefined}
            />
          </div>
        ))}
      </div>
    ),
    "hover-tooltip": (
      <div data-fixture-hover-tooltip>
        <HoverTooltip content="設定" portalled={false}>
          <IconButton label="設定" variant="outline">
            <Settings />
          </IconButton>
        </HoverTooltip>
      </div>
    ),
    "icon-button": (
      <IconButton label="設定" variant="outline">
        <Settings />
      </IconButton>
    ),
    "reorderable-currency-list": <CurrencyListFixture />,
    "reorderable-currency-list-dragging": <CurrencyListFixture />,
    "section-header": (
      <SectionHeader
        action={
          <IconButton label="換算後を編集" size="icon-sm" variant="ghost">
            <Settings2 />
          </IconButton>
        }
        description="換算結果に表示する通貨を選びます。"
        id="fixture-section-header"
        title="換算後"
      />
    ),
    stack: (
      <div className="grid grid-cols-2 gap-4">
        <Stack className="rounded-lg border p-3" data-fixture-stack="default">
          <span className="rounded bg-muted px-3 py-2 text-sm">換算元</span>
          <span className="rounded bg-muted px-3 py-2 text-sm">換算後</span>
        </Stack>
        <Stack className="rounded-lg border p-3" data-fixture-stack="wide" gap={4}>
          <span className="rounded bg-muted px-3 py-2 text-sm">換算元</span>
          <span className="rounded bg-muted px-3 py-2 text-sm">換算後</span>
        </Stack>
      </div>
    ),
    "symbol-settings": (
      <section className="max-h-[680px] overflow-hidden">
        <h2 className="sr-only" id="fixture-symbol-settings">
          通貨記号
        </h2>
        <AmbiguousSymbolSettings
          config={FIXTURE_CONFIG}
          headingId="fixture-symbol-settings"
          locale="ja"
          updateConfig={() => undefined}
        />
      </section>
    ),
  } satisfies Readonly<Record<AppFixtureId, ReactNode>>;
  return fixtures[fixtureId];
}

function ConversionEditorFixture({
  full,
  singleTarget = false,
}: {
  readonly full: boolean;
  readonly singleTarget?: boolean | undefined;
}) {
  return (
    <ConversionEditor
      amountText="249"
      currencyCode="USD"
      locale="ja"
      onAmountTextChange={() => undefined}
      onCurrencyChange={() => undefined}
      onReorderTarget={() => undefined}
      targetAmounts={full ? FULL_EDITOR_TARGET_AMOUNTS : EDITOR_TARGET_AMOUNTS}
      targetCurrencies={
        full
          ? FULL_EDITOR_TARGET_CURRENCIES
          : singleTarget
            ? ["JPY"]
            : FIXTURE_CONFIG.favorites
      }
      targetEditing={{ onAdd: () => undefined, onRemove: () => undefined }}
      targetTitle="換算後"
    />
  );
}

function CurrencyComboboxFixture({ open }: { readonly open: boolean }) {
  return (
    <div>
      <CurrencyCombobox
        ariaLabel="換算元通貨"
        badge={{ currencyCode: "USD", label: "デフォルト" }}
        className="w-full"
        currencyCodes={["JPY", "USD", "EUR", "BTC", "XAU"]}
        locale="ja"
        onValueChange={() => undefined}
        open={open}
        placeholder="通貨を選択"
        portalled={false}
        value="USD"
      />
    </div>
  );
}

function CurrencyListFixture() {
  return (
    <ReorderableCurrencyList
      ariaLabel="換算後の通貨"
      getCurrencyCode={(currencyCode) => currencyCode}
      isDeletable
      isDraggable
      items={LIST_CURRENCIES}
      listClassName="overflow-hidden rounded-xl border"
      locale="ja"
      onDelete={() => undefined}
      onReorder={() => undefined}
      renderItem={(currencyCode, _index, actions) => (
        <CurrencyValueRow
          amount={
            <strong className="tabular-nums">
              <AnimatedNumber
                text={LIST_AMOUNTS[currencyCode]}
                value={Number(LIST_AMOUNTS[currencyCode])}
              />
            </strong>
          }
          identity={
            <CurrencyIdentity
              currencyCode={currencyCode}
              description={getCurrencyDisplayName(currencyCode, "ja")}
            />
          }
          currencyCode={currencyCode}
          leadingAction={actions.leadingAction}
          mode="display"
          trailingAction={actions.trailingAction}
        />
      )}
      rowClassName="px-3 py-3"
    />
  );
}

function ConversionPopupFixture({
  state,
}: {
  readonly state: "empty" | "error" | "loading" | "success";
}) {
  const stateProps = {
    empty: { data: null, detection: null, error: null, loading: false },
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

  return (
    <ConversionPopup
      {...stateProps[state]}
      floatingStyles={{
        left: "var(--fixture-dialog-left)",
        position: "fixed",
        top: "3rem",
      }}
      locale="ja"
      onClose={() => undefined}
      onReorderTarget={() => undefined}
      setFloating={() => undefined}
      targetCurrencies={FIXTURE_CONFIG.favorites}
      targetEditing={{ onAdd: () => undefined, onRemove: () => undefined }}
      visible
    />
  );
}
