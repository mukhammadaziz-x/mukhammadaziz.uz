/*
 * Contact form → Telegram.
 * POST /api/contact with JSON { name, email, message, "bot-field" }.
 * The bot token never reaches the browser: it lives only in Netlify environment variables
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHAT_ID    — your chat id (where messages arrive)
 */

const LIMITS = { name: 100, email: 200, message: 3500 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  // Only accept submissions from this site's own pages.
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return json(403, { ok: false, error: 'Forbidden' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('contact: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set');
    return json(500, { ok: false, error: 'Not configured' });
  }

  let data;
  try {
    data = await req.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid request' });
  }

  // Honeypot: bots fill the hidden field. Pretend success so they don't retry.
  if (String(data['bot-field'] ?? '').trim()) return json(200, { ok: true });

  const name = String(data.name ?? '').trim();
  const email = String(data.email ?? '').trim();
  const message = String(data.message ?? '').trim();
  if (!name || !email || !message) return json(400, { ok: false, error: 'Please fill in all fields.' });
  if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: 'Please enter a valid email.' });
  if (name.length > LIMITS.name || email.length > LIMITS.email || message.length > LIMITS.message) {
    return json(400, { ok: false, error: 'The message is too long.' });
  }

  // Plain text (no parse_mode), so nothing the visitor types can inject formatting or links.
  const text = `📬 New message from mukhammadaziz.uz\n\n👤 Name: ${name}\n✉️ Email: ${email}\n\n💬 ${message}`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const res = await r.json().catch(() => ({}));
    if (!r.ok || !res.ok) {
      console.error('contact: Telegram error', r.status, res.description);
      return json(502, { ok: false, error: 'Could not deliver the message.' });
    }
  } catch (e) {
    console.error('contact: Telegram request failed', e.message);
    return json(502, { ok: false, error: 'Could not deliver the message.' });
  }

  return json(200, { ok: true });
};

export const config = { path: '/api/contact' };
