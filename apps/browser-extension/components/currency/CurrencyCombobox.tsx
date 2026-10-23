import type { CurrencyCode } from "@cl/currency";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { compareCurrencyCodes, CURRENCY_CODES_BY_ISO_CODE } from "@/lib/currency-order";
import { getCurrencySearchKeywords, matchesCurrencySearch } from "@/lib/currency-search";
import { getCurrencyDisplayName, translate, type UiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CurrencyIdentity } from "@/components/currency/CurrencyIdentity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROW_CONTROL_CLASS_NAME } from "@/components/ui/row-control";

const CURRENCY_TRIGGER_CLASS_NAMES = {
  outline: "",
  row: ROW_CONTROL_CLASS_NAME,
} as const;

interface CurrencyBadge {
  readonly currencyCode: CurrencyCode;
  readonly label: string;
}

interface CurrencyComboboxProps {
  readonly ariaLabel: string;
  readonly badge?: CurrencyBadge | undefined;
  readonly className?: string | undefined;
  readonly contentClassName?: string | undefined;
  readonly currencyCodes?: readonly CurrencyCode[] | undefined;
  readonly defaultOpen?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly disabledCurrencyCodes?: readonly CurrencyCode[] | undefined;
  readonly id?: string | undefined;
  readonly locale: UiLocale;
  readonly nullValueLabel?: string | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly onValueChange: (currencyCode: CurrencyCode) => void;
  readonly open?: boolean | undefined;
  readonly placeholder: string;
  readonly portalled?: boolean | undefined;
  readonly value: CurrencyCode | null;
  readonly variant?: "outline" | "row" | undefined;
}

/** Renders a searchable shadcn combobox with consistent currency identities. */
export function CurrencyCombobox({
  ariaLabel,
  badge,
  className,
  contentClassName,
  currencyCodes,
  defaultOpen = false,
  disabled = false,
  disabledCurrencyCodes = [],
  id,
  locale,
  nullValueLabel,
  onOpenChange,
  onValueChange,
  open: controlledOpen,
  placeholder,
  portalled = true,
  value,
  variant = "outline",
}: CurrencyComboboxProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const triggerReference = useRef<HTMLButtonElement>(null);
  const contentReference = useRef<HTMLDivElement>(null);
  const rootPointerDismissedReference = useRef(false);
  const disabledCodes = new Set(disabledCurrencyCodes);
  const orderedCurrencyCodes =
    currencyCodes === undefined
      ? CURRENCY_CODES_BY_ISO_CODE
      : currencyCodes.toSorted(compareCurrencyCodes);
  const selectedLabel = nullValueLabel ?? placeholder;

  /** Synchronizes controlled and uncontrolled visibility. */
  const changeOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        rootPointerDismissedReference.current = false;
      }
      setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  useRootPointerDismissal(
    open,
    triggerReference,
    contentReference,
    rootPointerDismissedReference,
    changeOpen,
  );

  /** Lets the pointer's native focus target win when the local root dismissed the picker. */
  const preservePointerTargetFocus = useCallback((event: Event) => {
    if (!rootPointerDismissedReference.current) {
      return;
    }
    rootPointerDismissedReference.current = false;
    event.preventDefault();
  }, []);

  /** Reports one selection and closes its options. */
  const selectValue = (currencyCode: CurrencyCode) => {
    onValueChange(currencyCode);
    changeOpen(false);
  };

  return (
    <Popover onOpenChange={changeOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          className={cn(
            "h-auto min-h-12 min-w-0 justify-between overflow-hidden px-3 py-1.5 font-normal",
            CURRENCY_TRIGGER_CLASS_NAMES[variant],
            className,
          )}
          disabled={disabled}
          id={id}
          ref={triggerReference}
          role="combobox"
          type="button"
          variant="outline"
        >
          {value === null ? (
            <span className="truncate text-muted-foreground">{selectedLabel}</span>
          ) : (
            <CurrencyOption badge={badge} currencyCode={value} locale={locale} />
          )}
          <ChevronsUpDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </Button>
      </PopoverTrigger>
      {open ? (
        <CurrencyOptions
          badge={badge}
          contentClassName={contentClassName}
          currencyCodes={orderedCurrencyCodes}
          disabledCodes={disabledCodes}
          locale={locale}
          onCloseAutoFocus={preservePointerTargetFocus}
          onSelectCurrency={selectValue}
          portalled={portalled}
          ref={contentReference}
          value={value}
        />
      ) : null}
    </Popover>
  );
}

interface CurrencyOptionsProps {
  readonly badge?: CurrencyBadge | undefined;
  readonly contentClassName?: string | undefined;
  readonly currencyCodes: readonly CurrencyCode[];
  readonly disabledCodes: ReadonlySet<CurrencyCode>;
  readonly locale: UiLocale;
  readonly onCloseAutoFocus: (event: Event) => void;
  readonly onSelectCurrency: (currencyCode: CurrencyCode) => void;
  readonly portalled: boolean;
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly value: CurrencyCode | null;
}

/** Renders the searchable option list separately from the trigger state. */
function CurrencyOptions({
  badge,
  contentClassName,
  currencyCodes,
  disabledCodes,
  locale,
  onCloseAutoFocus,
  onSelectCurrency,
  portalled,
  ref,
  value,
}: CurrencyOptionsProps) {
  return (
    <PopoverContent
      align="start"
      aria-label={translate(locale, "currencySearchLabel")}
      avoidCollisions
      className={cn(
        "w-[var(--radix-popover-trigger-width)] min-w-64 p-0",
        contentClassName,
      )}
      onCloseAutoFocus={onCloseAutoFocus}
      portalled={portalled}
      ref={ref}
      side="bottom"
    >
      <Command
        filter={(currencyCode, search, keywords) =>
          filterCurrencyOption(currencyCode, search, keywords, locale)
        }
        label={translate(locale, "currencySearchLabel")}
      >
        <CommandInput
          aria-label={translate(locale, "currencySearchLabel")}
          placeholder={translate(locale, "currencySearchPlaceholder")}
        />
        <CommandList>
          <CommandEmpty>{translate(locale, "currencyNoResults")}</CommandEmpty>
          <CommandGroup>
            {currencyCodes.map((currencyCode) => {
              return (
                <CommandItem
                  disabled={disabledCodes.has(currencyCode)}
                  key={currencyCode}
                  keywords={getCurrencySearchKeywords(currencyCode, locale)}
                  onSelect={() => onSelectCurrency(currencyCode)}
                  value={currencyCode}
                >
                  <CurrencyOption
                    badge={badge}
                    currencyCode={currencyCode}
                    locale={locale}
                  />
                  {value === currencyCode ? (
                    <CheckIcon aria-hidden="true" className="ml-auto" />
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}

/** Closes an open picker from the local Document or ShadowRoot before retargeting. */
function useRootPointerDismissal(
  open: boolean,
  triggerReference: RefObject<HTMLButtonElement | null>,
  contentReference: RefObject<HTMLDivElement | null>,
  rootPointerDismissedReference: RefObject<boolean>,
  onDismiss: (open: boolean) => void,
): void {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const trigger = triggerReference.current;
    if (trigger === null) {
      return undefined;
    }
    const root = trigger.getRootNode();
    /** Clears a dismissal marker when a controlled picker remains open. */
    const clearPointerDismissal = () => {
      rootPointerDismissedReference.current = false;
      root.removeEventListener("pointerup", clearPointerDismissal, true);
      root.removeEventListener("pointercancel", clearPointerDismissal, true);
    };
    /** Dismisses only when the pointer path leaves both parts of this picker. */
    const handlePointerDown = (event: Event) => {
      const content = contentReference.current;
      if (content === null) {
        return;
      }
      const path = event.composedPath();
      if (path.includes(trigger) || path.includes(content)) {
        return;
      }
      rootPointerDismissedReference.current = true;
      root.addEventListener("pointerup", clearPointerDismissal, true);
      root.addEventListener("pointercancel", clearPointerDismissal, true);
      onDismiss(false);
    };
    root.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      root.removeEventListener("pointerdown", handlePointerDown, true);
      root.removeEventListener("pointerup", clearPointerDismissal, true);
      root.removeEventListener("pointercancel", clearPointerDismissal, true);
    };
  }, [contentReference, onDismiss, open, rootPointerDismissedReference, triggerReference]);
}

/** Matches codes, localized names, and regions by a predictable substring search. */
function filterCurrencyOption(
  value: string,
  search: string,
  keywords: readonly string[] | undefined,
  locale: UiLocale,
): number {
  return matchesCurrencySearch(value, search, keywords, locale) ? 1 : 0;
}

/** Displays one currency's icon, code, localized name, and optional badge. */
function CurrencyOption({
  badge,
  currencyCode,
  locale,
}: {
  readonly badge?: CurrencyBadge | undefined;
  readonly currencyCode: CurrencyCode;
  readonly locale: UiLocale;
}) {
  const badgeLabel = badge?.currencyCode === currencyCode ? badge.label : undefined;
  return (
    <CurrencyIdentity
      badge={
        badgeLabel === undefined ? undefined : (
          <Badge variant="secondary">{badgeLabel}</Badge>
        )
      }
      currencyCode={currencyCode}
      description={getCurrencyDisplayName(currencyCode, locale)}
    />
  );
}
