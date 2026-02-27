#!/usr/bin/env node
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const CHART_URL = 'https://www.kugou.com/yy/rank/home/1-8888.html';
const DATA_DIR = path.join(process.cwd(), 'data', 'kugou-charts');
const TODAY = new Date().toISOString().split('T')[0];
const DATA_FILE = path.join(DATA_DIR, `${TODAY}.json`);

async function fetchChart() {
  console.log(`Launching browser for ${CHART_URL}`);
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.goto(CHART_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for chart content to load
    await page.waitForSelector('.pc_temp_songlist', { timeout: 10000 });

    const songs = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.pc_temp_songlist ul li'));
      return items.slice(0, 20).map((li, index) => {
        const rank = index + 1;
        const titleEl = li.querySelector('.pc_temp_songname a');
        const singerEl = li.querySelector('.pc_temp_songname span');
        const durationEl = li.querySelector('.pc_temp_time');
        return {
          rank,
          title: titleEl?.textContent?.trim() || '',
          singer: singerEl?.textContent?.replace('-', '').trim() || '',
          duration: durationEl?.textContent?.trim() || '',
          url: titleEl?.href || '',
        };
      }).filter(s => s.title);
    });

    console.log(`Fetched ${songs.length} songs`);
    return songs;
  } finally {
    await browser.close();
  }
}

async function loadPreviousData() {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
    if (jsonFiles.length < 2) return null;

    const prevFile = path.join(DATA_DIR, jsonFiles[1]); // second latest
    const content = await fs.readFile(prevFile, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.log('No previous data found:', err.message);
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
    change: prevMap.get(s.title + s.singer) - s.rank, // positive = up, negative = down
  }));

  const unchanged = current.filter(s => {
    const prevRank = prevMap.get(s.title + s.singer);
    return prevRank && prevRank === s.rank;
  });

  return { newEntries, moved, unchanged };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const current = await fetchChart();
  const previous = await loadPreviousData();
  const changes = compareChanges(current, previous);

  await fs.writeFile(DATA_FILE, JSON.stringify({
    date: TODAY,
    timestamp: new Date().toISOString(),
    songs: current,
    changes,
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
  console.error('Error:', err);
  process.exit(1);
});
