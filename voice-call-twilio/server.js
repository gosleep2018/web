import express from 'express';
import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  PORT = 3100,
} = process.env;

for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'twilio-voice-call', from: TWILIO_FROM_NUMBER });
});

app.post('/call', async (req, res) => {
  try {
    const { to, text, lang = 'zh-CN', voice = 'alice', repeat = 2 } = req.body || {};
    if (!to || !text) {
      return res.status(400).json({ ok: false, error: 'to and text are required' });
    }

    const safeText = String(text).replace(/[<>&"']/g, '');
    const times = Math.max(1, Math.min(Number(repeat) || 1, 5));
    const says = Array.from({ length: times })
      .map(() => `<Say language="${lang}" voice="${voice}">${safeText}</Say>`)
      .join('');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>${says}</Response>`;

    const call = await client.calls.create({
      to,
      from: TWILIO_FROM_NUMBER,
      twiml,
    });

    return res.json({ ok: true, sid: call.sid, status: call.status, to, from: TWILIO_FROM_NUMBER });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`twilio voice call service listening on :${PORT}`);
});
