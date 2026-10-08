# WibbleWobble — Meta WhatsApp Cloud API backend

Replace `chatbot/index.js` and `chatbot/package.json` in `Sata23/my_website2`. Keep your existing `chatbot/flows/flow.js` unchanged; the copy in this ZIP is a line-prefix-cleaned reference from the uploaded text, not a required overwrite.

## Render settings
- Root directory: `chatbot`
- Build command: `npm install` (until you commit a freshly generated `package-lock.json`); then use `npm ci`
- Start command: `npm start`
- Node >=20, Render Free Web Service

## Required environment variables
- `DATABASE_URL`: Render PostgreSQL internal URL
- `WHATSAPP_APP_SECRET`: Meta App Secret
- `WHATSAPP_VERIFY_TOKEN`: your chosen Meta webhook verification token
- `WHATSAPP_ACCESS_TOKEN`: valid Meta access token
- `WHATSAPP_PHONE_NUMBER_ID`: Meta WhatsApp phone number ID
- `ALLOWED_ORIGIN`: `https://www.wibblewobbletech.com` (adjust to the actual website origin)

## Optional variables
- `META_GRAPH_VERSION=v23.0` (update to a currently supported Meta Graph API version when needed)
- `AI_ENABLED=false` (default; set `true` to enable paid API requests on terminal free-text questions)
- `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o-mini`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-3-5-haiku-latest`
- `DATABASE_SSL=true` only if your PostgreSQL provider requires TLS and its CA is trusted by Node

## Test
1. Deploy. Confirm logs show `Santi Meta Cloud API backend listening`.
2. Open `https://my-website2-4j75.onrender.com/health` — expected `{ "status": "ok" }`.
3. In Meta Webhooks, set callback URL `https://my-website2-4j75.onrender.com/webhook` and the matching verify token; subscribe to `messages`.
4. Send a test message from an authorized test recipient to your configured WhatsApp number.
5. Submit website leads only after adapting the frontend form payload to `{ name, email, message, phone? }` and setting `API_BASE_URL` to the Render URL.

## Important limitations
- The service acknowledges incoming webhooks before finishing work, with no durable job queue. On Render Free sleep/restarts, some messages can be lost. Use a queue/worker for production.
- In-memory per-IP throttling and Origin checks are not strong public API authentication; add bot protection, spam controls and privacy/consent measures before public launch.
- The current database schema auto-creates tables at startup; use migrations for production.
- PostgreSQL message deduplication does not serialize multiple different messages from the same contact; add a per-contact queue/lock for production.
- If WhatsApp message sending fails after persisting the session, a retried message may see an already-advanced session. Use an outbox transaction pattern for production.
- Meta access tokens expire unless you configure suitable long-lived credentials.
- Render Free PostgreSQL expires after 30 days; export/migrate data before expiry.
- Existing `flows/flow.js` contains commercial claims, prices, compensation expectations, email and booking link. Review these before exposing the bot publicly.
- `AI_ENABLED=true` can incur OpenAI/Anthropic charges. Keep it `false` during zero-cost testing.
- Do not commit `.env`, `auth_state`, local session files, or tokens.
