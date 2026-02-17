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

    // 等待页面完全加载
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 直接执行更精确的提取逻辑
    const songs = await page.evaluate(() => {
      // 酷狗榜单的实际结构：每个歌曲项有 class="pc_temp_songname"
      const songElements = document.querySelectorAll('.pc_temp_songname');
      const songs = [];
      
      songElements.forEach((el, index) => {
        const rank = index + 1;
        
        // 提取歌曲名（通常是第一个a标签）
        const titleLink = el.querySelector('a');
        let title = '';
        let url = '';
        
        if (titleLink) {
          title = titleLink.textContent?.trim() || '';
          url = titleLink.href || '';
        }
        
        // 提取歌手（通常是span标签，在a标签后面）
        let singer = '';
        const spans = el.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          if (text && text !== title && !text.includes('·') && text.length < 20) {
            singer = text.replace(/^-/, '').trim();
            break;
          }
        }
        
        // 如果没有找到歌手，尝试其他方式
        if (!singer) {
          const parentText = el.textContent || '';
          const parts = parentText.split('-');
          if (parts.length > 1) {
            singer = parts[parts.length - 1].trim();
          }
        }
        
        // 清理数据
        title = title.replace(/\s+/g, ' ').trim();
        singer = singer.replace(/\s+/g, ' ').trim();
        
        if (title) {
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

    console.log(`成功获取 ${songs.length} 首歌曲`);
    
    // 如果还是没数据，尝试备用方案
    if (songs.length === 0) {
      console.log('尝试备用提取方案...');
      const backupSongs = await page.evaluate(() => {
        // 尝试查找所有包含歌曲信息的元素
        const allText = document.body.innerText;
        const lines = allText.split('\n').filter(line => 
          line.trim().length > 2 && 
          !line.includes('酷狗') && 
          !line.includes('Copyright') &&
          !line.includes('腾讯音乐')
        );
        
        return lines.slice(0, 20).map((line, index) => ({
          rank: index + 1,
          title: line.trim().substring(0, 30),
          singer: '未知歌手',
          duration: '--:--',
          url: ''
        }));
      });
      
      return backupSongs;
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
