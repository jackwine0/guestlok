// WhatsApp webhook: delivery receipts (sent → delivered → read, or failed).
// Deploy with --no-verify-jwt, then in Meta → WhatsApp → Configuration set:
//   Callback URL:  https://<project>.supabase.co/functions/v1/whatsapp-webhook
//   Verify token:  the value of WA_VERIFY_TOKEN
//   Subscribe to:  messages
// Secrets: WA_VERIFY_TOKEN (any string you choose), WA_APP_SECRET (Meta → App settings → Basic).
import { adminClient, env } from '../_shared/common.ts'

const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 }

async function hmacSha256Hex(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Meta's one-time verification handshake.
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env('WA_VERIFY_TOKEN')
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const raw = await req.text()
  const signature = (req.headers.get('x-hub-signature-256') ?? '').replace(/^sha256=/, '')
  if (!safeEqual(signature, await hmacSha256Hex(env('WA_APP_SECRET'), raw))) {
    return new Response('Invalid signature', { status: 401 })
  }

  try {
    const payload = JSON.parse(raw)
    const db = adminClient()
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const s of change.value?.statuses ?? []) {
          const status: string = s.status
          if (!['sent', 'delivered', 'read', 'failed'].includes(status)) continue
          const { data: guest } = await db
            .from('guests')
            .select('id, event_id, wa_status')
            .eq('wa_message_id', s.id)
            .maybeSingle()
          if (!guest) continue

          if (status === 'failed') {
            if (guest.wa_status === 'failed') continue
            // Undelivered: give the send back to the event's allowance so the host can retry.
            await db.rpc('gl_wa_release', { p_event: guest.event_id, p_count: 1 })
            const reason = s.errors?.[0]?.error_data?.details ?? s.errors?.[0]?.title ?? 'WhatsApp could not deliver this invite.'
            await db
              .from('guests')
              .update({ wa_status: 'failed', wa_error: String(reason).slice(0, 300), wa_updated_at: new Date().toISOString() })
              .eq('id', guest.id)
          } else if ((RANK[status] ?? 0) > (RANK[guest.wa_status ?? 'queued'] ?? 0)) {
            // Receipts can arrive out of order; never move backwards (read → delivered).
            await db.from('guests').update({ wa_status: status, wa_updated_at: new Date().toISOString() }).eq('id', guest.id)
          }
        }
      }
    }
  } catch (err) {
    console.error(err)
    return new Response('Error', { status: 500 })
  }
  return new Response('ok', { status: 200 })
})
