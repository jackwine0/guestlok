import { Link } from "react-router-dom";
import { EmptyState } from "../components/Page.jsx";
import { useTitle } from "../lib/useTitle.js";

/** Unknown page inside the signed-in app: stay in the shell. */
export default function AppNotFound() {
  useTitle("Not found");
  return (
    <EmptyState title="Not on the list" body="This page doesn’t exist, or the link has changed.">
      <Link to="/app" className="btn-dark">Back to my events</Link>
      <Link to="/app/events/new" className="btn-tile">Plan a new event</Link>
    </EmptyState>
  );
}
