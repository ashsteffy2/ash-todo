import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AuthGate from "./AuthGate.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthGate>
      {({ session, signOut }) => <App session={session} signOut={signOut} />}
    </AuthGate>
  </StrictMode>,
);
