// Shared helpers for Guestlok edge functions (Deno runtime).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

/** Service-role client: bypasses RLS. Only use after checking who is asking. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

/** Returns the signed-in user from the request's Authorization header, or null. */
export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

export const PAYSTACK_API = 'https://api.paystack.co'

export async function paystackVerify(reference: string) {
  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env('PAYSTACK_SECRET_KEY')}` },
  })
  const body = await res.json()
  if (!res.ok || !body.status) {
    throw new Error(body.message ?? 'Paystack verification failed')
  }
  return body.data as { status: string; amount: number; currency: string; reference: string }
}

/** Marks the payment successful and activates the event (idempotent). */
export async function activate(reference: string, amountKobo: number) {
  const { data, error } = await adminClient().rpc('gl_activate_payment', {
    p_reference: reference,
    p_amount_kobo: amountKobo,
  })
  if (error) throw error
  return data as string
}
