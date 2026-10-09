// Paystack webhook (backup for when the host closes the tab before redirect).
// Deploy with --no-verify-jwt and set the URL in Paystack → Settings → API Keys & Webhooks.
import { activate, env, paystackVerify } from '../_shared/common.ts'

async function hmacSha512Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const raw = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const expected = await hmacSha512Hex(env('PAYSTACK_SECRET_KEY'), raw)
  if (!safeEqual(signature, expected)) return new Response('Invalid signature', { status: 401 })

  try {
    const event = JSON.parse(raw)
    if (event.event === 'charge.success' && typeof event.data?.reference === 'string') {
      // Re-verify with Paystack rather than trusting the payload amount.
      const tx = await paystackVerify(event.data.reference)
      if (tx.status === 'success' && tx.currency === 'NGN') {
        const result = await activate(tx.reference, tx.amount)
        console.log('webhook', tx.reference, result)
      }
    }
  } catch (err) {
    console.error(err)
    // Return 500 so Paystack retries.
    return new Response('Error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
})
