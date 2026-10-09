/** Reads the { error } body an edge function returned with a non-2xx status. */
export async function functionError(error, fallback) {
  const ctx = error?.context;
  if (ctx instanceof Response) {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      /* not JSON */
    }
  }
  return fallback;
}

/** Turns Supabase / Postgres errors into something a host can read. */
export function friendlyError(err) {
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String(err.message)
      : String(err);
  const custom = message.match(/GL_[A-Z_]+:\s*(.*)$/);
  if (custom) return custom[1];
  if (message.includes("guests_phone_check"))
    return "That phone number looks wrong. Use a format like 0803 123 4567.";
  if (message.includes("guests_admits_check"))
    return "Admits must be between 1 and 10.";
  if (message.toLowerCase().includes("failed to fetch"))
    return "Network problem. Check your connection and try again.";
  return message || "Something went wrong. Please try again.";
}
