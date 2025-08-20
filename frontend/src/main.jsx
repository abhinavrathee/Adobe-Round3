// import React from "react";
// import ReactDOM from "react-dom/client";
// import App from "./App.jsx";
// import "./index.css";

// ReactDOM.createRoot(document.getElementById("root")).render(
//   // Removed <React.StrictMode> to avoid double-mount side effects with Adobe SDK
//   <App />
// );



import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Landing from "./Landing.jsx";
import "./index.css";

function Root() {
  const [entered, setEntered] = useState(false);
  return entered ? <App /> : <Landing onEnter={() => setEntered(true)} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <Root />
);
