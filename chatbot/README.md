# Santi for WhatsApp

A free, open-source, real-time auto-reply agent for WhatsApp — the same
Q&A flow as the "Santi" widget on the WibbleWobble Tech website, now
answering directly inside WhatsApp on Santanu's own number.

- **Cost:** $0. No Meta Business account, no API keys, no per-message fees.
- **Library:** [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys)
  (MIT licensed) — connects the same way WhatsApp Web does.
- **Event-driven:** reacts instantly to the `messages.upsert` socket event —
  not polling, no delay.
- **Lead capture:** every answer is appended to `leads.jsonl` so nothing is
  lost even if Santanu doesn't see WhatsApp for a while.

## Why this isn't inside `index.html`

WhatsApp only ever "talks" to a program that stays running and holds an
open, authenticated connection to it — that's fundamentally a small server
process, not something a static webpage can do. This project is that
process. It runs independently of the website; the site doesn't need to
change at all for this to work.

## 1. Install

```bash
npm install
```

(Requires Node.js 18+.)

## 2. Run it & pair your WhatsApp

```bash
npm start
```

A QR code prints in the terminal. On the phone that owns the WhatsApp
number you want the bot to run on:

**WhatsApp → Settings → Linked Devices → Link a Device**, then scan it.

That's it — you only do this once. The session is saved to `auth_state/`
(git-ignored) so restarts don't need a re-scan.

## 3. Try it

From a **different** phone number, message the linked WhatsApp number.
Santi will greet them and walk through the same menu as the website:
business type → challenge → timeline → budget → a booking link, or
hiring / collaboration / just-exploring branches. Reply with the numbers
shown (1, 2, 3…), or type things like "book a call", "pricing", or
"menu" to restart.

Say "talk to Santanu" / "human" any time to pause the bot for that chat —
it goes quiet so a real reply isn't talked over.

## 4. Edit the conversation

Everything the bot says lives in `flows/flow.js` — it's the same tree as
the site's Q&A, just in plain text. Change the copy, add steps, or add
new keyword routes there; no changes needed in `index.js`.

## 5. Keep it running for free

This needs to stay running 24/7 to answer messages, so pick one:

| Option | Notes |
|---|---|
| **A spare always-on machine** (old laptop, Raspberry Pi, home server) | Simplest, fully free, run with `pm2` or `screen` so it survives reboots/disconnects. |
| **Render.com free Background Worker** | Free tier sleeps after inactivity on *web* services, but a Background Worker stays up; check current limits. |
| **Railway.app free trial credits** | Easiest to deploy from GitHub, but free tier is credit-based, not indefinite. |
| **Fly.io free allowance** | Small free VM allowance, works well for a lightweight always-on Node process. |

Whichever host you pick, **just upload this whole folder minus
`node_modules/`** and run `npm install && npm start`. The first boot on a
new host needs a fresh QR scan (you can't copy `auth_state/` between
machines with a different environment reliably — treat it as local to
wherever it's deployed).

## A note on which path is "correct"

Baileys is unofficial — it isn't blocked or against the law, and it's
what most personal/small-business WhatsApp bots you've seen are built
on, but it does sit outside WhatsApp's official Terms of Service, and a
number can in theory be flagged for automated behaviour (rare for a
low-volume assistant like this, but worth knowing). If you'd rather be
fully inside WhatsApp's rules — e.g. once volume grows or this becomes
business-critical — the official path is **Meta's WhatsApp Cloud
API**: also free (1,000 free service conversations/month at time of
writing), but requires a Meta Business verification step and a
dedicated number, and needs a small webhook server instead of the
Baileys socket connection here. The conversation tree in `flows/flow.js`
is written so it can be reused as the reply logic behind either backend —
happy to build the Cloud API version too if you'd rather start there
instead, or run both.

## Files

```
wwt-whatsapp-bot/
├── index.js         # connects to WhatsApp, listens for messages, replies
├── flows/flow.js     # the Q&A conversation tree (edit this to change copy)
├── package.json
├── auth_state/        # created on first run — your WhatsApp session (don't commit)
├── sessions.json       # created on first run — per-chat progress (don't commit)
└── leads.jsonl          # created as people chat — one JSON line per answer captured
```
