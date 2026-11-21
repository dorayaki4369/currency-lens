import { Pipette } from "lucide-react";
import { useId, useRef, useState } from "react";
import { z } from "zod/v4";
import { translate, type UiLocale } from "@/lib/i18n";
import {
  CHART_COLOR_PALETTE,
  hexColorSchema,
  type ChangeDirection,
} from "@/lib/trend-colors";
import { cn } from "@/lib/utils";
import { FOCUS_RING_CLASS_NAME } from "@/components/ui/focus-ring";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TrendColorPickerProps {
  /** The color now in use, which may be a theme token. */
  readonly color: string;
  /** The locale default as a theme token, shown on the default button. */
  readonly defaultColor: string;
  /** The default's light-theme hex, so the matching swatch reads as selected. */
  readonly defaultHex: string;
  readonly direction: ChangeDirection;
  readonly locale: UiLocale;
  readonly onColorChange: (color: string | null) => void;
  /** The user's choice, or null while the default applies. */
  readonly selectedHex: string | null;
}

interface EyeDropperResult {
  readonly sRGBHex: string;
}

type EyeDropperConstructor = new () => { open: () => Promise<EyeDropperResult> };

// Feature detection as documented for the API; the constructor's shape is the platform's.
const eyeDropperSchema = z.custom<EyeDropperConstructor>(
  (value) => typeof value === "function",
);

// Sample curves from the design, drawn in a 140×28 box.
const SAMPLE_LINES = {
  down: "M0 4 C20 6 30 10 50 9 C70 8 80 16 100 18 C115 20 125 23 140 25",
  up: "M0 24 C20 22 30 18 50 19 C70 20 80 12 100 10 C115 8 125 5 140 3",
} as const satisfies Record<ChangeDirection, string>;
const DIRECTION_KEYS = {
  down: { card: "chartColorDownLabel", name: "chartColorDown" },
  up: { card: "chartColorUpLabel", name: "chartColorUp" },
} as const;

/** Shows one direction's sample trend; pressing it opens the swatches for that direction. */
export function TrendColorPicker({
  color,
  defaultColor,
  defaultHex,
  direction,
  locale,
  onColorChange,
  selectedHex,
}: TrendColorPickerProps) {
  const [open, setOpen] = useState(false);
  const gradientId = `trend-sample-${useId().replaceAll(/[^\w-]/gu, "")}`;
  const directionName = translate(locale, DIRECTION_KEYS[direction].name);
  const cardReference = useRef<HTMLButtonElement>(null);
  const EyeDropper = getEyeDropper();
  const choose = (hex: string | null) => {
    onColorChange(hex === defaultHex ? null : hex);
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        ref={cardReference}
        aria-label={translate(locale, "chartColorOpen", { direction: directionName })}
        className={cn(
          "flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card px-2.5 py-2 text-left hover:bg-accent/40",
          open && "border-zinc-400 dark:border-zinc-500",
          FOCUS_RING_CLASS_NAME,
        )}
        data-slot="trend-color-card"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {translate(locale, DIRECTION_KEYS[direction].card)}
        </span>
        <svg
          aria-hidden="true"
          className="h-7 w-full"
          preserveAspectRatio="none"
          viewBox="0 0 140 28"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: color, stopOpacity: 0.18 }} />
              <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path
            d={`${SAMPLE_LINES[direction]} L140 28 L0 28 Z`}
            fill={`url(#${gradientId})`}
          />
          <path
            d={SAMPLE_LINES[direction]}
            fill="none"
            strokeLinecap="round"
            strokeWidth={2}
            style={{ stroke: color }}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </PopoverTrigger>
      {open ? (
        <PopoverContent
          align={direction === "up" ? "start" : "end"}
          aria-label={translate(locale, "chartColorPicker", { direction: directionName })}
          className="flex h-[10.1875rem] w-[14.375rem] flex-col justify-between rounded-xl p-3.5"
          data-slot="trend-color-picker"
          onCloseAutoFocus={(event) => {
            // Radix leaves focus where an outside click landed; the card keeps it instead.
            event.preventDefault();
            cardReference.current?.focus();
          }}
          sideOffset={6}
        >
          <div className="grid grid-cols-[repeat(6,1.5rem)] justify-between gap-y-2.5">
            {EyeDropper === null ? null : (
              <button
                aria-label={translate(locale, "chartColorEyeDropper")}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border-[1.5px] border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400",
                  FOCUS_RING_CLASS_NAME,
                )}
                onClick={() => {
                  void pickFromScreen(EyeDropper, choose);
                }}
                type="button"
              >
                <Pipette aria-hidden="true" className="size-3.5" />
              </button>
            )}
            {CHART_COLOR_PALETTE.map((swatch) => {
              // While the default applies, only the default button reads as selected.
              const pressed = swatch.hex === selectedHex;
              return (
                <button
                  aria-label={translate(locale, swatch.nameKey)}
                  aria-pressed={pressed}
                  className={cn("size-6 rounded-full", FOCUS_RING_CLASS_NAME)}
                  data-slot="trend-color-swatch"
                  key={swatch.hex}
                  onClick={() => choose(swatch.hex)}
                  style={{
                    backgroundColor: swatch.hex,
                    boxShadow: pressed
                      ? `0 0 0 2px var(--popover), 0 0 0 4px ${swatch.hex}`
                      : undefined,
                  }}
                  type="button"
                />
              );
            })}
          </div>
          <button
            aria-pressed={selectedHex === null}
            className={cn(
              "flex h-8 items-center justify-center gap-2 rounded-lg border-[1.5px] bg-muted text-[0.8125rem] font-semibold",
              selectedHex === null
                ? "border-zinc-400 dark:border-zinc-500"
                : "border-transparent",
              FOCUS_RING_CLASS_NAME,
            )}
            onClick={() => choose(null)}
            type="button"
          >
            {translate(locale, "chartColorDefault")}
            <span
              aria-hidden="true"
              className="size-4 rounded-full"
              data-slot="trend-color-default-dot"
              style={{ backgroundColor: defaultColor }}
            />
          </button>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

/** Returns the EyeDropper API where the browser provides it (not Firefox or Safari). */
function getEyeDropper(): EyeDropperConstructor | null {
  const candidate = eyeDropperSchema.safeParse(Reflect.get(globalThis, "EyeDropper"));
  return candidate.success ? candidate.data : null;
}

/** Lets the user sample a screen color; cancelling or an unusable value changes nothing. */
async function pickFromScreen(
  EyeDropper: EyeDropperConstructor,
  choose: (hex: string) => void,
): Promise<void> {
  try {
    const result = await new EyeDropper().open();
    const hex = hexColorSchema.safeParse(result.sRGBHex);
    if (hex.success) {
      choose(hex.data);
    }
  } catch {
    // The user pressed Escape or the browser refused to open the eyedropper.
  }
}
