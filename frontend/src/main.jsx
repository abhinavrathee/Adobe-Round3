import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  // Removed <React.StrictMode> to avoid double-mount side effects with Adobe SDK
  <App />
);
