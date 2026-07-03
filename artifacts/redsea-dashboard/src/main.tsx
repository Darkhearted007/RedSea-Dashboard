import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress noisy browser-extension errors (MetaMask, etc.) so they don't
// pollute the Replit runtime-error log. These originate from chrome-extension://
// scripts injected by the user's browser and are unrelated to this app.
const isExtensionNoise = (msg: string) =>
  /chrome-extension:\/\/|Failed to connect to MetaMask|MetaMask/i.test(msg);

window.addEventListener("error", (e) => {
  if (isExtensionNoise(e.message ?? "")) e.stopImmediatePropagation();
});
window.addEventListener("unhandledrejection", (e) => {
  if (isExtensionNoise(String(e.reason?.message ?? e.reason ?? "")))
    e.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
