import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import "@/assets/style.css";
import App from "@/entrypoints/content/App.tsx";

export default defineContentScript({
  cssInjectionMode: "ui",
  matches: ["<all_urls>"],
  async main(context) {
    const ui = await createShadowRootUi<Root>(context, {
      name: "currency-lens-overlay",
      // assets/style.css stacks the host above the page; WXT's inline z-index loses to its reset.
      position: "overlay",
      isolateEvents: ["keydown", "keyup", "keypress", "pointerdown", "click"],
      onMount(container) {
        const root = createRoot(container);
        root.render(
          <StrictMode>
            <App />
          </StrictMode>,
        );
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
