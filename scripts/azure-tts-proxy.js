#!/usr/bin/env node
const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  port: Number(process.env.PORT || 10000),
  host: process.env.HOST || '0.0.0.0',
  apiKey: process.env.AZURE_TTS_API_KEY || '',
  region: process.env.AZURE_TTS_REGION || 'eastus',
  endpoint: '',
  defaultVoice: process.env.AZURE_TTS_DEFAULT_VOICE || 'en-US-JennyNeural',
  outputFormat: process.env.AZURE_TTS_OUTPUT_FORMAT || 'audio-24khz-96kbitrate-mono-mp3',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'https://gosleep2018.github.io').split(',').map(s => s.trim())
};

CONFIG.endpoint = `https://${CONFIG.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

if (!CONFIG.apiKey) {
  console.error('❌ 缺少 AZURE_TTS_API_KEY 环境变量');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const origin = req.headers.origin || '';
  const allowAll = CONFIG.allowedOrigins.includes('*');
  
  if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && CONFIG.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'azure-tts-proxy' }));
    return;
  }
  
  if (parsedUrl.pathname === '/tts' && req.method === 'GET') {
    const { text, voice } = parsedUrl.query;
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '缺少text参数' }));
      return;
    }
    
    try {
      console.log(`🔊 TTS请求: "${text.substring(0, 50)}..."`);
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice || CONFIG.defaultVoice}">${text}</voice></speak>`;
      
      const options = {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': CONFIG.apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': CONFIG.outputFormat,
          'User-Agent': 'OpenClaw-TTS-Proxy'
        }
      };
      
      const reqAzure = https.request(CONFIG.endpoint, options, (resAzure) => {
        if (resAzure.statusCode !== 200) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Azure API错误: ${resAzure.statusCode}` }));
          return;
        }
        
        const chunks = [];
        resAzure.on('data', (chunk) => chunks.push(chunk));
        resAzure.on('end', () => {
          const audioData = Buffer.concat(chunks);
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioData.length
          });
          res.end(audioData);
        });
      });
      
      reqAzure.on('error', (err) => {
        console.error('Azure请求失败:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'TTS合成失败', details: err.message }));
      });
      
      reqAzure.write(ssml);
      reqAzure.end();
      
    } catch (error) {
      console.error('TTS处理失败:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'TTS合成失败', details: error.message }));
    }
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: '未找到端点' }));
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`🎧 Azure TTS代理服务运行中`);
  console.log(`📡 地址: ${CONFIG.host}:${CONFIG.port}`);
  console.log(`🗣️  默认语音: ${CONFIG.defaultVoice}`);
  console.log(`🌐 健康检查: http://${CONFIG.host}:${CONFIG.port}/health`);
  console.log(`🔊 TTS端点: http://${CONFIG.host}:${CONFIG.port}/tts?text=Hello`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭TTS代理服务...');
  server.close(() => {
    console.log('✅ 服务已关闭');
    process.exit(0);
  });
});
