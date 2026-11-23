import { createFileRoute, Outlet, useMatch } from "@tanstack/react-router";
import { PopupRouteFrame } from "@/entrypoints/popup/PopupApplication";

export const Route = createFileRoute("/_peer")({
  component: PeerScreensRoute,
});

/**
 * Keeps one header and screen switch mounted while the converter and rates swap below them,
 * so the switch's thumb slides instead of starting over on each screen.
 */
function PeerScreensRoute() {
  const ratesMatch = useMatch({ from: "/_peer/rates", shouldThrow: false });
  return (
    <PopupRouteFrame screen={ratesMatch === undefined ? "converter" : "rates"}>
      <Outlet />
    </PopupRouteFrame>
  );
}
