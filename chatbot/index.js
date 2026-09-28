'use strict';

/**
 * WibbleWobble Tech — free, open-source, real-time WhatsApp auto-reply agent.
 *
 * Stack: @whiskeysockets/baileys (MIT licensed, connects like WhatsApp Web —
 * no Meta Business approval, no per-message cost, no API keys to manage).
 *
 * How it works:
 *   1. First run: a QR code prints in this terminal. Scan it with
 *      WhatsApp > Linked Devices on Santanu's phone, once.
 *   2. From then on this process stays connected and reacts to the
 *      `messages.upsert` socket event the instant a message arrives —
 *      genuinely real-time / event-based, not polling.
 *   3. Each chat walks through flows/flow.js (the same Q&A tree as the
 *      "Santi" widget on the website), and every answer is appended to
 *      leads.jsonl so nothing is lost even if Santanu is offline.
 *
 * IMPORTANT — read before you deploy:
 *   Baileys is an *unofficial* library that talks to WhatsApp using the
 *   same protocol as WhatsApp Web. It is free and fully open source, but
 *   it is not endorsed by WhatsApp/Meta, and automating a personal number
 *   with it technically sits outside WhatsApp's Terms of Service — in
 *   practice this is extremely widely used for exactly this kind of
 *   personal/small-business auto-responder and is very low risk for a
 *   low-volume assistant like this one, but bans are not unheard of for
 *   high-volume or spammy use. If you'd rather stay fully inside WhatsApp's
 *   official terms, the alternative is Meta's WhatsApp Cloud API, which is
 *   also free (1,000 free service conversations/month) but requires a
 *   Meta Business/App verification step and a dedicated number. The
 *   flows/flow.js file is written so the same conversation tree can be
 *   reused against either backend later — see README.md.
 */

const path = require('path');
const fs = require('fs');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const { FLOW, KEYWORD_ROUTES, PRICING_TEXT } = require('./flows/flow');

const AUTH_DIR = path.join(__dirname, 'auth_state');
const LEADS_FILE = path.join(__dirname, 'leads.jsonl');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json'); // per-chat state, survives restarts

// ── Per-chat conversation state (JID -> { step, collecting, needsHuman }) ──
let sessions = {};
if (fs.existsSync(SESSIONS_FILE)) {
  try { sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); } catch { sessions = {}; }
}
function saveSessions() {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}
function getSession(jid) {
  if (!sessions[jid]) sessions[jid] = { step: null, collecting: {}, needsHuman: false };
  return sessions[jid];
}
function appendLead(jid, entry) {
  const line = JSON.stringify({ jid, ts: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFileSync(LEADS_FILE, line);
}

const RESET_WORDS = /^(menu|restart|start|hi|hello|hey)$/i;
const HUMAN_WORDS = /\b(talk to santanu|human|real person|stop bot|agent please)\b/i;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }), // set to 'info' while debugging
    printQRInTerminal: false, // we handle QR ourselves for a clearer prompt
    browser: ['WibbleWobble Santi', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\nScan this QR code with WhatsApp → Linked Devices:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log('Connection closed.', loggedOut ? 'Logged out — delete auth_state/ and re-scan.' : 'Reconnecting…');
      if (!loggedOut) start();
    } else if (connection === 'open') {
      console.log('✅ Connected — Santi is live on WhatsApp.');
    }
  });

  // ── The real-time event handler: fires the instant a message arrives ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error('Error handling message:', err);
      }
    }
  });
}

async function handleMessage(sock, msg) {
  const jid = msg.key.remoteJid;
  if (!jid) return;
  if (msg.key.fromMe) return;               // ignore our own messages
  if (jid.endsWith('@g.us')) return;         // ignore group chats
  if (jid === 'status@broadcast') return;    // ignore status updates

  const text = extractText(msg).trim();
  if (!text) return;

  const session = getSession(jid);

  // A human ("talk to Santanu") request permanently pauses the bot for
  // this chat — it should never talk over a real conversation.
  if (HUMAN_WORDS.test(text)) {
    session.needsHuman = true;
    saveSessions();
    await reply(sock, jid, "Of course — I've flagged this chat for Santanu to reply personally. He usually responds within 24h. 🙏");
    return;
  }
  if (session.needsHuman) return; // stay silent once a human takeover was requested

  // Reset / greeting words always restart the flow
  if (RESET_WORDS.test(text) || session.step === null) {
    session.step = 'start';
    session.collecting = {};
    saveSessions();
    await sendStep(sock, jid, 'start');
    return;
  }

  // Pricing short-circuit, same as the website bot
  if (/\b(price|cost|rate|fee|how much)\b/i.test(text) && session.step !== 'budget') {
    await reply(sock, jid, PRICING_TEXT);
    return;
  }

  const currentStep = FLOW[session.step];
  const choice = currentStep && currentStep.options ? currentStep.options[text] : null;

  let nextStepId = null;
  if (choice) {
    if (currentStep.collect) {
      session.collecting[currentStep.collect] = choice.label;
      appendLead(jid, { field: currentStep.collect, value: choice.label });
    }
    nextStepId = choice.next;
  } else {
    // Not a valid number for this step — try keyword routing
    const match = KEYWORD_ROUTES.find((r) => r.re.test(text));
    if (match) {
      nextStepId = match.next;
    } else if (Object.keys(currentStep?.options || {}).length) {
      // Invalid reply inside an active menu — re-prompt instead of guessing
      await reply(sock, jid, "Sorry, I didn't catch that — please reply with one of the numbers above, or type *menu* to start over.");
      return;
    } else {
      // Terminal step (booking/goodbye/email_direct) and free text that
      // isn't a command — this is a real question for Santanu, not the bot.
      // Log it and go quiet so he can reply personally.
      appendLead(jid, { field: 'free_text_after_flow', value: text });
      return;
    }
  }

  session.step = nextStepId;
  saveSessions();
  await sendStep(sock, jid, nextStepId);
}

async function sendStep(sock, jid, stepId) {
  const step = FLOW[stepId];
  if (!step) return;
  const text = typeof step.text === 'function' ? step.text() : step.text;
  await reply(sock, jid, text);
}

async function reply(sock, jid, text) {
  // A short typing indicator makes the handoff feel like a live assistant,
  // matching the "Santi is typing…" moment on the website widget.
  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
  } catch { /* presence is best-effort, never block the reply on it */ }
  await sock.sendMessage(jid, { text });
}

function extractText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

start().catch((err) => {
  console.error('Fatal error starting bot:', err);
  process.exit(1);
});
