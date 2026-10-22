import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getCurrencyDisplayName, translate, type UiLocale } from "@/lib/i18n";
import { CURRENCY_CODES_BY_ISO_CODE } from "@/lib/currency-order";
import { getCurrencySearchKeywords, matchesCurrencySearch } from "@/lib/currency-search";
import { cn } from "@/lib/utils";
import { CurrencyIdentity } from "@/components/currency/CurrencyIdentity";
import { Stack } from "@/components/layout/Stack";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { List, ListItem } from "@/components/ui/list";

interface CurrencyCatalogProps {
  readonly className?: string | undefined;
  readonly headingId: string;
  readonly listClassName?: string | undefined;
  readonly locale: UiLocale;
}

/** Renders the searchable, read-only catalog shown in popup settings. */
export function CurrencyCatalog({
  className,
  headingId,
  listClassName,
  locale,
}: CurrencyCatalogProps) {
  const [query, setQuery] = useState("");
  const visibleCurrencies = useMemo(() => filterCurrencies(query, locale), [locale, query]);

  return (
    <Stack className={cn("min-h-0", className)} gap={4}>
      <div className="relative">
        <Label className="sr-only" htmlFor={`${headingId}-search`}>
          {translate(locale, "currencySearchLabel")}
        </Label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="pl-9"
          id={`${headingId}-search`}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={translate(locale, "currencySearchPlaceholder")}
          type="search"
          value={query}
        />
      </div>
      <List
        aria-labelledby={headingId}
        as="ul"
        className={cn("overflow-y-auto", listClassName)}
        tabIndex={0}
      >
        {visibleCurrencies.map((currencyCode) => (
          <ListItem as="li" className="py-3" dividerInset="edge" key={currencyCode}>
            <CurrencyIdentity
              currencyCode={currencyCode}
              description={getCurrencyDisplayName(currencyCode, locale)}
            />
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}

/** Filters currencies by localized name, code, or region. */
function filterCurrencies(query: string, locale: UiLocale) {
  return CURRENCY_CODES_BY_ISO_CODE.filter((currencyCode) =>
    matchesCurrencySearch(
      currencyCode,
      query,
      getCurrencySearchKeywords(currencyCode, locale),
      locale,
    ),
  );
}
