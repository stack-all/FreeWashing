import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app root");
}

createRoot(appRoot).render(<App />);
