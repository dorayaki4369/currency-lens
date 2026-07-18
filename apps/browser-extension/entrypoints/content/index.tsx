import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import "../../assets/style.css";
import App from "./App.tsx";

export default defineContentScript({
  cssInjectionMode: "ui",
  matches: ["<all_urls>"],
  async main(context) {
    const ui = await createShadowRootUi<Root>(context, {
      name: "currency-lens-overlay",
      position: "overlay",
      zIndex: 2_147_483_647,
      isolateEvents: ["keydown", "keyup", "keypress", "pointerdown", "click"],
      onMount(container) {
        const root = createRoot(container);
        root.render(
          <React.StrictMode>
            <App />
          </React.StrictMode>,
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
