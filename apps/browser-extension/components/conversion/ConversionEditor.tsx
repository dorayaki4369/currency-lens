import type { CurrencyCode } from "@cl/currency";
import { Settings2, X } from "lucide-react";
import {
  createContext,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { MAX_FAVORITE_CURRENCIES } from "@/lib/currency";
import type { CurrencyDropPlacement } from "@/lib/currency-order";
import { getCurrencyDisplayName, translate, type UiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ConversionTargetAmount } from "@/components/conversion/conversion-target-amounts";
import { CurrencyValueRow } from "@/components/conversion/CurrencyValueRow";
import { ReorderableCurrencyList } from "@/components/conversion/ReorderableCurrencyList";
import { CurrencyCombobox } from "@/components/currency/CurrencyCombobox";
import { CurrencyIdentity } from "@/components/currency/CurrencyIdentity";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Stack } from "@/components/layout/Stack";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { List, ListItem } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";

export type { ConversionTargetAmount } from "@/components/conversion/conversion-target-amounts";

export interface ConversionTargetEditing {
  readonly availableCurrencyCodes?: readonly CurrencyCode[] | undefined;
  readonly maximum?: number | undefined;
  readonly onAdd: (currencyCode: CurrencyCode) => void;
  readonly onRemove: (currencyCode: CurrencyCode) => void;
}

interface ConversionEditorProps {
  readonly amountText: string;
  readonly currencyCode: CurrencyCode;
  readonly currencyCodes?: readonly CurrencyCode[] | undefined;
  readonly locale: UiLocale;
  readonly onAmountTextChange: (amountText: string) => void;
  readonly onCurrencyChange: (currencyCode: CurrencyCode) => void;
  readonly onReorderTarget?:
    | ((
        sourceCurrency: CurrencyCode,
        targetCurrency: CurrencyCode,
        placement: CurrencyDropPlacement,
      ) => void)
    | undefined;
  readonly portalled?: boolean | undefined;
  readonly sourceHeadingLevel?: 2 | 3 | undefined;
  readonly targetAmounts: ReadonlyMap<CurrencyCode, ConversionTargetAmount>;
  readonly targetCurrencies: readonly CurrencyCode[];
  readonly targetEditing?: ConversionTargetEditing | undefined;
  readonly targetFallback?: ReactNode | undefined;
  readonly targetFooter?: ReactNode | undefined;
  readonly targetHeadingLevel?: 2 | 3 | undefined;
  readonly targetTitle: ReactNode;
}

const UNAVAILABLE_TARGET_AMOUNT: ConversionTargetAmount = { status: "unavailable" };
const EMPTY_TARGET_AMOUNTS: ReadonlyMap<CurrencyCode, ConversionTargetAmount> = new Map();
const TargetAmountsContext = createContext(EMPTY_TARGET_AMOUNTS);
const TARGET_ROW_CLASS_NAME = "px-3 py-1.5";
const TARGET_EDITING_MOTION_SELECTOR = [
  '[data-slot="currency-value-row"]',
  '[data-slot="currency-leading-action"]',
  '[data-slot="currency-trailing-action"]',
  '[data-slot="target-add-reveal"]',
  '[data-slot="target-add-row"]',
].join(",");

type TargetEditingPhase = "active" | "entering" | "exiting" | "inactive";

/** Renders the shared source editor and ordered conversion targets. */
export function ConversionEditor({
  amountText,
  currencyCode,
  currencyCodes,
  locale,
  onAmountTextChange,
  onCurrencyChange,
  onReorderTarget,
  portalled = true,
  sourceHeadingLevel = 2,
  targetAmounts,
  targetCurrencies,
  targetEditing,
  targetFallback,
  targetFooter,
  targetHeadingLevel = 2,
  targetTitle,
}: ConversionEditorProps) {
  const sourceHeadingId = useId();
  const sourceAmountId = useId();
  const sourceCurrencyId = useId();
  const sourceErrorId = useId();
  const targetHeadingId = useId();
  const sourceAmountReference = useRef<HTMLInputElement>(null);
  const [targetEditingPhase, setTargetEditingPhase] =
    useState<TargetEditingPhase>("inactive");
  const targetEditingIsRendered =
    targetEditing !== undefined && targetEditingPhase !== "inactive";
  const sourceAmountIsInvalid = parseConversionSourceAmount(amountText) === null;
  const targetAmountsAreLoading = targetCurrencies.some(
    (targetCurrencyCode) => targetAmounts.get(targetCurrencyCode)?.status === "loading",
  );

  useEffect(() => {
    sourceAmountReference.current!.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (targetEditing === undefined) {
      setTargetEditingPhase("inactive");
    }
  }, [targetEditing]);

  useEffect(() => {
    if (targetEditingPhase !== "entering") {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      setTargetEditingPhase((current) => (current === "entering" ? "active" : current));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [targetEditingPhase]);

  const toggleTargetEditing = useCallback(() => {
    setTargetEditingPhase((current) => (current === "inactive" ? "entering" : "exiting"));
  }, []);

  const finishTargetEditing = useCallback(() => {
    setTargetEditingPhase("inactive");
  }, []);

  return (
    <Stack gap={3} data-slot="conversion-editor">
      <Stack as="section" aria-labelledby={sourceHeadingId}>
        <SectionHeader
          action={
            <Label className="text-xs text-muted-foreground" htmlFor={sourceAmountId}>
              {translate(locale, "sourceAmount")}
            </Label>
          }
          headingLevel={sourceHeadingLevel}
          id={sourceHeadingId}
          title={translate(locale, "sourceHeading")}
        />
        <CurrencyValueRow
          amount={
            <>
              <Input
                aria-describedby={sourceAmountIsInvalid ? sourceErrorId : undefined}
                aria-invalid={sourceAmountIsInvalid}
                className={cn(
                  "h-12 rounded-lg border-0 bg-card text-right shadow-none [appearance:textfield] tabular-nums focus-visible:ring-0 dark:bg-card",
                  "[&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none",
                )}
                id={sourceAmountId}
                inputMode="decimal"
                min="0"
                onChange={(event) => onAmountTextChange(event.target.value)}
                ref={sourceAmountReference}
                step="any"
                type="number"
                value={amountText}
              />
              {sourceAmountIsInvalid ? (
                <p className="px-3 pb-2 text-xs text-destructive" id={sourceErrorId}>
                  {translate(locale, "sourceAmountInvalid")}
                </p>
              ) : null}
            </>
          }
          className="bg-transparent"
          identity={
            <div className="rounded-lg bg-card">
              <Label className="sr-only" htmlFor={sourceCurrencyId}>
                {translate(locale, "sourceCurrency")}
              </Label>
              <CurrencyCombobox
                ariaLabel={translate(locale, "sourceCurrency")}
                contentClassName={portalled ? undefined : "w-64"}
                currencyCodes={currencyCodes}
                id={sourceCurrencyId}
                locale={locale}
                onValueChange={onCurrencyChange}
                placeholder={translate(locale, "targetChoose")}
                portalled={portalled}
                value={currencyCode}
                variant="row"
              />
            </div>
          }
          currencyCode={currencyCode}
          mode="edit"
        />
      </Stack>

      <Stack
        as="section"
        aria-busy={targetAmountsAreLoading || undefined}
        aria-labelledby={targetHeadingId}
      >
        <SectionHeader
          action={
            <TargetEditingAction
              active={targetEditingIsRendered}
              exiting={targetEditingPhase === "exiting"}
              enabled={targetEditing !== undefined}
              locale={locale}
              onToggle={toggleTargetEditing}
              portalled={portalled}
            />
          }
          headingLevel={targetHeadingLevel}
          id={targetHeadingId}
          title={targetTitle}
        />
        {targetAmountsAreLoading ? (
          <output aria-label={translate(locale, "loadingConversion")} className="sr-only">
            {translate(locale, "loadingConversion")}
          </output>
        ) : null}
        <ConversionTargetArea
          editing={targetEditingIsRendered ? targetEditing : undefined}
          entering={targetEditingPhase === "entering"}
          exiting={targetEditingPhase === "exiting"}
          fallback={targetFallback}
          locale={locale}
          onExitComplete={finishTargetEditing}
          onReorder={targetEditingIsRendered ? onReorderTarget : undefined}
          portalled={portalled}
          targetAmounts={targetAmounts}
          targetCurrencies={targetCurrencies}
        />
        {targetFooter}
      </Stack>
    </Stack>
  );
}

/** Switches the target section between its normal and explicitly editable states. */
function TargetEditingAction({
  active,
  enabled,
  exiting,
  locale,
  onToggle,
  portalled,
}: {
  readonly active: boolean;
  readonly enabled: boolean;
  readonly exiting: boolean;
  readonly locale: UiLocale;
  readonly onToggle: () => void;
  readonly portalled: boolean;
}) {
  if (!enabled) {
    return null;
  }
  const messageKey = active ? "finishTargetEditing" : "editTargets";

  return (
    <HoverTooltip content={translate(locale, messageKey)} portalled={portalled}>
      <IconButton
        aria-disabled={exiting || undefined}
        aria-pressed={active}
        label={translate(locale, messageKey)}
        onClick={exiting ? undefined : onToggle}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {active ? <X aria-hidden="true" /> : <Settings2 aria-hidden="true" />}
      </IconButton>
    </HoverTooltip>
  );
}

interface ConversionTargetAreaProps {
  readonly editing?: ConversionTargetEditing | undefined;
  readonly entering: boolean;
  readonly exiting: boolean;
  readonly fallback?: ReactNode | undefined;
  readonly locale: UiLocale;
  readonly onExitComplete: () => void;
  readonly onReorder?: ConversionEditorProps["onReorderTarget"];
  readonly portalled: boolean;
  readonly targetAmounts: ReadonlyMap<CurrencyCode, ConversionTargetAmount>;
  readonly targetCurrencies: readonly CurrencyCode[];
}

/** Joins editable target rows and their add control inside one list frame. */
function ConversionTargetArea({
  editing,
  entering,
  exiting,
  fallback,
  locale,
  onExitComplete,
  onReorder,
  portalled,
  targetAmounts,
  targetCurrencies,
}: ConversionTargetAreaProps) {
  const isJoined = editing !== undefined && fallback === undefined;
  const content = fallback ?? (
    <ConversionTargetList
      embedded={isJoined}
      locale={locale}
      onRemove={editing?.onRemove}
      onReorder={onReorder}
      targetCurrencies={targetCurrencies}
    />
  );

  return (
    <TargetAmountsContext.Provider value={targetAmounts}>
      {editing === undefined ? (
        content
      ) : (
        <EditableConversionTargets
          editing={editing}
          entering={entering}
          exiting={exiting}
          isJoined={isJoined}
          locale={locale}
          onExitComplete={onExitComplete}
          portalled={portalled}
          targetCurrencies={targetCurrencies}
        >
          {content}
        </EditableConversionTargets>
      )}
    </TargetAmountsContext.Provider>
  );
}

interface EditableConversionTargetsProps {
  readonly children: ReactNode;
  readonly editing: ConversionTargetEditing;
  readonly entering: boolean;
  readonly exiting: boolean;
  readonly isJoined: boolean;
  readonly locale: UiLocale;
  readonly onExitComplete: () => void;
  readonly portalled: boolean;
  readonly targetCurrencies: readonly CurrencyCode[];
}

/** Retains edit-only controls while their entrance or exit motion is visible. */
function EditableConversionTargets({
  children,
  editing,
  entering,
  exiting,
  isJoined,
  locale,
  onExitComplete,
  portalled,
  targetCurrencies,
}: EditableConversionTargetsProps) {
  const editingMotionRoot = useRef<HTMLDivElement>(null);
  useTargetEditingExitCompletion(editingMotionRoot, exiting, onExitComplete);
  const canAddTarget =
    targetCurrencies.length < (editing.maximum ?? MAX_FAVORITE_CURRENCIES);
  const content = (
    <>
      {children}
      {canAddTarget ? (
        <ConversionTargetAdder
          editing={editing}
          embedded={isJoined}
          locale={locale}
          portalled={portalled}
          targetCurrencies={targetCurrencies}
        />
      ) : null}
    </>
  );

  return (
    <div className="contents" ref={editingMotionRoot}>
      {isJoined ? (
        <List
          className={cn(exiting && "pointer-events-none")}
          data-slot="target-editing-list"
          data-target-editing-motion={entering ? "entering" : undefined}
          data-target-editing-state={exiting ? "exiting" : "active"}
        >
          {content}
        </List>
      ) : (
        <Stack
          className={cn(exiting && "pointer-events-none")}
          data-target-editing-motion={entering ? "entering" : undefined}
          data-target-editing-state={exiting ? "exiting" : "active"}
          gap={2}
        >
          {content}
        </Stack>
      )}
    </div>
  );
}

/** Keeps edit-only DOM mounted until its actual CSS transitions have settled. */
function useTargetEditingExitCompletion(
  editingMotionRoot: RefObject<HTMLDivElement | null>,
  exiting: boolean,
  onExitComplete: () => void,
): void {
  useEffect(() => {
    if (!exiting) {
      return undefined;
    }
    const motionElements = editingMotionRoot.current!.querySelectorAll<HTMLElement>(
      TARGET_EDITING_MOTION_SELECTOR,
    );
    const transitions = [...motionElements].flatMap(readElementAnimations);
    let cancelled = false;
    void Promise.allSettled(transitions.map((transition) => transition.finished)).then(
      () => {
        if (!cancelled) {
          onExitComplete();
        }
        return undefined;
      },
    );
    return () => {
      cancelled = true;
    };
  }, [editingMotionRoot, exiting, onExitComplete]);
}

/** Reads only direct CSS transitions from known edit-motion elements. */
function readElementAnimations(element: HTMLElement): readonly Animation[] {
  return typeof element.getAnimations === "function" ? element.getAnimations() : [];
}

interface ConversionTargetListProps {
  readonly embedded: boolean;
  readonly locale: UiLocale;
  readonly onRemove?: ((currencyCode: CurrencyCode) => void) | undefined;
  readonly onReorder?: ConversionEditorProps["onReorderTarget"];
  readonly targetCurrencies: readonly CurrencyCode[];
}

/** Keeps target identities stable while amount cells receive calculation updates. */
const ConversionTargetList = memo(function ConversionTargetList({
  embedded,
  locale,
  onRemove,
  onReorder,
  targetCurrencies,
}: ConversionTargetListProps) {
  if (targetCurrencies.length === 0) {
    return (
      <p
        className={cn(
          "bg-card p-4 text-center text-sm text-muted-foreground",
          !embedded && "rounded-lg",
        )}
      >
        {translate(locale, "targetEmpty")}
      </p>
    );
  }
  return (
    <ReorderableCurrencyList
      ariaLabel={translate(locale, "targetsHeading")}
      deleteDisabled={(_currencyCode, _index, activeItemCount) => activeItemCount === 1}
      getCurrencyCode={(currencyCode) => currencyCode}
      isDeletable={onRemove !== undefined}
      isDraggable={onReorder !== undefined}
      items={targetCurrencies}
      listClassName={embedded ? "rounded-none" : undefined}
      locale={locale}
      onDelete={onRemove}
      onReorder={onReorder}
      renderItem={(currencyCode, _index, actions) =>
        renderConversionTargetValueRow({
          ...actions,
          currencyCode,
          freezeAmount: actions.isDeleting,
          locale,
        })
      }
      rowClassName={TARGET_ROW_CLASS_NAME}
    />
  );
});

interface ConversionTargetValueRowOptions {
  readonly currencyCode: CurrencyCode;
  readonly freezeAmount: boolean;
  readonly leadingAction?: ReactNode | undefined;
  readonly locale: UiLocale;
  readonly trailingAction?: ReactNode | undefined;
}

/** Builds one display-mode currency value with its optional management actions. */
function renderConversionTargetValueRow({
  currencyCode,
  freezeAmount,
  leadingAction,
  locale,
  trailingAction,
}: ConversionTargetValueRowOptions): ReactNode {
  return (
    <CurrencyValueRow
      amount={
        <ConversionTargetAmountView
          currencyCode={currencyCode}
          freeze={freezeAmount}
          locale={locale}
        />
      }
      identity={
        <CurrencyIdentity
          currencyCode={currencyCode}
          description={getCurrencyDisplayName(currencyCode, locale)}
        />
      }
      currencyCode={currencyCode}
      leadingAction={leadingAction}
      mode="display"
      trailingAction={trailingAction}
    />
  );
}

/** Renders only the amount cell when conversion state changes. */
function ConversionTargetAmountView({
  currencyCode,
  freeze,
  locale,
}: {
  readonly currencyCode: CurrencyCode;
  readonly freeze: boolean;
  readonly locale: UiLocale;
}) {
  const targetAmounts = useContext(TargetAmountsContext);
  const currentAmount = targetAmounts.get(currencyCode) ?? UNAVAILABLE_TARGET_AMOUNT;
  const frozenAmount = useRef(currentAmount);

  useEffect(() => {
    if (!freeze) {
      frozenAmount.current = currentAmount;
    }
  }, [currentAmount, freeze]);

  const amount = freeze ? frozenAmount.current : currentAmount;
  const convertedAmount = amount.status === "converted" ? amount : null;
  const lastConvertedAmount = useRef(convertedAmount);

  useEffect(() => {
    if (convertedAmount !== null) {
      lastConvertedAmount.current = convertedAmount;
    }
  }, [convertedAmount]);

  if (amount.status === "loading") {
    if (lastConvertedAmount.current !== null) {
      return (
        <strong
          aria-busy="true"
          className={getTargetAmountClassName(lastConvertedAmount.current.text)}
        >
          <AnimatedNumber
            aria-hidden="true"
            text={lastConvertedAmount.current.text}
            value={lastConvertedAmount.current.value}
          />
          <span className="sr-only">{translate(locale, "loadingConversion")}</span>
        </strong>
      );
    }
    return (
      <>
        <span className="sr-only">{translate(locale, "loadingConversion")}</span>
        <Skeleton aria-hidden="true" className="h-5 w-16" />
      </>
    );
  }
  if (amount.status === "converted") {
    return (
      <strong className={getTargetAmountClassName(amount.text)}>
        <AnimatedNumber text={amount.text} value={amount.value} />
      </strong>
    );
  }
  if (amount.status === "placeholder") {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span className="text-xs text-muted-foreground">
      {translate(locale, "conversionUnavailable")}
    </span>
  );
}

/** Keeps compact exponent values inside the fixed amount column. */
function getTargetAmountClassName(text: string): string {
  return cn(
    "block max-w-full whitespace-nowrap tabular-nums",
    /E[+-]\d+$/u.test(text) && "text-xs",
  );
}

/** Reveals the remaining currency choices while target editing is active. */
function ConversionTargetAdder({
  editing,
  embedded,
  locale,
  portalled,
  targetCurrencies,
}: {
  readonly editing: ConversionTargetEditing;
  readonly embedded: boolean;
  readonly locale: UiLocale;
  readonly portalled: boolean;
  readonly targetCurrencies: readonly CurrencyCode[];
}) {
  const selectId = useId();

  return (
    <div
      className="grid grid-rows-[1fr] overflow-hidden motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-in-out"
      data-slot="target-add-reveal"
    >
      <div className="min-h-0 overflow-hidden" data-slot="target-add-clip">
        <ListItem
          className={cn(
            "flex w-full items-center motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-in-out",
            !embedded && "rounded-lg bg-card",
          )}
          data-slot="target-add-row"
          dividerVisibility={embedded && targetCurrencies.length > 0 ? "visible" : "hidden"}
        >
          <Label className="sr-only" htmlFor={selectId}>
            {translate(locale, "addTarget")}
          </Label>
          <CurrencyCombobox
            ariaLabel={translate(locale, "addTarget")}
            contentClassName={portalled ? undefined : "w-64"}
            currencyCodes={editing.availableCurrencyCodes}
            disabledCurrencyCodes={targetCurrencies}
            id={selectId}
            locale={locale}
            onValueChange={editing.onAdd}
            placeholder={translate(locale, "addTarget")}
            portalled={portalled}
            value={null}
            variant="row"
          />
        </ListItem>
      </div>
    </div>
  );
}

/** Parses an editable amount without accepting empty, non-finite, or zero values. */
export function parseConversionSourceAmount(amountText: string): number | null {
  const amount = Number(amountText);
  return amountText.trim().length > 0 && Number.isFinite(amount) && amount > 0
    ? amount
    : null;
}
