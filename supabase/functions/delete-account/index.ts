// Deletes the signed-in host's account and everything that belongs to it.
// POST with the host's Authorization header: { confirm: "DELETE" } → { ok: true }
//
// Order: uploaded files → events (guests, gate requests, helper links cascade; payments are
// kept with the event name copied on) → the login itself (payments' owner is then cleared).
import { adminClient, corsHeaders, json, requireUser } from '../_shared/common.ts'

async function listAll(db: ReturnType<typeof adminClient>, bucket: string, folder: string): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(folder, { limit: 1000, offset })
    if (error || !data?.length) break
    for (const item of data) {
      const path = `${folder}/${item.name}`
      // Folders come back without an id; walk into them.
      if (item.id === null) out.push(...(await listAll(db, bucket, path)))
      else out.push(path)
    }
    if (data.length < 1000) break
  }
  return out
}

async function removeFolder(db: ReturnType<typeof adminClient>, bucket: string, folder: string) {
  const paths = await listAll(db, bucket, folder)
  for (let i = 0; i < paths.length; i += 500) {
    await db.storage.from(bucket).remove(paths.slice(i, i + 500))
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const user = await requireUser(req)
    if (!user) return json({ error: 'Please sign in again.' }, 401)
    const { confirm } = await req.json().catch(() => ({}))
    if (confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm.' }, 400)

    const db = adminClient()

    // Files are tidy-up: never let a storage hiccup stop the deletion.
    try {
      await removeFolder(db, 'invite-covers', user.id)
      await removeFolder(db, 'invite-tickets', user.id)
    } catch (err) {
      console.warn('file cleanup failed', err)
    }

    const { error: eventsError } = await db.from('events').delete().eq('owner_id', user.id)
    if (eventsError) throw eventsError

    const { error: userError } = await db.auth.admin.deleteUser(user.id)
    if (userError) throw userError

    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'We couldn’t delete your account. Please try again, or email hello@guestlok.com.' }, 500)
  }
})
