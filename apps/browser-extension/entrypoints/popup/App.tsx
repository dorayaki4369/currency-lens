import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "@/entrypoints/popup/routeTree.gen";
import type { PopupRouterContext } from "@/entrypoints/popup/PopupApplication";

export type { PopupPreviewData } from "@/entrypoints/popup/PopupApplication";

interface AppProps {
  readonly router: PopupRouter;
}

/** Creates an isolated popup router whose history never changes the extension URL. */
export function createPopupRouter(context: PopupRouterContext = {}) {
  return createRouter({
    context,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree,
  });
}

export type PopupRouter = ReturnType<typeof createPopupRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: PopupRouter;
  }
}

/** Renders the popup router for the lifetime of an opened popup. */
function App({ router }: AppProps) {
  return <RouterProvider router={router} />;
}

export default App;
