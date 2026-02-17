#!/usr/bin/env node
const https = require('https');
const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'kugou-charts');
const TODAY = new Date().toISOString().split('T')[0];
const DATA_FILE = path.join(DATA_DIR, `${TODAY}.json`);

// 模拟榜单数据（实际应该从API获取，这里先模拟）
async function fetchMockChart() {
  console.log('模拟获取酷狗榜单数据...');
  
  // 模拟TOP20歌曲
  const songs = [
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
    { rank: 11, title: '白月光与朱砂痣', singer: '大籽', duration: '03:24' },
    { rank: 12, title: '四季予你', singer: '程响', duration: '04:02' },
    { rank: 13, title: '千千万万', singer: '深海鱼子酱', duration: '03:38' },
    { rank: 14, title: '踏山河', singer: '是七叔呢', duration: '03:15' },
    { rank: 15, title: '云与海', singer: '阿YueYue', duration: '04:12' },
    { rank: 16, title: '执迷不悟', singer: '小乐哥', duration: '03:48' },
    { rank: 17, title: '失控', singer: '井胧', duration: '03:55' },
    { rank: 18, title: '嘉宾', singer: '张远', duration: '04:22' },
    { rank: 19, title: '奔赴星空', singer: '尹昔眠', duration: '03:28' },
    { rank: 20, title: '时光背面的我', singer: '刘至佳/韩瞳', duration: '03:15' },
  ];

  // 随机模拟一些变化
  const randomChange = Math.random() > 0.5;
  if (randomChange) {
    // 模拟新歌上榜
    songs[2] = { rank: 3, title: '新歌测试', singer: '测试歌手', duration: '03:30' };
    // 模拟排名变动
    [songs[0], songs[1]] = [songs[1], songs[0]];
    songs[0].rank = 1;
    songs[1].rank = 2;
  }

  return songs;
}

async function loadPreviousData() {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
    if (jsonFiles.length < 1) return null;

    const prevFile = path.join(DATA_DIR, jsonFiles[0]); // latest
    const content = await fs.readFile(prevFile, 'utf8');
    return JSON.parse(content).songs;
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

  const current = await fetchMockChart();
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
  console.error('错误:', err);
  process.exit(1);
});
