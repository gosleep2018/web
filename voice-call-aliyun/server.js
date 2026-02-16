require('dotenv').config();
const express = require('express');
const Core = require('@alicloud/pop-core');

const app = express();
app.use(express.json());

const required = [
  'ALIBABA_ACCESS_KEY_ID',
  'ALIBABA_ACCESS_KEY_SECRET',
  'ALIYUN_CALLED_SHOW_NUMBER',
  'ALIYUN_TTS_CODE',
];

function checkEnv() {
  const miss = required.filter((k) => !process.env[k]);
  if (miss.length) throw new Error(`Missing env: ${miss.join(', ')}`);
}

function makeClient() {
  checkEnv();
  return new Core({
    accessKeyId: process.env.ALIBABA_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIBABA_ACCESS_KEY_SECRET,
    endpoint: process.env.ALIYUN_ENDPOINT || 'https://dyvmsapi.aliyuncs.com',
    apiVersion: '2017-05-25',
  });
}

async function singleCallByTts({ to, text, playTimes = 2, outId = '' }) {
  const client = makeClient();
  const params = {
    RegionId: process.env.ALIYUN_REGION_ID || 'cn-hangzhou',
    CalledShowNumber: process.env.ALIYUN_CALLED_SHOW_NUMBER,
    CalledNumber: to,
    TtsCode: process.env.ALIYUN_TTS_CODE,
    TtsParam: JSON.stringify({ text }),
    PlayTimes: String(playTimes),
    OutId: outId,
  };

  const requestOption = { method: 'POST' };
  const res = await client.request('SingleCallByTts', params, requestOption);
  return res;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'aliyun-voice-call', time: new Date().toISOString() });
});

app.post('/call', async (req, res) => {
  try {
    const { to, text, playTimes, outId } = req.body || {};
    if (!to || !text) {
      return res.status(400).json({ ok: false, error: 'to and text are required' });
    }
    const result = await singleCallByTts({ to, text, playTimes, outId });
    return res.json({ ok: true, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Optional callback endpoint for Alibaba Cloud call status pushes (if enabled)
app.post('/callback/aliyun', (req, res) => {
  console.log('[aliyun-callback]', JSON.stringify(req.body || {}, null, 2));
  res.status(200).send('OK');
});

const port = Number(process.env.PORT || 3099);
app.listen(port, () => {
  console.log(`aliyun voice call service listening on :${port}`);
});
