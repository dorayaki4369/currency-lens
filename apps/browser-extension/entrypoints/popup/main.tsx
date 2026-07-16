import React from "react";
import ReactDOM from "react-dom/client";
import "../../assets/popup.css";
import App from "./App.tsx";

const rootElement = document.querySelector("#root");
if (!rootElement) {
  throw new Error("Currency Lens popup root was not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
