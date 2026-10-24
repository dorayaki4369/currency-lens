import appLogoUrl from "@/assets/icon.svg?inline";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  readonly alt?: string | undefined;
  readonly className?: string | undefined;
}

/** Shares the bundled app artwork across extension surfaces without a host-page asset request. */
export function AppLogo({ alt = "", className }: AppLogoProps) {
  return (
    <img
      alt={alt}
      className={cn(
        "pointer-events-none size-6 shrink-0 select-none object-contain",
        className,
      )}
      data-slot="app-logo"
      draggable={false}
      src={appLogoUrl}
    />
  );
}
