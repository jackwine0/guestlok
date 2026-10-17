import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Wordmark } from "../components/Brand.jsx";
import { useTitle } from "../lib/useTitle.js";

const UPDATED = "17 October 2026";
const EMAIL = "hello@guestlok.com";

// Plain-language policies. Each section: [heading, ...paragraphs]; a paragraph that is an
// array renders as a bullet list.
const DOCS = {
  privacy: {
    title: "Privacy policy",
    intro:
      "Guestlok helps hosts send personal QR invites and check guests in at the gate. This page explains what we collect, why, who we share it with, and how to have it deleted. It covers hosts (people with a Guestlok account), their helpers and ushers, and the guests they invite.",
    sections: [
      [
        "Who we are",
        `Guestlok is run from Lagos, Nigeria. For anything about your data, email ${EMAIL}.`,
      ],
      [
        "What we collect from hosts",
        [
          "Your name and email address, and a password if you set one (stored scrambled by our login provider; we can’t see it).",
          "Your events: name, host names, date, time, venue, notes, cover photo, colours and invite message.",
          "Payments: the plan, amount, date and Paystack reference. Card and bank details go straight to Paystack; we never see or store them.",
        ],
      ],
      [
        "What hosts give us about guests",
        [
          "Each guest’s name, WhatsApp number, how many people their invite admits and, if the host adds it, a side (e.g. “Bride’s family”).",
          "Whether their invite was sent and, for Guestlok-sent invites, WhatsApp’s delivery status.",
          "When they were checked in at the gate.",
        ],
        "The host decides who to invite and is responsible for having a good reason to share their guests’ details with us. We use guest details only to deliver that host’s invites and run their gate, never for our own marketing, and we never sell them.",
      ],
      [
        "What we use it for",
        [
          "Creating invites and tickets, and letting ushers check them at the gate.",
          "Sending invites on WhatsApp when a host uses Plus, and showing the host whether they arrived.",
          "Taking payments and keeping the records the law requires.",
          "Sign-in, account emails (confirmations, password resets) and answering support requests.",
          "Keeping the service secure and fixing problems.",
        ],
      ],
      [
        "Who we share it with",
        "Only the companies that run parts of Guestlok for us, and only what each one needs:",
        [
          "Supabase: our database, login and file storage.",
          "Vercel: hosts the website.",
          "Paystack: processes payments.",
          "Meta (WhatsApp): delivers invites that Guestlok sends for Plus hosts. The guest’s number, first name, event details and ticket picture pass through WhatsApp.",
        ],
        "We may also share data if the law requires it. Some of these companies store data outside Nigeria; we rely on their contractual safeguards for that.",
      ],
      [
        "How long we keep it",
        [
          "Guests’ phone numbers, their WhatsApp delivery details and their ticket pictures are deleted automatically 90 days after the event ends.",
          "Guests’ names, sides and attendance stay with the event so the host keeps their records, until the host deletes the event or their account.",
          "Events and cover photos stay until the host deletes them or their account.",
          "Payment records (amount, date, reference) are kept for as long as tax and accounting law requires, without your name or email once your account is deleted.",
        ],
      ],
      [
        "Your rights",
        "Under Nigeria’s Data Protection Act 2023 you can ask to see, correct or delete your data, object to how we use it, or ask for a copy. Email us and we’ll reply within 30 days. You can also complain to the Nigeria Data Protection Commission.",
      ],
      [
        "Deleting your data",
        [
          "Hosts: open Your account (tap your name at the top of the app) and choose Delete my account. Your login, events, guest lists, photos and tickets are removed straight away. To delete a single event, use that event’s Settings.",
          `Guests: ask the host to remove you from their list, or email ${EMAIL} with the event name and your phone number and we’ll remove you.`,
          `Anyone who can’t sign in: email ${EMAIL} from the address on the account.`,
        ],
      ],
      [
        "Cookies and storage",
        "We use your browser’s storage to keep you signed in and to remember unfinished forms. We don’t use advertising or tracking cookies.",
      ],
      [
        "Children",
        "Guestlok accounts are for adults (18 and over). Hosts may add guests of any age to their lists; those details are handled as described above.",
      ],
      ["Changes", "If we change this policy we’ll update the date at the top, and tell hosts by email about important changes."],
    ],
  },
  terms: {
    title: "Terms of use",
    intro: "These terms apply when you use Guestlok. By creating an account or paying for an event, you agree to them. They’re written to be read, so please do.",
    sections: [
      [
        "The service",
        "Guestlok gives each guest a personal QR invite, helps you send it on WhatsApp, and lets your ushers check invites at the gate. Each code opens the gate once.",
      ],
      [
        "Your account",
        [
          "You must be 18 or over and give a real email address.",
          "Keep your login safe. You’re responsible for what happens in your account, including what helpers and ushers do with links you share.",
        ],
      ],
      [
        "Paying",
        [
          "You pay once per event, priced by how many people you can invite. Prices include all features; Plus adds Guestlok sending your invites.",
          "Payments are handled by Paystack. Prices are in naira and shown before you pay.",
          `Payments aren’t refunded once you’ve started using an event (for example, added guests), except where the law says otherwise. If something went wrong on our side, email ${EMAIL} and we’ll put it right.`,
        ],
      ],
      [
        "Plus: Guestlok sends your invites",
        [
          "Your Plus allowance covers your plan size plus extra for resends. Failed sends are given back.",
          "WhatsApp sets limits on how many people our number can message per day. If we reach it, the rest are sent the next day, or you can send them from your own phone.",
          "WhatsApp decides whether a message is delivered. We can’t guarantee delivery to every number.",
        ],
      ],
      [
        "Your guests and your messages",
        [
          "Only add people you are genuinely inviting, and only send invites to people who would expect one from you.",
          "When you add guests you confirm you have their permission to share their name and number with Guestlok for your event.",
          "Don’t use Guestlok for advertising, promotions, spam, or anything illegal, hateful or misleading. We may suspend accounts that do, without refund.",
          "You’re responsible for the photos and words you put on your invites.",
        ],
      ],
      [
        "At the gate",
        "Guestlok tells your ushers whether a code is valid, already used or not on your list. Who is let in is always your decision and your ushers’. We aren’t responsible for crowd control, security or anything that happens at your event.",
      ],
      [
        "Availability",
        "We work hard to keep Guestlok running, but it depends on the internet, phones and other companies’ services (including WhatsApp and Paystack). Keep a backup: download your guest list before the day, and your ushers can find guests by name if scanning isn’t possible.",
      ],
      [
        "Liability",
        "As far as the law allows, our total responsibility to you for any event is limited to what you paid for that event. We aren’t liable for indirect losses such as lost profits or costs of your event.",
      ],
      [
        "Ending",
        "You can delete your account at any time from Your account. We may close accounts that break these terms.",
      ],
      [
        "The law",
        "These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Lagos State have jurisdiction.",
      ],
      ["Changes", "If we change these terms we’ll update the date at the top and tell hosts by email about important changes."],
    ],
  },
};

/** /privacy and /terms: one plain, readable page. */
export default function Legal({ doc }) {
  const d = DOCS[doc] ?? DOCS.privacy;
  useTitle(d.title);
  const other = doc === "terms" ? ["/privacy", "Privacy policy"] : ["/terms", "Terms of use"];

  return (
    <div className="min-h-dvh bg-shell text-brown">
      <header className="mx-auto max-w-3xl px-5 pt-6 flex items-center justify-between gap-3">
        <Link to="/" aria-label="Guestlok home" className="text-[26px]">
          <Wordmark hole="#EEB12F" />
        </Link>
        <Link to={other[0]} className="h-10 px-4 rounded-full bg-white text-sm inline-flex items-center hover:-translate-y-px transition">
          {other[1]}
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-10 pb-20">
        <p className="eyebrow">Updated {UPDATED}</p>
        <h1 className="mt-3 text-[clamp(40px,7vw,64px)] font-normal tracking-[-0.045em] leading-[1]">{d.title}</h1>
        <p className="mt-5 text-[18px] text-brown-soft leading-relaxed">{d.intro}</p>

        <div className="mt-10 bento flex flex-col gap-9">
          {d.sections.map(([heading, ...parts], i) => (
            <section key={heading} aria-labelledby={`s${i}`}>
              <h2 id={`s${i}`} className="text-[22px] tracking-[-0.02em]">{heading}</h2>
              <div className="mt-3 flex flex-col gap-3 text-[16px] leading-relaxed">
                {parts.map((p, j) =>
                  Array.isArray(p) ? (
                    <ul key={j} className="flex flex-col gap-2">
                      {p.map((li) => (
                        <li key={li} className="flex gap-3">
                          <span className="mt-[0.6em] w-1.5 h-1.5 shrink-0 rounded-full bg-ochre" aria-hidden="true" />
                          <span>{li}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={j}>{p}</p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm text-brown-soft">
          Questions? Email <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">{EMAIL}</a>.
        </p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm hover:underline underline-offset-4">
          <ArrowLeft size={15} aria-hidden="true" /> Back to Guestlok
        </Link>
      </main>
    </div>
  );
}
