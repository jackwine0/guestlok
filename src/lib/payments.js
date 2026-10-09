import { functionError } from "./errors.js";
import { supabase } from "./supabase.js";

/** Opens Paystack for an upgrade to Plus or for extra WhatsApp sends. */
export async function startExtraPayment(event, body, toast) {
  const { data, error } = await supabase.functions.invoke("paystack-init", { body: { event_id: event.id, ...body } });
  if (error || !data?.authorization_url) {
    toast(await functionError(error, "Could not open Paystack. Please try again."), { tone: "error" });
    return false;
  }
  window.location.href = data.authorization_url;
  return true;
}
