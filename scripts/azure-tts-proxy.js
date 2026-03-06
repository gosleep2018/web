#!/usr/bin/env node

/**
 * 微软Azure TTS代理服务
 * 保护API Key，提供HTTP接口给网页调用
 */

const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  port: Number(process.env.PORT || 3000),
  apiKey: process.env.AZURE_TTS_API_KEY || '',
  region: process.env.AZURE_TTS_REGION || 'eastus',
  endpoint: '',
  defaultVoice: process.env.AZURE_TTS_DEFAULT_VOICE || 'cy-GB-NiaNeural',
  outputFormat: process.env.AZURE_TTS_OUTPUT_FORMAT || 'audio-24khz-96kbitrate-mono-mp3',
  cacheDir: path.join(__dirname, '..', 'tts-cache'),
  maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7天
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://gosleep2018.github.io').split(',').map(s => s.trim())
};

CONFIG.endpoint = `https://${CONFIG.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

if (!CONFIG.apiKey) {
  console.error('❌ 缺少 AZURE_TTS_API_KEY 环境变量，服务无法启动');
  process.exit(1);
}

// 确保缓存目录存在
if (!fs.existsSync(CONFIG.cacheDir)) {
  fs.mkdirSync(CONFIG.cacheDir, { recursive: true });
}

// 生成缓存文件名
function getCacheKey(text, voice) {
  const hash = crypto.createHash('md5').update(`${text}:${voice}`).digest('hex');
  return `${hash}.mp3`;
}

// 检查缓存
function getFromCache(text, voice) {
  const cacheKey = getCacheKey(text, voice);
  const cachePath = path.join(CONFIG.cacheDir, cacheKey);
  
  if (fs.existsSync(cachePath)) {
    const stats = fs.statSync(cachePath);
    const age = Date.now() - stats.mtimeMs;
    if (age < CONFIG.maxCacheAge) {
      console.log(`🎧 缓存命中: ${text.substring(0, 30)}...`);
      return fs.readFileSync(cachePath);
    }
  }
  return null;
}

// 保存到缓存
function saveToCache(text, voice, audioData) {
  const cacheKey = getCacheKey(text, voice);
  const cachePath = path.join(CONFIG.cacheDir, cacheKey);
  fs.writeFileSync(cachePath, audioData);
  console.log(`💾 缓存保存: ${text.substring(0, 30)}...`);
}

// 调用Azure TTS API
function callAzureTTS(text, voice = CONFIG.defaultVoice) {
  return new Promise((resolve, reject) => {
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}">${text}</voice></speak>`;
    
    const options = {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': CONFIG.apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': CONFIG.outputFormat,
        'User-Agent': 'OpenClaw-TTS-Proxy'
      }
    };
    
    const req = https.request(CONFIG.endpoint, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Azure TTS API错误: ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const audioData = Buffer.concat(chunks);
        saveToCache(text, voice, audioData);
        resolve(audioData);
      });
    });
    
    req.on('error', (err) => {
      console.error('Azure TTS请求失败:', err.message);
      reject(err);
    });
    
    req.write(ssml);
    req.end();
  });
}

// HTTP服务器
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // CORS - 允许 github.io 和 op2020.com 所有子域
  const origin = req.headers.origin || '';
  const allowAll = CONFIG.allowedOrigins.includes('*');
  const isAllowed = allowAll ||
    CONFIG.allowedOrigins.includes(origin) ||
    /https?:\/\/[\w-]+\.github\.io$/.test(origin) ||
    /https?:\/\/[\w-]+\.op2020\.com$/.test(origin) ||
    origin === 'https://gosleep2018.github.io';
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 健康检查
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'azure-tts-proxy' }));
    return;
  }
  
  // TTS端点
  if (parsedUrl.pathname === '/tts' && req.method === 'GET') {
    const { text, voice } = parsedUrl.query;
    
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '缺少text参数' }));
      return;
    }
    
    try {
      console.log(`🔊 请求TTS: "${text.substring(0, 50)}..." (voice: ${voice || CONFIG.defaultVoice})`);
      
      // 检查缓存
      const cachedAudio = getFromCache(text, voice || CONFIG.defaultVoice);
      if (cachedAudio) {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': cachedAudio.length,
          'X-TTS-Cache': 'hit'
        });
        res.end(cachedAudio);
        return;
      }
      
      // 调用Azure API
      const audioData = await callAzureTTS(text, voice || CONFIG.defaultVoice);
      
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioData.length,
        'X-TTS-Cache': 'miss'
      });
      res.end(audioData);
      
    } catch (error) {
      console.error('TTS处理失败:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'TTS合成失败', details: error.message }));
    }
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: '未找到端点' }));
});

// 启动服务器
server.listen(CONFIG.port, () => {
  console.log(`🎧 Azure TTS代理服务运行中`);
  console.log(`📡 端口: ${CONFIG.port}`);
  console.log(`🗣️  默认语音: ${CONFIG.defaultVoice}`);
  console.log(`💾 缓存目录: ${CONFIG.cacheDir}`);
  console.log(`🌐 健康检查: http://localhost:${CONFIG.port}/health`);
  console.log(`🔊 TTS端点: http://localhost:${CONFIG.port}/tts?text=Hello`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭TTS代理服务...');
  server.close(() => {
    console.log('✅ 服务已关闭');
    process.exit(0);
  });
});