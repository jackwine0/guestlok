import { useEffect } from "react";

/** Sets the browser tab title: "Guests · Tolu’s Wedding · Guestlok". */
export function useTitle(...parts) {
  const named = parts.filter(Boolean);
  const title = named.length ? [...named, "Guestlok"].join(" · ") : "Guestlok — Only your guests get in";
  useEffect(() => {
    document.title = title;
  }, [title]);
}
