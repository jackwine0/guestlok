# Guestlok

Digital invitations with a single-use QR code for every guest. Only your guests get in.

**Stack:** React 19 + Vite 7 (JavaScript) · Tailwind CSS 3.4 · React Router 7 · Supabase (Auth, Postgres, Realtime, Storage, Edge Functions) · `html5-qrcode` · `qrcode.react` · `lucide-react` · Paystack · WhatsApp Cloud API

## Features

| Feature | Where |
|---|---|
| Landing page with live pricing (Standard / Plus toggle) and FAQ | `src/pages/Landing.jsx` |
| Sign up / sign in | `src/pages/Login.jsx` |
| New-event wizard: details → headcount & plan → how invites go out → pay | `src/pages/NewEvent.jsx`, `src/components/DeliveryPicker.jsx` |
| Paystack checkout for plans, upgrades to Plus and extra WhatsApp sends | `supabase/functions/paystack-*`, `src/components/PaymentCard.jsx`, `src/components/PlusPanel.jsx` |
| Event dashboard (bento overview, gate requests, guests by side) | `src/pages/EventDetail.jsx`, `src/pages/event/*` |
| Guests: add, CSV import, sides, plus-ones, search and filters | `src/pages/event/Guests.jsx`, `src/components/GuestImport.jsx` |
| **Standard** sending: one tap per guest from the host's WhatsApp, filter by side | `src/components/SendQueue.jsx` |
| **Share the sending**: private links so family or a planner send their side's invites from their own WhatsApp; progress per helper | `src/components/ShareSending.jsx`, `src/pages/Sender.jsx` (`/send/:token`) |
| **Plus** sending (switched off until WhatsApp is set up): Guestlok sends every invite from its WhatsApp number, with the ticket image and Sent / Delivered / Read status | `src/components/GuestlokSend.jsx`, `src/lib/guestlokSend.js`, `supabase/functions/whatsapp-*` |
| Invitation designer: cover photo (fit/fill, drag, zoom), colour themes, WhatsApp message | `src/components/InvitationEditor.jsx` |
| Guest invite page with personal QR, save as image/PDF | `src/pages/Invite.jsx` (`/i/:token`) |
| Gate scanner: camera, single use, name lookup, "Ask the host" | `src/pages/Scanner.jsx` (`/scan/:eventId?k=…`) |
| Ending events: auto-end after 24h, frozen data, reopen within 1h, attendance CSV | `src/components/EndedPanel.jsx`, `src/lib/attendance.js` |

## Pricing model

Plans are priced by headcount (`tiers` table). Every plan has every feature; the host only chooses who sends the invites:

- **Standard:** the host sends from their own WhatsApp. Included.
- **Plus:** Guestlok sends from the official number. **₦20 per guest of the plan** (₦2,000 / ₦6,000 / ₦10,000), rounded up to ₦100. Includes sends for the plan size **+10%** for resends; extra sends are **₦25** each. Failed sends are given back. Invites are WhatsApp *Utility* messages (about $0.0067 each in Nigeria), so that's roughly 2× cost.

**Plus is switched off by default** (hidden on the site, refused at checkout) until the WhatsApp number is approved. Turn it on with `update pricing_settings set plus_enabled = true;`

All of these numbers live in `public.pricing_settings` and can be changed without a deploy:

```sql
update pricing_settings set plus_min_guest_kobo = 2500;     -- Plus = ₦25 a guest
update pricing_settings set wa_daily_limit = 1000;          -- after Meta raises your number's limit
update tiers set price_kobo = 2000000 where id = 'intimate'; -- ₦20,000 (amounts are in kobo)
```

The app (`src/lib/pricing.js`) and the database (`gl_plus_extra_kobo`) use the same formula; checkout always charges the database price.

## How the security works

- **Hosts** only see their own events and guests (Row Level Security).
- **Guests** open `/i/<token>`. The token is 128 random bits; the page reads data only through the `get_invite` function.
- **Ushers** open `/scan/<event>?k=<scanner key>`. No login. Every scanner function checks the key and that the event is live.
- **Single use:** check-in is one atomic `UPDATE … WHERE checked_in_at IS NULL`. If two ushers scan the same code at once, exactly one gets "Valid".
- **Payments:** prices always come from the database, never the browser. Plans, upgrades and top-ups take effect only after Paystack confirms the charge (redirect verify and webhook, both idempotent).
- **Capacity and allowances:** triggers block guests beyond the plan's headcount; hosts can't change their headcount, WhatsApp allowance, plan or delivery mode after paying, even by calling the API directly.
- **Ended events** are read-only in the database.
- **WhatsApp:** sends are reserved from the event's allowance atomically before sending; the webhook checks Meta's signature.

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations **in order** (CLI `npx supabase db push`, or paste each file into the SQL editor):
   1. `20261007000000_init.sql`
   2. `20261007120000_invite_customisation.sql`
   3. `20261008000000_sides_and_gate_requests.sql`
   4. `20261009000000_cover_adjust.sql`
   5. `20261010000000_ending_events.sql` (optional pg_cron block at the end)
   6. `20261011000000_plus_delivery.sql`
   7. `20261012000000_shared_sending.sql`
   8. `20261013000000_delete_events.sql`
   9. `20261014000000_whatsapp_ticket_preview.sql`
   10. `20261015000000_short_links.sql`
   11. `20261016000000_plus_templates.sql`
3. Set your real prices (see *Pricing model*).
4. **Auth → URL Configuration:** Site URL = your domain; add `http://localhost:5173` to Redirect URLs for local dev.

### 2. Paystack

```bash
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx SITE_URL=https://your-domain.com
npx supabase functions deploy paystack-init
npx supabase functions deploy paystack-verify
npx supabase functions deploy paystack-webhook --no-verify-jwt
npx supabase functions deploy sender-ticket --no-verify-jwt   # ticket images for helpers' WhatsApp sends
```

Paystack → Settings → API Keys & Webhooks → Webhook URL:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook`

### 3. WhatsApp (Plus)

1. **Meta app:** developers.facebook.com → Create app → *Connect with customers through WhatsApp* → *Integrate with API*. Step 1 gives a free test number (send to up to 5 numbers you verify); Step 2 adds your own number (must not be active on WhatsApp). Business verification (CAC) only raises limits: 250 recipients/day without it.
2. **Permanent token:** Business settings → System users → add an Admin → assign the app and WhatsApp account → Generate token (never expires, permissions `whatsapp_business_messaging` and `whatsapp_business_management`).
3. **Templates** (WhatsApp Manager → Message templates → Create). Category **Utility**, language **English**, header **Image**, footer `Sent by Guestlok for your host`, button **Visit website** → `View my ticket` → dynamic URL `https://your-domain.com/i/{{1}}`. Variables are **Number** type. Write them as transactional pass confirmations (no "you're invited", no emojis, no promotional lines) or Meta moves them to Marketing. The bodies must match exactly (the app's preview and the send function use this wording and variable order):

   - `guestlok_invite` (Simple):
     > Hello {{1}}, your entry pass for {{2}} has been issued.<br><br>Date: {{3}}<br>Venue: {{4}}<br>Admits: {{5}}<br><br>Show the QR code on your pass at the gate. It is valid for one entry only.
   - `guestlok_invite_formal` (Formal):
     > Dear {{1}},<br><br>Your entry pass for {{2}} has been issued.<br><br>Date: {{3}}<br>Venue: {{4}}<br><br>Message from your host: {{5}}<br><br>This pass admits {{6}}. Kindly present the QR code at the entrance. It is valid for one entry only.
   - `guestlok_invite_warm` (Warm):
     > Hi {{1}}, your pass for {{2}} is ready.<br><br>Date: {{3}}<br>Venue: {{4}}<br><br>Message from your host: {{5}}<br><br>Your pass admits {{6}}. Show the QR at the gate. It only works once, so keep it to yourself.
   - `guestlok_invite_faith` (Gracious):
     > Dear {{1}},<br><br>Your entry pass for {{2}} has been issued.<br><br>Date: {{3}}<br>Venue: {{4}}<br><br>Message from your host: {{5}}<br><br>Your pass admits {{6}}. Please show the QR code at the entrance. It is valid for one entry.

   In the three styles with a note, {{5}} is the host's note (one line, up to 120 characters; a default line is used when they leave it empty). After Meta approves a template, offer it to hosts:
   ```sql
   update pricing_settings set wa_templates = '{guestlok_invite,guestlok_invite_formal,guestlok_invite_warm,guestlok_invite_faith}';
   ```
4. **Secrets and functions:**

```bash
npx supabase secrets set WA_PHONE_NUMBER_ID=xxx WA_ACCESS_TOKEN=xxx WA_APP_SECRET=xxx WA_VERIFY_TOKEN=any-word
# optional: WA_TEMPLATE_LANG (default en; en_GB / en_US if you chose those),
#           WA_FALLBACK_IMAGE_URL (image used if a ticket image is missing), WA_GRAPH_VERSION (default v21.0)
npx supabase functions deploy whatsapp-send
npx supabase functions deploy whatsapp-webhook --no-verify-jwt
```

5. **Webhook:** Meta app → WhatsApp → Configuration → Callback URL `https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`, Verify token = `WA_VERIFY_TOKEN`, subscribe to **messages**.
6. **Test without paying:** `update events set status='active', headcount=100, delivery='plus', wa_quota=20 where id='…';` then Guests → Send all.

### 4. Run the app

```bash
cp .env.example .env.local     # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

The camera scanner needs HTTPS (or `localhost`). To test on a phone, deploy a preview or use a tunnel (`npx localtunnel --port 5173`).

### 5. Deploy (Vercel or Netlify)

- Build command `npm run build`, output `dist`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `vercel.json` rewrites all routes to `index.html`
- `middleware.js` (Vercel) answers WhatsApp's link preview for `/i/<token>` with that guest's ticket image, so the ticket shows inside the invite message. It reads the same two env vars.

After deploying, update `SITE_URL` (Supabase secret), the Auth Site URL and the template's button URL to the live domain.

---

## CSV format

```csv
name,phone,admits,side
Adaeze Okafor,0803 123 4567,2,Bride's family
Tunde Bakare,+234 802 555 0101,1,Groom's family
```

Also accepted: `full name`, `whatsapp`, `mobile`, `plus ones` (adds 1 for the guest). Phone numbers are normalised to `234…`.

## Project structure

```
src/
  components/   UI pieces (Brand, AppShell, Modal, Feedback, TicketCard, SendQueue, GuestlokSend, PlusPanel, …)
  lib/          supabase client, auth, pricing, payments, invite/ticket helpers, feedback, formatting
  pages/        Landing, Login, Dashboard, NewEvent, EventDetail, Invite, Scanner, NotFound
  pages/event/  Overview, Guests, Invitation, Gate, Settings (tabs inside an event)
supabase/
  migrations/   schema, RLS, triggers, RPCs, storage buckets (run in order)
  functions/    paystack-init/verify/webhook, whatsapp-send, whatsapp-webhook (Deno)
```

## Roadmap

Offline scanning · table seating · planner accounts (co-organisers) · email invites · switch Plus on once WhatsApp is approved.
