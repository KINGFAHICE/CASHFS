import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./styles.css";

// We wrap the logic here to keep your main entry point clean
const Root = () => {
  useEffect(() => {
    // Listener for the Electron auto-updater
    window.electronAPI?.onUpdateDownloaded(() => {
      if (confirm("A new version is ready! Restart the app to install?")) {
        window.electronAPI.restartApp();
      }
    });
  }, []);

  return <RouterProvider router={router} />;
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);