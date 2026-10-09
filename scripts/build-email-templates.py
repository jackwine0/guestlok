"""
Builds Guestlok's Supabase Auth email templates (supabase/templates/*.html) from one layout.

Run:  python scripts/build-email-templates.py
Then paste each file into Supabase → Authentication → Email Templates (subjects are printed),
or let `supabase config push` use the paths in supabase/config.toml.

Go template variables Supabase fills in:
  {{ .ConfirmationURL }}  {{ .Token }}  {{ .SiteURL }}  {{ .Email }}  {{ .NewEmail }}  {{ .Data.full_name }}
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "supabase" / "templates"

BROWN, OCHRE, CREAM, SHELL, SOFT, MUTE, TILE = "#2B1B12", "#EEB12F", "#F5E7A8", "#EAE6DF", "#5A4A3E", "#A39A92", "#F4F1EC"
FONT = "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
HELLO = "{{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}there{{ end }}"


def layout(*, title, preheader, kicker, heading, paragraphs, button=None, code=None, note, link_fallback=True):
    paras = "".join(
        f'<p style="margin:0 0 16px;font:400 16px/1.6 {FONT};color:{SOFT};">{p}</p>' for p in paragraphs
    )
    btn = ""
    if button:
        btn = f"""
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
              <tr><td align="center" bgcolor="{OCHRE}" style="border-radius:999px;">
                <a href="{{{{ .ConfirmationURL }}}}" target="_blank"
                   style="display:inline-block;padding:16px 30px;font:600 16px/1 {FONT};color:{BROWN};text-decoration:none;border-radius:999px;">
                  {button} &rarr;
                </a>
              </td></tr>
            </table>"""
    code_block = ""
    if code:
        code_block = f"""
            <div style="margin:8px 0 24px;padding:18px 0;border-radius:20px;background:{TILE};text-align:center;
                        font:600 34px/1 'JetBrains Mono', Menlo, Consolas, monospace;letter-spacing:8px;color:{BROWN};">
              {{{{ .Token }}}}
            </div>"""
    fallback = ""
    if button and link_fallback:
        fallback = f"""
            <p style="margin:0 0 6px;font:400 13px/1.5 {FONT};color:{MUTE};">Button not working? Copy this link into your browser:</p>
            <p style="margin:0 0 20px;font:400 13px/1.5 {FONT};word-break:break-all;">
              <a href="{{{{ .ConfirmationURL }}}}" style="color:{SOFT};text-decoration:underline;">{{{{ .ConfirmationURL }}}}</a>
            </p>"""
    return f"""<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <title>{title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:{SHELL};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{SHELL};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <!-- Header -->
          <tr>
            <td style="background:{BROWN};border-radius:28px 28px 0 0;padding:28px 32px 26px;">
              <a href="{{{{ .SiteURL }}}}" target="_blank" style="text-decoration:none;">
                <img src="{{{{ .SiteURL }}}}/email/logo-light.png" width="128" height="44" alt="guestlok"
                     style="display:block;border:0;width:128px;height:auto;color:{CREAM};font:600 26px/1 {FONT};" />
              </a>
              <p style="margin:18px 0 0;font:500 12px/1 {FONT};letter-spacing:2px;text-transform:uppercase;color:{OCHRE};">{kicker}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;border-radius:0 0 28px 28px;padding:32px 32px 28px;">
              <h1 style="margin:0 0 16px;font:500 30px/1.15 {FONT};letter-spacing:-0.8px;color:{BROWN};">{heading}</h1>
              {paras}{btn}{code_block}{fallback}
              <p style="margin:4px 0 0;padding-top:18px;border-top:1px solid {TILE};font:400 13px/1.55 {FONT};color:{MUTE};">{note}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:22px 16px 0;font:400 12px/1.6 {FONT};color:{MUTE};">
              Guestlok · Personal QR invites for Nigerian parties<br />
              <a href="{{{{ .SiteURL }}}}" style="color:{SOFT};text-decoration:underline;">Visit Guestlok</a>
              &nbsp;·&nbsp; Made in Lagos
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


TEMPLATES = {
    "confirmation": dict(
        subject="Confirm your email for Guestlok",
        title="Confirm your email",
        preheader="One tap and you can start planning your event.",
        kicker="Welcome to the list",
        heading=f"Hi {HELLO}, confirm your email.",
        paragraphs=["Tap the button below to confirm your email and finish creating your Guestlok account. Then you can set up your event and start sending invites."],
        button="Confirm my email",
        note="Didn’t sign up for Guestlok? You can ignore this email and no account will be created.",
    ),
    "recovery": dict(
        subject="Reset your Guestlok password",
        title="Reset your password",
        preheader="Choose a new password for your Guestlok account.",
        kicker="Password reset",
        heading="Choose a new password.",
        paragraphs=["Someone (hopefully you) asked to reset the password for <strong style=\"color:#2B1B12;\">{{ .Email }}</strong>.", "Tap the button to choose a new one. The link works once and expires soon."],
        button="Reset my password",
        note="Didn’t ask for this? Ignore this email and your password stays the same.",
    ),
    "magic_link": dict(
        subject="Your Guestlok sign-in link",
        title="Sign in to Guestlok",
        preheader="Tap to sign in. No password needed.",
        kicker="Sign in",
        heading="Here’s your sign-in link.",
        paragraphs=["Tap the button to sign in to Guestlok. The link works once and expires soon."],
        button="Sign in to Guestlok",
        note="Didn’t try to sign in? You can safely ignore this email.",
    ),
    "email_change": dict(
        subject="Confirm your new email for Guestlok",
        title="Confirm your new email",
        preheader="Confirm the change to your Guestlok email address.",
        kicker="Email change",
        heading="Confirm your new email.",
        paragraphs=["You asked to change your Guestlok email from <strong style=\"color:#2B1B12;\">{{ .Email }}</strong> to <strong style=\"color:#2B1B12;\">{{ .NewEmail }}</strong>.", "Tap the button to confirm."],
        button="Confirm new email",
        note="Didn’t ask for this? Ignore this email and sign in to check your account.",
    ),
    "invite": dict(
        subject="You’ve been invited to Guestlok",
        title="You’re invited",
        preheader="Accept your invite to start using Guestlok.",
        kicker="You’re invited",
        heading="You’ve been invited to Guestlok.",
        paragraphs=["Guestlok sends personal QR invites for private events and checks every guest at the gate. Tap below to accept and set up your account."],
        button="Accept invite",
        note="Not expecting this? You can ignore this email.",
    ),
    "reauthentication": dict(
        subject="Your Guestlok verification code",
        title="Your verification code",
        preheader="Use this code to confirm it’s you.",
        kicker="Verification",
        heading="Confirm it’s you.",
        paragraphs=["Enter this code in Guestlok to continue:"],
        code=True,
        note="Didn’t request a code? Someone may be trying to use your account. Change your password.",
    ),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, t in TEMPLATES.items():
        subject = t.pop("subject")
        (OUT / f"{name}.html").write_text(layout(**t), encoding="utf-8")
        print(f"{name:18} subject: {subject}")


if __name__ == "__main__":
    main()
