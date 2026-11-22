import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The layout spacing tokens in assets/style.css, so their padding and gap classes replace
// the numeric ones they override instead of both applying.
const twMerge = extendTailwindMerge({
  extend: { theme: { spacing: ["inset", "section", "unit"] } },
});

/** Merges conditional Tailwind classes without retaining conflicting utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
