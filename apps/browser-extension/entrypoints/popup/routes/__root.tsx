import { createRootRouteWithContext } from "@tanstack/react-router";
import {
  PopupApplication,
  type PopupRouterContext,
} from "@/entrypoints/popup/PopupApplication";

export const Route = createRootRouteWithContext<PopupRouterContext>()({
  component: PopupRootRoute,
});

/** Connects router context to popup-owned application state. */
function PopupRootRoute() {
  const { preview } = Route.useRouteContext();
  return <PopupApplication preview={preview} />;
}
