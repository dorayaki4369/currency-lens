import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "../../assets/style.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    const container = document.createElement("div");
    container.id = "currency-lens-root";
    container.style.cssText = "all: initial; position: fixed; z-index: 999999;";

    document.body.appendChild(container);

    ReactDOM.createRoot(container).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  },
});
