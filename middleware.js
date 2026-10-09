// Vercel Routing Middleware: link previews for invite links.
//
// When WhatsApp (or another app) looks at a guest's invite link /i/<token> to build a
// preview, answer with that guest's ticket image so it shows up inside the message.
// Real visitors are passed straight through to the app.
//
// Needs the same VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY you already set in Vercel.

export const config = { matcher: "/i/:token*" };

const BOTS = /WhatsApp|facebookexternalhit|Facebot|meta-externalagent|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Applebot|Googlebot|bingbot|Pinterest|redditbot|Embedly/i;

/* global process */
// Returning nothing lets the request carry on to the app as normal.
const passThrough = () => undefined;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function lagosDate(iso) {
  try {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default async function middleware(request) {
  if (!BOTS.test(request.headers.get("user-agent") || "")) return passThrough();

  const url = new URL(request.url);
  const token = (url.pathname.split("/")[2] || "").toLowerCase();
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!/^[a-f0-9]{32}$/.test(token) || !supabaseUrl || !anonKey) return passThrough();

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/invite_preview`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    });
    const info = res.ok ? await res.json() : null;
    if (!info) return passThrough();

    const image = `${supabaseUrl}/storage/v1/object/public/invite-tickets/${info.image_path}`;
    const head = await fetch(image, { method: "HEAD" }).catch(() => null);
    const hasImage = !!head?.ok;

    const first = String(info.guest_name || "").split(" ")[0];
    const title = `${first ? `${first}, you’re invited` : "You’re invited"} · ${info.event_name}`;
    const description = [lagosDate(info.starts_at), info.venue].filter(Boolean).join(" · ") + ". Tap to open your personal invite.";

    const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Guestlok">
<meta property="og:url" content="${esc(url.href)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${hasImage ? `<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${esc(`Invite for ${info.guest_name}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">` : `<meta name="twitter:card" content="summary">`}
</head><body><p>${esc(title)}</p><p><a href="${esc(url.href)}">Open your invite</a></p></body></html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return passThrough();
  }
}
