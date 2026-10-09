// Sends invites from the official Guestlok WhatsApp number (Plus events only).
// POST with the host's Authorization header:
//   { event_id }                    → next batch of guests who haven't been sent one yet (or whose send failed)
//   { event_id, guest_ids: [...] }  → these guests specifically (resend)
// → { sent, failed, no_allowance, remaining, more }
//
// The app uploads each guest's ticket image to storage first
// (invite-tickets/<owner>/<event>/<token>.png); WhatsApp attaches it to the message.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN            from Meta → WhatsApp → API setup
//   WA_TEMPLATE_NAME   (default guestlok_invite)   the approved template's name
//   WA_TEMPLATE_LANG   (default en)
//   WA_GRAPH_VERSION   (default v21.0)
import { adminClient, corsHeaders, env, json, requireUser } from '../_shared/common.ts'

const BATCH = 40
const PARALLEL = 6

type Guest = { id: string; name: string; phone: string | null; admits: number; token: string; wa_status: string | null }

function lagosDate(iso: string) {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' })
    .format(d)
    .replace(' ', '')
  return `${date}, ${time}`
}

async function imageExists(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const user = await requireUser(req)
    if (!user) return json({ error: 'Please sign in again.' }, 401)

    const { event_id, guest_ids } = await req.json()
    if (typeof event_id !== 'string') return json({ error: 'event_id is required' }, 400)
    if (guest_ids !== undefined && (!Array.isArray(guest_ids) || guest_ids.some((g) => typeof g !== 'string'))) {
      return json({ error: 'guest_ids must be a list' }, 400)
    }

    const db = adminClient()
    const { data: event } = await db
      .from('events')
      .select('id, owner_id, name, host_names, starts_at, venue, status, delivery, wa_quota, wa_sent, cover_image_url')
      .eq('id', event_id)
      .single()
    if (!event || event.owner_id !== user.id) return json({ error: 'Event not found' }, 404)
    if (event.delivery !== 'plus') return json({ error: 'Guestlok sending is part of Plus.' }, 403)
    const over = event.status === 'ended' || new Date(event.starts_at).getTime() < Date.now() - 24 * 3600_000
    if (event.status !== 'active' || over) return json({ error: 'This event is no longer active.' }, 409)

    // Who to send to.
    let query = db
      .from('guests')
      .select('id, name, phone, admits, token, wa_status')
      .eq('event_id', event.id)
      .not('phone', 'is', null)
      .is('checked_in_at', null)
      .order('created_at', { ascending: true })
    if (guest_ids?.length) {
      query = query.in('id', guest_ids.slice(0, BATCH))
    } else {
      query = query.or('wa_status.is.null,wa_status.eq.failed').limit(BATCH + 1)
    }
    const { data: rows, error: guestsError } = await query
    if (guestsError) throw guestsError
    const pending = (rows ?? []) as Guest[]
    const batch = pending.slice(0, BATCH)
    const moreWaiting = !guest_ids?.length && pending.length > BATCH

    if (batch.length === 0) {
      return json({ sent: 0, failed: 0, no_allowance: 0, remaining: event.wa_quota - event.wa_sent, more: false })
    }

    // Take sends from the allowance up front (atomic), give back any that fail.
    const { data: granted, error: reserveError } = await db.rpc('gl_wa_reserve', { p_event: event.id, p_count: batch.length })
    if (reserveError) throw reserveError
    const allowed = batch.slice(0, granted as number)
    const noAllowance = batch.length - allowed.length

    const graph = `https://graph.facebook.com/${Deno.env.get('WA_GRAPH_VERSION') ?? 'v21.0'}/${env('WA_PHONE_NUMBER_ID')}/messages`
    const token = env('WA_ACCESS_TOKEN')
    const template = Deno.env.get('WA_TEMPLATE_NAME') ?? 'guestlok_invite'
    const lang = Deno.env.get('WA_TEMPLATE_LANG') ?? 'en'
    const storageBase = `${env('SUPABASE_URL')}/storage/v1/object/public/invite-tickets/${event.owner_id}/${event.id}`
    const fallbackImage = event.cover_image_url ?? Deno.env.get('WA_FALLBACK_IMAGE_URL') ?? null
    const when = lagosDate(event.starts_at)

    let sent = 0
    let failed = 0

    async function sendOne(g: Guest) {
      let image = `${storageBase}/${g.token}.png`
      if (!(await imageExists(image))) image = fallbackImage ?? ''
      const components: unknown[] = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: g.name.slice(0, 60) },
            { type: 'text', text: event!.name.slice(0, 80) },
            { type: 'text', text: when },
            { type: 'text', text: event!.venue.slice(0, 80) },
            { type: 'text', text: g.admits === 1 ? '1 person' : `${g.admits} people` },
          ],
        },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: g.token }] },
      ]
      if (image) components.unshift({ type: 'header', parameters: [{ type: 'image', image: { link: image } }] })

      try {
        const res = await fetch(graph, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: g.phone,
            type: 'template',
            template: { name: template, language: { code: lang }, components },
          }),
        })
        const out = await res.json()
        const id = out?.messages?.[0]?.id
        if (!res.ok || !id) throw new Error(out?.error?.error_data?.details ?? out?.error?.message ?? `HTTP ${res.status}`)
        sent++
        await db
          .from('guests')
          .update({ wa_status: 'sent', wa_message_id: id, wa_error: null, wa_updated_at: new Date().toISOString(), invite_sent_at: new Date().toISOString() })
          .eq('id', g.id)
      } catch (err) {
        failed++
        await db.rpc('gl_wa_release', { p_event: event!.id, p_count: 1 })
        await db
          .from('guests')
          .update({ wa_status: 'failed', wa_error: String((err as Error).message ?? err).slice(0, 300), wa_updated_at: new Date().toISOString() })
          .eq('id', g.id)
      }
    }

    // Small worker pool so a batch finishes quickly without hammering the API.
    const queue = [...allowed]
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
        while (queue.length) await sendOne(queue.shift()!)
      }),
    )

    const { data: after } = await db.from('events').select('wa_quota, wa_sent').eq('id', event.id).single()
    return json({
      sent,
      failed,
      no_allowance: noAllowance,
      remaining: after ? after.wa_quota - after.wa_sent : 0,
      more: moreWaiting && noAllowance === 0 && failed < allowed.length,
    })
  } catch (err) {
    console.error(err)
    return json({ error: 'Could not send invites right now.' }, 500)
  }
})
