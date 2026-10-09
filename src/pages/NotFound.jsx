import { Link } from "react-router-dom";
import { MessageScreen } from "../components/Page.jsx";
import { useAuth } from "../lib/auth.jsx";
import { useTitle } from "../lib/useTitle.js";

export default function NotFound() {
  const { session } = useAuth();
  useTitle("Not found");
  return (
    <MessageScreen kicker="404" title="Not on the list." body="This page doesn’t exist, or the link has changed. Check the address, or head back.">
      {session ? (
        <Link to="/app" className="btn-dark btn-lg">Go to my events</Link>
      ) : (
        <Link to="/" className="btn-dark btn-lg">Go to the homepage</Link>
      )}
    </MessageScreen>
  );
}
