import express from 'express';
import dotenv from 'dotenv';
import tencentcloud from 'tencentcloud-sdk-nodejs';

dotenv.config();

const {
  TENCENT_SECRET_ID,
  TENCENT_SECRET_KEY,
  TENCENT_REGION = 'ap-guangzhou',
  TENCENT_VMS_TEMPLATE_ID,
  TENCENT_CALLER_NUMBER = '',
  PORT = 3110,
} = process.env;

for (const key of ['TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY', 'TENCENT_VMS_TEMPLATE_ID']) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
}

const { vms } = tencentcloud;
const VmsClient = vms.v20200902.Client;

const client = new VmsClient({
  credential: {
    secretId: TENCENT_SECRET_ID,
    secretKey: TENCENT_SECRET_KEY,
  },
  region: TENCENT_REGION,
  profile: {
    httpProfile: {
      endpoint: 'vms.tencentcloudapi.com',
    },
  },
});

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'tencentcloud-voice-call', region: TENCENT_REGION });
});

app.post('/call', async (req, res) => {
  try {
    const {
      to,
      templateParamSet = [],
      sessionContext = `openclaw-${Date.now()}`,
      playTimes = 2,
    } = req.body || {};

    if (!to) {
      return res.status(400).json({ ok: false, error: 'to is required, e.g. +8618502825799' });
    }

    const params = {
      CalledNumber: to,
      TtsCode: TENCENT_VMS_TEMPLATE_ID,
      VoiceSdkAppid: '',
      PlayTimes: Math.max(1, Math.min(Number(playTimes) || 2, 3)),
      SessionContext: sessionContext,
      TemplateParamSet: templateParamSet,
    };

    if (TENCENT_CALLER_NUMBER) params.Caller = TENCENT_CALLER_NUMBER;

    const result = await client.SendTtsVoice(params);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
      requestId: err?.requestId,
      tip: '请确认：语音通知服务已开通、模板已审核、账号有语音余额、模板参数数量匹配。',
    });
  }
});

app.listen(PORT, () => {
  console.log(`tencent cloud voice service listening on :${PORT}`);
});
