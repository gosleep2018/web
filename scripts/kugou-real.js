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

    // 等待榜单内容加载
    console.log('等待榜单内容...');
    try {
      await page.waitForSelector('.pc_temp_songlist', { timeout: 15000 });
    } catch (err) {
      console.log('未找到 .pc_temp_songlist，尝试其他选择器...');
      // 尝试截图看看页面结构
      await page.screenshot({ path: '/tmp/kugou-debug.png' });
      console.log('已保存截图到 /tmp/kugou-debug.png');
    }

    const songs = await page.evaluate(() => {
      // 尝试多种选择器
      const selectors = [
        '.pc_temp_songlist ul li',
        '.rank-list li',
        '.song-list li',
        '[class*="song"]',
        'li'
      ];

      let items = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 10) {
          items = Array.from(found);
          console.log(`使用选择器 "${selector}" 找到 ${items.length} 个元素`);
          break;
        }
      }

      if (items.length === 0) {
        // 如果还是找不到，返回页面HTML结构信息
        console.log('页面结构:', document.body.innerHTML.substring(0, 500));
        return [];
      }

      return items.slice(0, 20).map((li, index) => {
        const rank = index + 1;
        
        // 尝试多种方式提取歌曲信息
        let title = '';
        let singer = '';
        let duration = '';
        let url = '';

        // 查找歌曲名
        const titleSelectors = [
          'a[href*="song"]',
          '.song-name',
          '.name',
          'a'
        ];
        
        for (const sel of titleSelectors) {
          const el = li.querySelector(sel);
          if (el && el.textContent && el.textContent.trim()) {
            title = el.textContent.trim();
            url = el.href || '';
            break;
          }
        }

        // 查找歌手
        const singerSelectors = [
          '.singer',
          '.artist',
          'span'
        ];
        
        for (const sel of singerSelectors) {
          const el = li.querySelector(sel);
          if (el && el.textContent && el.textContent.trim() && el.textContent !== title) {
            singer = el.textContent.trim().replace(/^-/, '');
            break;
          }
        }

        // 查找时长
        const durationSelectors = [
          '.duration',
          '.time',
          '.length'
        ];
        
        for (const sel of durationSelectors) {
          const el = li.querySelector(sel);
          if (el && el.textContent) {
            duration = el.textContent.trim();
            break;
          }
        }

        return {
          rank,
          title: title || `歌曲${rank}`,
          singer: singer || '未知歌手',
          duration: duration || '--:--',
          url: url || ''
        };
      }).filter(s => s.title);
    });

    console.log(`成功获取 ${songs.length} 首歌曲`);
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
    console.log('⚠️  未能获取到歌曲数据，使用模拟数据作为后备');
    // 使用模拟数据
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
    changes.newEntries.forEach(s => console.log(`  ${s.rank}. ${s.title} - ${s.singer}`));

    console.log(`\n🔄 排名变动 (${changes.moved.length}):`);
    changes.moved.forEach(s => {
      const dir = s.change > 0 ? '↑' : '↓';
      console.log(`  ${s.previousRank} → ${s.rank} ${dir}${Math.abs(s.change)}位: ${s.title} - ${s.singer}`);
    });

    console.log(`\n⏸️ 排名不变 (${changes.unchanged.length}):`);
    changes.unchanged.slice(0, 5).forEach(s => console.log(`  ${s.rank}. ${s.title} - ${s.singer}`));
    if (changes.unchanged.length > 5) console.log(`  ... 还有 ${changes.unchanged.length - 5} 首`);
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
