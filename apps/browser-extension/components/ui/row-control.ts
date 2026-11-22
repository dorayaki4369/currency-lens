/**
 * Pads a full-width row so its content sits 8px (p-2) from a flush card's edges and
 * from the dividers between rows. Row height follows the content.
 */
// Buttons widen their side padding next to an icon; a row keeps the same 8px regardless.
export const ROW_INSET_CLASS_NAME = "p-2 has-[>svg]:px-2";

/** Keeps an interactive row at least 44px tall, the minimum touch target. */
export const ROW_TOUCH_TARGET_CLASS_NAME = "min-h-11";

/** Embeds a control in a shared row without adding a second surface or border. */
export const ROW_CONTROL_CLASS_NAME = `h-auto w-full rounded-lg border-0 bg-transparent shadow-none hover:bg-transparent focus-visible:ring-inset dark:bg-transparent dark:hover:bg-transparent ${ROW_INSET_CLASS_NAME} ${ROW_TOUCH_TARGET_CLASS_NAME}`;
