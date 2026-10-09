import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ErrorBoundary, { reloadForNewVersion } from "./components/ErrorBoundary.jsx";
import FeedbackProvider from "./components/Feedback.jsx";
import { AuthProvider } from "./lib/auth.jsx";
import "./index.css";

// After a deploy, an open tab may ask for code files that no longer exist.
// Vite reports it here: reload once to pick up the new version instead of showing a blank page.
window.addEventListener("vite:preloadError", (e) => {
  if (reloadForNewVersion()) e.preventDefault();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <FeedbackProvider>
            <App />
          </FeedbackProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
