// Lets a helper (the /send/<token> page, no account) put a guest's ticket image where
// WhatsApp's link preview finds it: invite-tickets/<owner>/<event>/<token>-wa.jpg
//
// POST { token, guest_id, image }   image = base64 JPEG (data URL or bare), max ~1.5 MB
// → { ok: true } | { error }
//
// Hosts upload straight to storage; helpers can't, so this checks the helper's link
// and uploads for them.
import { adminClient, corsHeaders, json } from '../_shared/common.ts'

const MAX_BYTES = 1_500_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await req.json().catch(() => null)
    const token = String(body?.token ?? '').toLowerCase()
    const guestId = String(body?.guest_id ?? '')
    const raw = String(body?.image ?? '').replace(/^data:image\/jpeg;base64,/, '')
    if (!/^[a-f0-9]{16,64}$/.test(token) || !/^[0-9a-f-]{36}$/.test(guestId) || !raw) {
      return json({ error: 'Bad request' }, 400)
    }

    let bytes: Uint8Array
    try {
      bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
    } catch {
      return json({ error: 'Image is not valid base64' }, 400)
    }
    // JPEG files start with FF D8 FF.
    if (bytes.length > MAX_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      return json({ error: 'Image must be a JPEG under 1.5 MB' }, 400)
    }

    const db = adminClient()
    const { data: sender } = await db
      .from('event_senders')
      .select('event_id, side, revoked_at')
      .eq('token', token)
      .maybeSingle()
    if (!sender || sender.revoked_at) return json({ error: 'This sending link is closed' }, 403)

    const { data: guest } = await db
      .from('guests')
      .select('token, side, event_id, events!inner(id, owner_id, status)')
      .eq('id', guestId)
      .eq('event_id', sender.event_id)
      .maybeSingle()
    // deno-lint-ignore no-explicit-any
    const ev = (guest as any)?.events
    if (!guest || !ev || ev.status !== 'active' || (sender.side && guest.side !== sender.side)) {
      return json({ error: 'Guest not found for this link' }, 404)
    }

    const path = `${ev.owner_id}/${ev.id}/${guest.token}-wa.jpg`
    const { error } = await db.storage
      .from('invite-tickets')
      .upload(path, bytes, { upsert: true, contentType: 'image/jpeg', cacheControl: '300' })
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Something went wrong' }, 500)
  }
})
