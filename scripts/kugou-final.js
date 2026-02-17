#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');

const CHART_URL = 'https://www.kugou.com/yy/rank/home/1-8888.html';
const DATA_DIR = path.join(__dirname, '..', 'data', 'kugou-charts');
const TODAY = new Date().toISOString().split('T')[0];
const DATA_FILE = path.join(DATA_DIR, `${TODAY}.json`);

async function fetchRealChart() {
  console.log(`正在启动浏览器访问: ${CHART_URL}`);
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('加载页面中...');
    await page.goto(CHART_URL, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });

    // 等待加载
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 方法1：直接执行JavaScript提取页面数据
    const songs = await page.evaluate(() => {
      const songs = [];
      
      // 酷狗榜单的实际DOM结构
      // 每个歌曲项通常有 data-index 属性
      const songItems = document.querySelectorAll('[data-index]');
      
      songItems.forEach((item, index) => {
        const rank = index + 1;
        
        // 尝试提取歌曲信息
        let title = '';
        let singer = '';
        let url = '';
        
        // 查找歌曲名链接
        const links = item.querySelectorAll('a');
        for (const link of links) {
          const text = link.textContent?.trim() || '';
          if (text && text.length > 1 && !text.includes('http') && !text.includes('www')) {
            title = text;
            url = link.href || '';
            break;
          }
        }
        
        // 如果没有找到，尝试从整个文本中提取
        if (!title) {
          const fullText = item.textContent || '';
          const lines = fullText.split('\n').filter(line => line.trim().length > 1);
          if (lines.length > 0) {
            title = lines[0].trim().substring(0, 50);
          }
        }
        
        // 尝试提取歌手（通常包含"-"分隔符）
        const fullText = item.textContent || '';
        const dashIndex = fullText.indexOf('-');
        if (dashIndex > -1 && dashIndex < fullText.length - 1) {
          singer = fullText.substring(dashIndex + 1).trim().split('\n')[0].substring(0, 30);
        }
        
        // 清理数据
        title = title.replace(/\s+/g, ' ').trim();
        singer = singer.replace(/\s+/g, ' ').trim();
        
        if (title && title.length > 1) {
          songs.push({
            rank,
            title,
            singer: singer || '未知歌手',
            duration: '--:--',
            url
          });
        }
      });
      
      return songs.slice(0, 20);
    });

    console.log(`方法1获取到 ${songs.length} 首歌曲`);
    
    // 如果方法1失败，尝试方法2：模拟滚动并截图分析
    if (songs.length < 5) {
      console.log('方法1数据不足，尝试方法2...');
      
      // 截图保存用于调试
      await page.screenshot({ path: '/tmp/kugou-chart-debug.png' });
      console.log('页面截图已保存到 /tmp/kugou-chart-debug.png');
      
      // 获取页面所有文本
      const pageText = await page.evaluate(() => {
        return document.body.innerText;
      });
      
      // 分析文本，提取可能的歌曲信息
      const lines = pageText.split('\n')
        .map(line => line.trim())
        .filter(line => 
          line.length > 2 && 
          line.length < 100 &&
          !line.includes('酷狗') &&
          !line.includes('Copyright') &&
          !line.includes('腾讯音乐') &&
          !line.includes('商务合作') &&
          !line.includes('VIP会员')
        );
      
      const extractedSongs = lines.slice(0, 20).map((line, index) => ({
        rank: index + 1,
        title: line.substring(0, 40),
        singer: '未知歌手',
        duration: '--:--',
        url: ''
      }));
      
      console.log(`方法2提取到 ${extractedSongs.length} 条数据`);
      return extractedSongs;
    }
    
    return songs;
  } finally {
    await browser.close();
  }
}

async function loadPreviousData() {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
    if (jsonFiles.length < 1) return null;

    const prevFile = path.join(DATA_DIR, jsonFiles[0]);
    const content = await fs.readFile(prevFile, 'utf8');
    const data = JSON.parse(content);
    return data.songs || null;
  } catch (err) {
    console.log('无历史数据:', err.message);
    return null;
  }
}

function compareChanges(current, previous) {
  if (!previous) return { newEntries: [], moved: [], unchanged: [] };

  const prevMap = new Map(previous.map(s => [s.title + s.singer, s.rank]));
  const currentMap = new Map(current.map(s => [s.title + s.singer, s.rank]));

  const newEntries = current.filter(s => !prevMap.has(s.title + s.singer));
  const moved = current.filter(s => {
    const prevRank = prevMap.get(s.title + s.singer);
    return prevRank && prevRank !== s.rank;
  }).map(s => ({
    ...s,
    previousRank: prevMap.get(s.title + s.singer),
    change: prevMap.get(s.title + s.singer) - s.rank,
  }));

  const unchanged = current.filter(s => {
    const prevRank = prevMap.get(s.title + s.singer);
    return prevRank && prevRank === s.rank;
  });

  return { newEntries, moved, unchanged };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  console.log('开始真实抓取酷狗榜单...');
  const current = await fetchRealChart();
  
  if (current.length === 0) {
    console.log('⚠️  未能获取到歌曲数据，使用模拟数据');
    const mockSongs = [
      { rank: 1, title: '孤勇者', singer: '陈奕迅', duration: '03:45' },
      { rank: 2, title: '光年之外', singer: 'G.E.M.邓紫棋', duration: '03:55' },
      { rank: 3, title: '起风了', singer: '买辣椒也用券', duration: '04:12' },
      { rank: 4, title: '星辰大海', singer: '黄霄雲', duration: '03:48' },
      { rank: 5, title: '少年', singer: '梦然', duration: '03:55' },
      { rank: 6, title: '错位时空', singer: '艾辰', duration: '04:02' },
      { rank: 7, title: '漠河舞厅', singer: '柳爽', duration: '05:34' },
      { rank: 8, title: '如愿', singer: '王菲', duration: '04:18' },
      { rank: 9, title: '这世界那么多人', singer: '莫文蔚', duration: '04:45' },
      { rank: 10, title: '海底', singer: '一支榴莲', duration: '03:15' },
    ];
    const previous = await loadPreviousData();
    const changes = compareChanges(mockSongs, previous);
    
    await fs.writeFile(DATA_FILE, JSON.stringify({
      date: TODAY,
      timestamp: new Date().toISOString(),
      songs: mockSongs,
      changes,
      note: '真实抓取失败，使用模拟数据'
    }, null, 2));

    console.log(`\n=== 酷狗榜单报告 (${TODAY}) [模拟数据] ===`);
    console.log(`总计: ${mockSongs.length} 首歌曲`);
    mockSongs.forEach(s => console.log(`  ${s.rank}. ${s.title} - ${s.singer}`));
    console.log(`\n数据已保存至: ${DATA_FILE}`);
    return;
  }

  const previous = await loadPreviousData();
  const changes = compareChanges(current, previous);

  await fs.writeFile(DATA_FILE, JSON.stringify({
    date: TODAY,
    timestamp: new Date().toISOString(),
    songs: current,
    changes,
    note: '真实抓取数据'
  }, null, 2));

  console.log(`\n=== 酷狗TOP500榜单变化报告 (${TODAY}) ===`);
  console.log(`总计: ${current.length} 首歌曲`);

  if (previous) {
    console.log(`\n📈 新上榜 (${changes.newEntries.length}):`);
    changes.newEntries.slice(0, 5).forEach(s => console.log(`  ${s.rank}. ${s.title} - ${s.singer}`));
    if (changes.newEntries.length > 5) console.log(`  ... 还有 ${changes.newEntries.length - 5} 首`);

    console.log(`\n🔄 排名变动 (${changes.moved.length}):`);
    changes.moved.forEach(s => {
      const dir = s.change > 0 ? '↑' : '↓';
      console.log(`  ${s.previousRank} → ${s.rank} ${dir}${Math.abs(s.change)}位: ${s.title} - ${s.singer}`);
    });

    console.log(`\n⏸️ 排名不变 (${changes.unchanged.length}):`);
    changes.unchanged.slice(0, 3).forEach(s => console.log(`  ${s.rank}. ${s.title} - ${s.singer}`));
    if (changes.unchanged.length > 3) console.log(`  ... 还有 ${changes.unchanged.length - 3} 首`);
  } else {
    console.log('\n(首次运行，无历史数据对比)');
    current.slice(0, 10).forEach(s => console.log(`  ${s.rank}. ${s.title} - ${s.singer}`));
  }

  console.log(`\n数据已保存至: ${DATA_FILE}`);
}

main().catch(err => {
  console.error('抓取失败:', err);
  process.exit(1);
});
