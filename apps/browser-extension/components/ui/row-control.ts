/**
 * Pads a full-width row so its content sits 12px from a flush card's edges, and 12px from
 * the dividers between rows. Row height follows the content.
 */
export const ROW_INSET_CLASS_NAME = "p-3";

/** Embeds a control in a shared row without adding a second surface or border. */
export const ROW_CONTROL_CLASS_NAME = `h-auto w-full rounded-lg border-0 bg-transparent shadow-none hover:bg-transparent focus-visible:ring-inset dark:bg-transparent dark:hover:bg-transparent ${ROW_INSET_CLASS_NAME}`;
