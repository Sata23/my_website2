'use strict';

/**
 * This is the SAME conversation tree as the "Santi" chatbot on the
 * WibbleWobble Tech website (index.html), ported to plain text for
 * WhatsApp. Each step has:
 *   - text:    the message sent to the user
 *   - options: numbered choices — user replies "1", "2", etc.
 *   - collect: the label under which the chosen answer is stored,
 *              so we can hand off a full summary to Santanu later.
 *
 * Edit the copy here any time — the bot picks it up on next restart,
 * no code changes needed elsewhere.
 */

const MEET = 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ3KKH88CXeUFIKKK2BRKy_xbdGNijGGBzK8AObJi7WrT31lIBDHmZB2l2J8rPKSOBph1Xz1YSMa';
const EMAIL = 'santa@wibblewobbleapp.com';

const FLOW = {
  start: {
    text: "Hi 👋 I'm *Santi*, Santanu's AI assistant for WibbleWobble Tech.\n\nWhat best describes you today?\n\n1️⃣ I run a business / startup\n2️⃣ I'm hiring / recruiting\n3️⃣ I want to collaborate\n4️⃣ Just exploring",
    collect: 'I am',
    options: {
      '1': { label: 'Business / startup', next: 'business_type' },
      '2': { label: 'Hiring / recruiting', next: 'hiring' },
      '3': { label: 'Want to collaborate', next: 'collaborate' },
      '4': { label: 'Just exploring', next: 'exploring' },
    },
  },

  business_type: {
    text: 'Great! What stage is your business at?\n\n1️⃣ Early stage / startup\n2️⃣ Growing SMB\n3️⃣ Enterprise / large org\n4️⃣ Just validating an idea',
    collect: 'Business stage',
    options: {
      '1': { label: 'Early stage / startup', next: 'challenge' },
      '2': { label: 'Growing SMB', next: 'challenge' },
      '3': { label: 'Enterprise / large org', next: 'challenge' },
      '4': { label: 'Validating an idea', next: 'challenge' },
    },
  },

  challenge: {
    text: "Got it. What's your biggest challenge right now?\n\n1️⃣ We need AI / automation\n2️⃣ Operations are slow & manual\n3️⃣ No data insights / visibility\n4️⃣ Need to build a product fast\n5️⃣ Costs are too high",
    collect: 'Main challenge',
    options: {
      '1': { label: 'Need AI / automation', next: 'ai_detail' },
      '2': { label: 'Ops slow & manual', next: 'ops_detail' },
      '3': { label: 'No data insights', next: 'data_detail' },
      '4': { label: 'Need product built fast', next: 'mvp_detail' },
      '5': { label: 'Costs too high', next: 'cost_detail' },
    },
  },

  ai_detail: {
    text: 'AI is exactly where I specialise. Which area do you need most?\n\n1️⃣ Custom AI agents / LLM systems\n2️⃣ Integrate AI into existing tools\n3️⃣ RAG / document intelligence\n4️⃣ AI for operations / supply chain\n5️⃣ AI for compliance / BFSI',
    collect: 'AI need',
    options: {
      '1': { label: 'Custom AI agents / LLM systems', next: 'timeline' },
      '2': { label: 'Integrate AI into existing tools', next: 'timeline' },
      '3': { label: 'RAG / document intelligence', next: 'timeline' },
      '4': { label: 'AI for operations / supply chain', next: 'timeline' },
      '5': { label: 'AI for compliance / BFSI', next: 'timeline' },
    },
  },

  ops_detail: {
    text: 'Operational efficiency is a direct P&L lever. Where are you losing the most time?\n\n1️⃣ Manual reporting & data entry\n2️⃣ Email / CRM workflows\n3️⃣ Cross-system integrations\n4️⃣ Team coordination & approvals',
    collect: 'Ops pain point',
    options: {
      '1': { label: 'Manual reporting & data entry', next: 'timeline' },
      '2': { label: 'Email / CRM workflows', next: 'timeline' },
      '3': { label: 'Cross-system integrations', next: 'timeline' },
      '4': { label: 'Team coordination & approvals', next: 'timeline' },
    },
  },

  data_detail: {
    text: 'Data visibility is a leadership problem. What decisions are you flying blind on?\n\n1️⃣ Sales / revenue forecasting\n2️⃣ Customer behaviour & churn\n3️⃣ Supply chain / inventory\n4️⃣ Engineering / product metrics',
    collect: 'Data question',
    options: {
      '1': { label: 'Sales / revenue forecasting', next: 'timeline' },
      '2': { label: 'Customer behaviour & churn', next: 'timeline' },
      '3': { label: 'Supply chain / inventory', next: 'timeline' },
      '4': { label: 'Engineering / product metrics', next: 'timeline' },
    },
  },

  mvp_detail: {
    text: "I've shipped MVPs in under 60 days. What type of product do you need?\n\n1️⃣ Web platform / SaaS\n2️⃣ Mobile app\n3️⃣ AI-powered product\n4️⃣ API / backend system",
    collect: 'Product type',
    options: {
      '1': { label: 'Web platform / SaaS', next: 'timeline' },
      '2': { label: 'Mobile app', next: 'timeline' },
      '3': { label: 'AI-powered product', next: 'timeline' },
      '4': { label: 'API / backend system', next: 'timeline' },
    },
  },

  cost_detail: {
    text: 'Cost optimisation through AI and cloud-native architecture is a core strength here. Where are costs hurting most?\n\n1️⃣ Cloud infrastructure spend\n2️⃣ Manual labour / headcount\n3️⃣ Tech debt & maintenance\n4️⃣ Vendor / software licences',
    collect: 'Cost pain point',
    options: {
      '1': { label: 'Cloud infrastructure spend', next: 'timeline' },
      '2': { label: 'Manual labour / headcount', next: 'timeline' },
      '3': { label: 'Tech debt & maintenance', next: 'timeline' },
      '4': { label: 'Vendor / software licences', next: 'timeline' },
    },
  },

  timeline: {
    text: 'Almost there! When are you looking to get started?\n\n1️⃣ Immediately — this week\n2️⃣ Within 1 month\n3️⃣ Next quarter\n4️⃣ Just planning ahead',
    collect: 'Timeline',
    options: {
      '1': { label: 'Immediately — this week', next: 'budget' },
      '2': { label: 'Within 1 month', next: 'budget' },
      '3': { label: 'Next quarter', next: 'budget' },
      '4': { label: 'Just planning ahead', next: 'budget' },
    },
  },

  budget: {
    text: "Last question — what's your approximate budget range?\n\n1️⃣ Under $5K\n2️⃣ $5K – $20K\n3️⃣ $20K – $100K\n4️⃣ Enterprise — open\n5️⃣ Prefer to discuss",
    collect: 'Budget',
    options: {
      '1': { label: 'Under $5K', next: 'booking' },
      '2': { label: '$5K – $20K', next: 'booking' },
      '3': { label: '$20K – $100K', next: 'booking' },
      '4': { label: 'Enterprise — open', next: 'booking' },
      '5': { label: 'Prefer to discuss', next: 'booking' },
    },
  },

  hiring: {
    text: 'Santanu is open to senior AI/GenAI leadership roles — Programme Delivery Head, AI Architect, or Enterprise AI Transformation lead.\n\nWhat type of engagement?\n\n1️⃣ Full-time / permanent role\n2️⃣ Contract / consulting\n3️⃣ Remote / global',
    collect: 'Engagement type',
    options: {
      '1': { label: 'Full-time / permanent role', next: 'hiring_detail' },
      '2': { label: 'Contract / consulting', next: 'hiring_detail' },
      '3': { label: 'Remote / global', next: 'hiring_detail' },
    },
  },

  hiring_detail: {
    text: 'Santanu is based in Bangalore, open to India, UAE, Singapore, UK, Australia and Remote. Target: ₹80L+ or equivalent globally.\n\n1️⃣ Book a call\n2️⃣ Email instead',
    options: {
      '1': { label: 'Book a call', next: 'booking' },
      '2': { label: 'Email instead', next: 'email_direct' },
    },
  },

  collaborate: {
    text: 'Santanu is always open to interesting collaborations — joint ventures, technical partnerships, and co-building.\n\nWhat did you have in mind?\n\n1️⃣ Technical partnership\n2️⃣ Co-build a product\n3️⃣ Speaking / advisory',
    collect: 'Collaboration interest',
    options: {
      '1': { label: 'Technical partnership', next: 'booking' },
      '2': { label: 'Co-build a product', next: 'booking' },
      '3': { label: 'Speaking / advisory', next: 'booking' },
    },
  },

  exploring: {
    text: 'No problem at all! Quick overview of what I can help with:\n\n🤖 AI & LLM systems\n⚙️ Automation & workflows\n🚀 MVP builds\n🏛️ Enterprise architecture\n\nAnything spark your interest?\n\n1️⃣ Tell me about AI solutions\n2️⃣ MVP builds\n3️⃣ Book a free discovery call\n4️⃣ Just browsing, thanks',
    options: {
      '1': { label: 'AI solutions', next: 'ai_detail' },
      '2': { label: 'MVP builds', next: 'mvp_detail' },
      '3': { label: 'Book a free discovery call', next: 'booking' },
      '4': { label: 'Just browsing', next: 'goodbye' },
    },
  },

  booking: {
    text: () =>
      `Perfect — I have everything I need! 🎉\n\nGrab a slot here (free, 15 min, 2-minute booking):\n${MEET}\n\nSantanu will see your answers above and come prepared. If you'd rather just keep chatting here, go ahead — I'll flag this thread for him to reply personally within 24h.\n\nType *menu* any time to start over.`,
    options: {},
  },

  email_direct: {
    text: () => `You can also reach Santanu directly at ${EMAIL} — he replies to all serious enquiries within 24h.\n\nType *menu* to start over, or just keep typing — this chat is being flagged for his personal reply too.`,
    options: {},
  },

  goodbye: {
    text: 'No worries at all! Feel free to come back anytime — just type *menu*. 👋',
    options: {},
  },
};

// Free-text keyword routing — mirrors the website bot's fallback logic,
// used when the user types words instead of picking a number.
const KEYWORD_ROUTES = [
  { re: /\b(book|call|calendar|schedule|meet)\b/i, next: 'booking' },
  { re: /\b(email|mail)\b/i, next: 'email_direct' },
  { re: /\b(ai|llm|agent|automat|genai|gpt|langchain)\b/i, next: 'ai_detail' },
  { re: /\b(mvp|build|product|app|mobile|web)\b/i, next: 'mvp_detail' },
  { re: /\b(cost|budget|cheaper|reduc|optimis)\b/i, next: 'cost_detail' },
  { re: /\b(data|analyt|insight|report)\b/i, next: 'data_detail' },
  { re: /\b(operat|manual|slow|workflow|process)\b/i, next: 'ops_detail' },
  { re: /\b(hire|hiring|job|role|recruit|salary)\b/i, next: 'hiring' },
];

const PRICING_TEXT =
  'My typical engagement packages:\n\n💼 MVP Build: From $3,000 (30–60 days)\n🔄 Monthly Retainer: From $2,000/mo\n🔍 Technical Consult: $75/hr\n☎️ Discovery Call: Free!\n\nWant to lock in a slot?\n\n1️⃣ Book a free call\n2️⃣ Keep chatting here';

module.exports = { FLOW, KEYWORD_ROUTES, PRICING_TEXT, MEET, EMAIL };
