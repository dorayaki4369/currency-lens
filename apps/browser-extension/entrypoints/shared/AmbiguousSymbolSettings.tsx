import { useId, useMemo } from "react";
import { ROW_INSET_CLASS_NAME } from "@/components/ui/row-control";
import {
  getAmbiguousCurrencySymbolGroups,
  isKnownCurrencyCode,
  type AmbiguousCurrencySymbolGroup,
  type Config,
} from "@/lib/currency";
import { translate, type UiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CurrencyCombobox } from "@/components/currency/CurrencyCombobox";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { List, ListItem } from "@/components/ui/list";

const MIXED_OVERRIDE_VALUE = "__mixed_alias_settings__";

interface AmbiguousSymbolSettingsProps {
  readonly config: Config;
  readonly headingId: string;
  readonly listClassName?: string | undefined;
  readonly locale: UiLocale;
  readonly updateConfig: (update: (current: Config) => Config) => void;
}

/** Renders the shared ambiguous-symbol list used by both settings surfaces. */
export function AmbiguousSymbolSettings({
  config,
  headingId,
  listClassName,
  locale,
  updateConfig,
}: AmbiguousSymbolSettingsProps) {
  const groups = useMemo(() => getAmbiguousCurrencySymbolGroups(), []);

  const handleChange = (group: AmbiguousCurrencySymbolGroup, value: string) => {
    updateConfig((current) => {
      const symbolOverrides = { ...current.symbolOverrides };
      for (const token of group.tokens) {
        if (isKnownCurrencyCode(value) && group.currencyCodes.includes(value)) {
          symbolOverrides[token] = value;
        } else {
          delete symbolOverrides[token];
        }
      }
      return { ...current, symbolOverrides };
    });
  };

  return (
    <Card className={cn("overflow-hidden", listClassName)} spacing="flush">
      <List aria-labelledby={headingId} as="ul" className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((group) => (
          <ListItem as="li" key={group.tokens.join("")}>
            <SymbolMappingRow
              group={group}
              locale={locale}
              onChange={handleChange}
              value={getGroupOverride(config, group)}
            />
          </ListItem>
        ))}
      </List>
    </Card>
  );
}

/** Renders one ambiguous-symbol family and its persisted interpretation. */
function SymbolMappingRow({
  group,
  locale,
  onChange,
  value,
}: {
  readonly group: AmbiguousCurrencySymbolGroup;
  readonly locale: UiLocale;
  readonly onChange: (group: AmbiguousCurrencySymbolGroup, value: string) => void;
  readonly value: string;
}) {
  const selectId = useId();
  const selectedCurrency = isKnownCurrencyCode(value) ? value : null;
  return (
    <div
      className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-inset"
      data-slot="ambiguous-symbol-row"
    >
      <Label
        className={cn("min-w-0", ROW_INSET_CLASS_NAME)}
        data-slot="ambiguous-symbols"
        htmlFor={selectId}
      >
        <span className="flex flex-wrap gap-1.5">
          {group.tokens.map((token) => (
            <code className="text-sm" key={token}>
              {token}
            </code>
          ))}
        </span>
      </Label>
      <div className="min-w-0" data-slot="ambiguous-currency">
        <CurrencyCombobox
          ariaLabel={group.tokens.join(" ")}
          currencyCodes={group.currencyCodes}
          id={selectId}
          locale={locale}
          nullOption={{
            label: translate(locale, "ambiguousAutomatic"),
            onSelect: () => onChange(group, ""),
            selected: value === "",
          }}
          nullValueLabel={translate(
            locale,
            value === MIXED_OVERRIDE_VALUE ? "ambiguousMixed" : "ambiguousAutomatic",
          )}
          onValueChange={(currencyCode) => onChange(group, currencyCode)}
          placeholder={translate(locale, "targetChoose")}
          value={selectedCurrency}
          variant="row"
        />
      </div>
    </div>
  );
}

/** Distinguishes automatic, consistent, and partially migrated alias settings. */
function getGroupOverride(config: Config, group: AmbiguousCurrencySymbolGroup): string {
  const values = group.tokens.map((token) => config.symbolOverrides[token]);
  if (values.every((value) => value === undefined)) {
    return "";
  }
  const [firstValue] = values;
  return firstValue !== undefined && values.every((value) => value === firstValue)
    ? firstValue
    : MIXED_OVERRIDE_VALUE;
}
