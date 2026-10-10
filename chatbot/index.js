'use strict';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
const { FLOW, KEYWORD_ROUTES, PRICING_TEXT } = require('./flows/flow');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
const PORT = Number(process.env.PORT || 3000);
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const ORIGIN = process.env.ALLOWED_ORIGIN || process.env.WEBSITE_URL || '';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
// Render secrets can accidentally contain a pasted "Bearer " prefix or whitespace.
const ACCESS_TOKEN = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim().replace(/^Bearer\s+/i, '').trim();
const DB_URL = process.env.DATABASE_URL;
const AI_ENABLED = process.env.AI_ENABLED === 'true';
const db = DB_URL ? new Pool({ connectionString: DB_URL, max: 3, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined }) : null;
const RESET = /^(menu|restart|start|hi|hello|hey)$/i;
const HUMAN = /\b(talk to santanu|human|real person|stop bot|agent please)\b/i;
const pricingChoice = (s) => s.step === 'pricing';

// Render liveness: do not depend on PostgreSQL or external APIs.
// Configure Render's Health Check Path as /live.
app.get('/', (_req, res) => res.status(200).json({ service: 'santi-whatsapp-backend', status: 'running' }));
app.get('/live', (_req, res) => res.status(200).json({ status: 'ok', uptime_seconds: Math.round(process.uptime()) }));

// Database readiness remains a separate diagnostic endpoint.
app.get('/health', async (_req, res) => {
  if (!db) return res.status(503).json({ status: 'unhealthy', reason: 'DATABASE_URL not configured' });
  try { await db.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'unhealthy', reason: 'database unavailable' }); }
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN && typeof challenge === 'string') return res.status(200).send(challenge);
  res.sendStatus(403);
});

function verifySignature(req, res, next) {
  if (!APP_SECRET) { console.error('[webhook] App secret missing'); return res.sendStatus(503); }
  const signature = req.get('x-hub-signature-256') || '';
  if (!signature.startsWith('sha256=')) { console.warn('[webhook] Missing signature'); return res.sendStatus(403); }
  const expected = crypto.createHmac('sha256', APP_SECRET).update(req.body).digest('hex');
  const actual = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(actual) || !crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))) { console.warn('[webhook] Invalid signature'); return res.sendStatus(403); }
  next();
}

app.post('/webhook', express.raw({ type: 'application/json', limit: '256kb' }),
  (req, res, next) => { console.log('[webhook] POST received'); next(); },
  verifySignature,
  (req, res) => {
    let body;
    try { body = JSON.parse(req.body.toString('utf8')); }
    catch { console.warn('[webhook] Invalid JSON'); return res.sendStatus(400); }
    const changes = (body.entry || []).flatMap(e => e.changes || []);
    const messageCount = changes.reduce((n, c) => n + (c.value?.messages?.length || 0), 0);
    console.log('[webhook] Verified', { object: body.object, fields: changes.map(c => c.field), messageCount });
    if (body.object !== 'whatsapp_business_account') return res.sendStatus(200);
    res.sendStatus(200); // Acknowledge Meta promptly.
    processWebhook(body)
      .then(() => console.log('[webhook] Processing complete'))
      .catch(e => console.error('[webhook] Processing failed:', e.message));
  }
);

async function processWebhook(body) {
  if (!db) throw new Error('DATABASE_URL required');
  for (const entry of body.entry || []) for (const change of entry.changes || []) {
    if (change.field !== 'messages') continue;
    const value = change.value || {};
    if (value.metadata?.phone_number_id && String(value.metadata.phone_number_id) !== String(PHONE_ID)) { console.warn('[webhook] Ignored event for another phone number ID'); continue; }
    for (const msg of value.messages || []) {
      if (!msg.id || !msg.from) continue;
      const text = String(msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || '').trim();
      if (!text) { console.log('[webhook] Skipped non-text message'); continue; }
      console.log('[webhook] Incoming text message');
      await handleMessage(msg.from, msg.id, text);
    }
  }
}

async function sendWhatsApp(to, text) {
  if (!ACCESS_TOKEN || !PHONE_ID) throw new Error('WhatsApp credentials missing');
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(PHONE_ID)}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: String(text).slice(0, 4000) } })
  });
  if (!response.ok) {
    // Log only Meta's diagnostic codes, never tokens, phone numbers or response headers.
    let code = null, subcode = null, errorType = null, isTransient = null;
    try {
      const payload = await response.json();
      code = payload?.error?.code ?? null;
      subcode = payload?.error?.error_subcode ?? null;
      errorType = payload?.error?.type ?? null;
      isTransient = payload?.error?.is_transient ?? null;
    } catch { /* Keep HTTP status when Meta's body is not JSON. */ }
    console.error('[whatsapp] Send rejected', { httpStatus: response.status, metaCode: code, metaSubcode: subcode, errorType, isTransient });
    throw new Error(`Meta send failed HTTP ${response.status} (code=${code}, subcode=${subcode})`);
  }
  console.log('[whatsapp] Reply sent successfully');
}

async function handleMessage(phone, messageId, text) {
  // Atomic message claim prevents processing the same Meta delivery twice.
  const claim = await db.query('INSERT INTO processed_messages (message_id, phone) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING message_id', [messageId, phone]);
  if (!claim.rowCount) { console.log('[webhook] Duplicate message ignored'); return; }
  try {
    const prior = await db.query('SELECT step, collecting, needs_human FROM whatsapp_sessions WHERE phone=$1', [phone]);
    const session = prior.rows[0] || { step: null, collecting: {}, needs_human: false };
    let answer = null;
    let next = session.step;
    let needsHuman = session.needs_human;
    let collecting = session.collecting || {};
    let leadField = null;
    let leadValue = null;

    if (HUMAN.test(text)) {
      needsHuman = true;
      answer = "Of course — I've flagged this chat for a personal reply. Please allow time for a response.";
    } else if (RESET.test(text)) {
      next = 'start'; collecting = {}; needsHuman = false; answer = getStepText('start');
    } else if (needsHuman) {
      return;
    } else if (!next) {
      next = 'start'; answer = getStepText('start');
    } else if (pricingChoice(session) && (text === '1' || text === '2')) {
      next = text === '1' ? 'booking' : 'start'; answer = getStepText(next);
    } else if (/\b(price|cost|rate|fee|how much)\b/i.test(text) && next !== 'budget') {
      next = 'pricing'; answer = PRICING_TEXT;
    } else {
      const step = FLOW[next];
      const choice = step?.options?.[text];
      if (choice) {
        if (step.collect) { collecting[step.collect] = choice.label; leadField = step.collect; leadValue = choice.label; }
        next = choice.next;
        answer = getStepText(next);
      } else {
        const keyword = KEYWORD_ROUTES.find((r) => r.re.test(text));
        if (keyword) { next = keyword.next; answer = getStepText(next); }
        else if (Object.keys(step?.options || {}).length) answer = "Please reply with one of the numbered options, or type *menu* to start over.";
        else {
          leadField = 'free_text_after_flow'; leadValue = text.slice(0, 4000);
          needsHuman = true;
          answer = (AI_ENABLED ? await aiReply(text) : null) || 'Thanks. Your message has been noted for a personal follow-up.';
        }
      }
    }

    await db.query(`INSERT INTO whatsapp_sessions(phone,step,collecting,needs_human,updated_at)
      VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(phone) DO UPDATE SET step=$2,collecting=$3,needs_human=$4,updated_at=NOW()`,
      [phone, next, JSON.stringify(collecting), needsHuman]);
    if (leadField) await db.query('INSERT INTO lead_events(source,contact,field,value) VALUES($1,$2,$3,$4)', ['whatsapp', phone, leadField, leadValue]);
    if (next === 'booking' || needsHuman) await db.query('INSERT INTO lead_events(source,contact,field,value) VALUES($1,$2,$3,$4)', ['whatsapp', phone, 'handoff', JSON.stringify({ step: next, collecting, needsHuman })]);
    if (answer) await sendWhatsApp(phone, answer);
  } catch (error) {
    // Allow Meta redelivery or a manual retry to reprocess a failed message.
    await db.query('DELETE FROM processed_messages WHERE message_id=$1', [messageId]).catch(() => {});
    throw error;
  }
}

async function aiReply(question) {
  const system = `You are Santi, a concise assistant for WibbleWobble Tech. Answer general questions about AI, software and automation. Do not invent company facts, prices, deadlines or guarantees. If details are missing, suggest a personal follow-up. Do not request secrets or sensitive personal data. Keep answers under 700 characters.`;
  if (process.env.OPENAI_API_KEY) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.2, max_tokens: 180, messages: [{ role: 'system', content: system }, { role: 'user', content: question.slice(0, 2000) }] }),
        signal: AbortSignal.timeout(12000)
      });
      if (r.ok) return (await r.json()).choices?.[0]?.message?.content?.slice(0, 700) || null;
      console.error('OpenAI request failed:', r.status);
    } catch (e) { console.error('OpenAI unavailable:', e.message); }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest', max_tokens: 180, system, messages: [{ role: 'user', content: question.slice(0, 2000) }] }),
        signal: AbortSignal.timeout(12000)
      });
      if (r.ok) return (await r.json()).content?.find(c => c.type === 'text')?.text?.slice(0, 700) || null;
      console.error('Anthropic request failed:', r.status);
    } catch (e) { console.error('Anthropic unavailable:', e.message); }
  }
  return null;
}

function getStepText(id) {
  const step = FLOW[id];
  if (!step) throw new Error(`Unknown flow step: ${id}`);
  return typeof step.text === 'function' ? step.text() : step.text;
}

// Website lead submissions: browser origin restrictions plus simple per-IP throttling.
const rate = new Map();
app.use('/api/leads', cors({ origin(origin, cb) { cb(null, !!ORIGIN && origin === ORIGIN); } }));
app.post('/api/leads', express.json({ limit: '16kb' }), async (req, res) => {
  if (!ORIGIN || req.get('origin') !== ORIGIN) return res.sendStatus(403);
  const ip = req.ip;
  const now = Date.now();
  if (rate.size > 10000) rate.clear();
  const previous = rate.get(ip) || { count: 0, since: now };
  const entry = now - previous.since > 60000 ? { count: 1, since: now } : { count: previous.count + 1, since: previous.since };
  rate.set(ip, entry);
  if (entry.count > 5) return res.status(429).json({ error: 'Too many submissions' });
  const { name, email, message, phone } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.length > 150 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof message !== 'string' || !message.trim() || message.length > 4000 || (phone != null && (typeof phone !== 'string' || phone.length > 40))) return res.status(400).json({ error: 'Valid name, email and message required' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await db.query('INSERT INTO website_leads(name,email,phone,message) VALUES($1,$2,$3,$4)', [name.trim(), email.trim(), phone || null, message.trim()]);
    return res.status(201).json({ ok: true });
  } catch (e) { console.error('Lead insert failed:', e.message); return res.status(503).json({ error: 'Unable to save lead' }); }
});

async function initDatabase() {
  if (!db) throw new Error('DATABASE_URL must be configured');
  await db.query(`CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    phone TEXT PRIMARY KEY, step TEXT, collecting JSONB NOT NULL DEFAULT '{}'::jsonb,
    needs_human BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS processed_messages (
    message_id TEXT PRIMARY KEY, phone TEXT NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS lead_events (
    id BIGSERIAL PRIMARY KEY, source TEXT NOT NULL, contact TEXT NOT NULL,
    field TEXT NOT NULL, value TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS website_leads (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
    phone TEXT, message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}

async function start() {
  if (!VERIFY_TOKEN || !APP_SECRET || !PHONE_ID || !ACCESS_TOKEN) throw new Error('Missing Meta WhatsApp environment variables');
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => console.log(`Santi Meta Cloud API backend listening on ${PORT}; AI_ENABLED=${AI_ENABLED}`));
}
start().catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
