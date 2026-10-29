import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n";
import { ContextMenuProvider } from "./components/context-menu/ContextMenuProvider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider initialLanguage="es">
      <ContextMenuProvider>
        <App />
      </ContextMenuProvider>
    </I18nProvider>
  </React.StrictMode>,
);
