// Called by the app when Paystack redirects back with ?reference=...
// POST { reference } → { status: 'activated' | 'already_active' | 'pending' | ... }
import { activate, adminClient, corsHeaders, json, paystackVerify, requireUser } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const user = await requireUser(req)
    if (!user) return json({ error: 'Please sign in again.' }, 401)

    const { reference } = await req.json()
    if (typeof reference !== 'string') return json({ error: 'reference is required' }, 400)

    const { data: payment } = await adminClient()
      .from('payments')
      .select('owner_id, status')
      .eq('reference', reference)
      .single()
    if (!payment || payment.owner_id !== user.id) return json({ error: 'Payment not found' }, 404)
    if (payment.status === 'success') return json({ status: 'already_active' })

    const tx = await paystackVerify(reference)
    if (tx.status !== 'success' || tx.currency !== 'NGN') {
      return json({ status: tx.status === 'abandoned' || tx.status === 'ongoing' ? 'pending' : tx.status })
    }

    const status = await activate(reference, tx.amount)
    return json({ status })
  } catch (err) {
    console.error(err)
    return json({ error: 'Could not confirm the payment yet.' }, 500)
  }
})
