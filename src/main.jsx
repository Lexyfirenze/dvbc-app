import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the app-shell service worker so the app can open/navigate offline
// after a first visit. This is separate from offline song/PDF downloads,
// which the app manages directly via the Cache Storage API.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal — the app still works online without it.
    });
  });
}
