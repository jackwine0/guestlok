// Starts a Paystack checkout. Prices always come from the database, never from the browser.
// POST with the host's Authorization header:
//   { event_id, delivery?: 'self' | 'plus' }          → pay for a draft event's plan (Standard or Plus)
//   { event_id, kind: 'upgrade' }                      → move a paid Standard event to Plus (pays the difference)
//   { event_id, kind: 'topup', invites: number }       → buy extra WhatsApp sends for a Plus event
// → { authorization_url, reference }
import { adminClient, corsHeaders, env, json, PAYSTACK_API, requireUser, returnBase } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const user = await requireUser(req)
    if (!user || !user.email) return json({ error: 'Please sign in again.' }, 401)

    const body = await req.json()
    const { event_id } = body
    const kind: string = body.kind ?? 'plan'
    if (typeof event_id !== 'string') return json({ error: 'event_id is required' }, 400)
    if (!['plan', 'upgrade', 'topup'].includes(kind)) return json({ error: 'Unknown payment type' }, 400)

    const db = adminClient()
    const { data: event, error: eventError } = await db
      .from('events')
      .select('id, owner_id, status, tier_id, name, delivery, starts_at')
      .eq('id', event_id)
      .single()
    if (eventError || !event || event.owner_id !== user.id) return json({ error: 'Event not found' }, 404)

    const { data: tier, error: tierError } = await db
      .from('tiers')
      .select('id, name, price_kobo')
      .eq('id', event.tier_id)
      .single()
    if (tierError || !tier) return json({ error: 'Plan not found' }, 400)

    const { data: settings } = await db.from('pricing_settings').select('*').single()
    const plusExtra = async () => {
      const { data, error } = await db.rpc('gl_plus_extra_kobo', { p_tier: tier.id })
      if (error) throw error
      return data as number
    }

    let amount = 0
    let delivery: 'self' | 'plus' = event.delivery === 'plus' ? 'plus' : 'self'
    let invites: number | null = null
    let label = tier.name

    const plusOn = settings?.plus_enabled === true
    if (!plusOn && (kind !== 'plan' || body.delivery === 'plus')) {
      return json({ error: 'Guestlok sending isn’t available yet. Send invites from your own WhatsApp for now.' }, 409)
    }

    if (kind === 'plan') {
      if (event.status !== 'draft') return json({ error: 'This event is already paid for.' }, 409)
      delivery = body.delivery === 'plus' ? 'plus' : 'self'
      amount = tier.price_kobo + (delivery === 'plus' ? await plusExtra() : 0)
      label = `${tier.name}${delivery === 'plus' ? ' Plus' : ''}`
      // Remember the choice on the draft too, so the app shows it if they come back later.
      await db.from('events').update({ delivery }).eq('id', event.id)
    } else {
      const over = event.status === 'ended' || new Date(event.starts_at).getTime() < Date.now() - 24 * 3600_000
      if (event.status !== 'active' || over) return json({ error: 'This event is no longer active.' }, 409)
      if (kind === 'upgrade') {
        if (event.delivery === 'plus') return json({ error: 'This event already has Plus.' }, 409)
        delivery = 'plus'
        amount = await plusExtra()
        label = `Upgrade to ${tier.name} Plus`
      } else {
        if (event.delivery !== 'plus') return json({ error: 'Extra invites are for Plus events.' }, 409)
        invites = Number(body.invites)
        if (!Number.isInteger(invites) || invites < 10 || invites > 2000) {
          return json({ error: 'Choose between 10 and 2,000 extra invites.' }, 400)
        }
        amount = invites * (settings?.extra_invite_kobo ?? 10000)
        label = `${invites} extra WhatsApp invites`
      }
    }

    const reference = `GL-${kind === 'plan' ? '' : kind.toUpperCase() + '-'}${event.id.slice(0, 8)}-${Date.now()}`

    const { error: payError } = await db.from('payments').insert({
      event_id: event.id,
      owner_id: user.id,
      tier_id: tier.id,
      reference,
      amount_kobo: amount,
      kind,
      delivery,
      invites,
    })
    if (payError) throw payError

    const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount,
        currency: 'NGN',
        reference,
        callback_url: `${returnBase(req)}/app/events/${event.id}${kind === 'plan' ? '' : '/settings'}`,
        metadata: { event_id: event.id, tier_id: tier.id, event_name: event.name, kind, delivery, invites, label },
      }),
    })
    const pay = await res.json()
    if (!res.ok || !pay.status) {
      return json({ error: pay.message ?? 'Could not start payment' }, 502)
    }

    return json({ authorization_url: pay.data.authorization_url, reference, amount_kobo: amount })
  } catch (err) {
    console.error(err)
    return json({ error: 'Something went wrong starting the payment.' }, 500)
  }
})
