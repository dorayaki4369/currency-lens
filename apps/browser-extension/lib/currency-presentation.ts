import type { CurrencyCode } from "@cl/currency";
import bitcoinIcon from "cryptocurrency-icons/svg/color/btc.svg?url";
import bitSharesIcon from "cryptocurrency-icons/svg/color/bts.svg?url";
import dashIcon from "cryptocurrency-icons/svg/color/dash.svg?url";
import dogecoinIcon from "cryptocurrency-icons/svg/color/doge.svg?url";
import ethereumIcon from "cryptocurrency-icons/svg/color/eth.svg?url";
import litecoinIcon from "cryptocurrency-icons/svg/color/ltc.svg?url";
import nxtIcon from "cryptocurrency-icons/svg/color/nxt.svg?url";
import stellarIcon from "cryptocurrency-icons/svg/color/xlm.svg?url";
import moneroIcon from "cryptocurrency-icons/svg/color/xmr.svg?url";
import xrpIcon from "cryptocurrency-icons/svg/color/xrp.svg?url";
import { getCurrencyFlagRegion } from "@/lib/currency-flags";

interface CryptocurrencyPresentation {
  readonly iconUrl: string | null;
  readonly mark: string;
}

const CRYPTOCURRENCY_PRESENTATIONS: Readonly<
  Partial<Record<CurrencyCode, CryptocurrencyPresentation>>
> = {
  BTC: { iconUrl: bitcoinIcon, mark: "₿" },
  BTS: { iconUrl: bitSharesIcon, mark: "BTS" },
  DASH: { iconUrl: dashIcon, mark: "Đ" },
  DOGE: { iconUrl: dogecoinIcon, mark: "Ð" },
  ETH: { iconUrl: ethereumIcon, mark: "Ξ" },
  LD: { iconUrl: null, mark: "L$" },
  LTC: { iconUrl: litecoinIcon, mark: "Ł" },
  NXT: { iconUrl: nxtIcon, mark: "NXT" },
  STR: { iconUrl: stellarIcon, mark: "✦" },
  XMR: { iconUrl: moneroIcon, mark: "ɱ" },
  XRP: { iconUrl: xrpIcon, mark: "XRP" },
};

const SPECIAL_MARKS = {
  XAG: "Ag",
  XAU: "Au",
  XDR: "SDR",
  XPD: "Pd",
  XPT: "Pt",
} as const satisfies Partial<Record<CurrencyCode, string>>;

export type CurrencyPresentation =
  | {
      readonly iconUrl: string | null;
      readonly kind: "cryptocurrency";
      readonly mark: string;
    }
  | { readonly kind: "fiat"; readonly regionCode: string }
  | { readonly kind: "other"; readonly mark: string };

/** Resolves one non-misleading visual identity for a supported currency. */
export function getCurrencyPresentation(currencyCode: CurrencyCode): CurrencyPresentation {
  const cryptocurrency = CRYPTOCURRENCY_PRESENTATIONS[currencyCode];
  if (cryptocurrency !== undefined) {
    return { kind: "cryptocurrency", ...cryptocurrency };
  }

  const flagRegion = getCurrencyFlagRegion(currencyCode);
  if (flagRegion !== null) {
    return { kind: "fiat", regionCode: flagRegion };
  }

  return {
    kind: "other",
    mark: readMappedValue(SPECIAL_MARKS, currencyCode) ?? "¤",
  };
}

/** Reads a partial code map without widening its keys at call sites. */
function readMappedValue(
  values: Readonly<Partial<Record<CurrencyCode, string>>>,
  currencyCode: CurrencyCode,
): string | undefined {
  return values[currencyCode];
}
