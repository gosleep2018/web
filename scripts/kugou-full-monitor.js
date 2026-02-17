#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');

const CHART_URL = 'https://www.kugou.com/yy/rank/home/1-8888.html';
const DATA_DIR = path.join(__dirname, '..', 'data', 'kugou-charts');
const TODAY = new Date().toISOString().split('T')[0];
const DATA_FILE = path.join(DATA_DIR, `${TODAY}.json`);
const REPORT_FILE = path.join(DATA_DIR, `report-${TODAY}.md`);

// 曲风关键词映射
const GENRE_KEYWORDS = {
  '流行': ['流行', 'pop', 'POP', 'Pop'],
  '嘻哈/说唱': ['嘻哈', '说唱', 'rap', 'Rap', 'HIPHOP', 'hiphop', 'HipHop', 'trap', 'Trap'],
  '电子': ['电子', 'EDM', '电音', 'DJ', 'House', 'Trance', 'Dubstep', 'Techno'],
  '摇滚': ['摇滚', 'Rock', 'rock', '金属', '朋克', 'Punk'],
  '民谣': ['民谣', 'folk', 'Folk', '民歌'],
  'R&B': ['R&B', '节奏布鲁斯', 'Soul', 'soul'],
  '古风': ['古风', '国风', '中国风', '戏曲', '民乐'],
  '影视原声': ['OST', '原声', '影视', '电视剧', '电影', '动漫'],
  '二次元': ['二次元', 'ACG', '动漫', '游戏', '虚拟歌手'],
  '独立': ['独立', 'indie', 'Indie', '小众'],
  '情歌': ['情歌', '爱情', '恋爱', '分手', '思念'],
  '励志': ['励志', '奋斗', '梦想', '青春', '少年'],
  '网络热歌': ['网络', '热歌', '抖音', '快手', '短视频'],
  '翻唱': ['cover', 'Cover', '翻唱', '重制'],
  '合唱': ['合唱', '合唱团', '对唱', 'feat.', 'Feat.', '&'],
  'DJ混音': ['DJ', '混音', 'remix', 'Remix', '版', '改编'],
  '纯音乐': ['纯音乐', '轻音乐', '钢琴', '吉他', '器乐']
};

function detectGenre(title, singer) {
  const text = (title + ' ' + singer).toLowerCase();
  const genres = [];
  
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        genres.push(genre);
        break;
      }
    }
  }
  
  if (genres.length === 0) {
    if (title.includes('(') && title.includes('版)')) {
      genres.push('DJ混音');
    } else if (singer.includes('DJ')) {
      genres.push('电子');
    } else if (title.includes('feat.') || title.includes('&')) {
      genres.push('合唱');
    } else {
      genres.push('流行');
    }
  }
  
  return [...new Set(genres)];
}

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

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 改进的提取逻辑：直接获取页面文本并解析
    const songs = await page.evaluate(() => {
      const songs = [];
      
      // 获取所有文本节点
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim().length > 10) {
          textNodes.push(node.textContent.trim());
        }
      }
      
      // 分析文本，提取歌曲信息
      let currentRank = 1;
      textNodes.forEach(text => {
        // 匹配歌曲模式：数字 + 歌曲名 + 歌手
        const lines = text.split('\n');
        lines.forEach(line => {
          line = line.trim();
          if (line.length < 5 || line.length > 100) return;
          
          // 跳过明显的非歌曲文本
          if (line.includes('播放') || line.includes('下载') || line.includes('分享') || 
              line.includes('榜单') || line.includes('热门') || line.includes('全部')) {
            return;
          }
          
          // 尝试提取歌曲名和歌手
          let title = line;
          let singer = '未知歌手';
          
          // 如果有"-"分隔符
          const dashIndex = line.lastIndexOf('-');
          if (dashIndex > 0 && dashIndex < line.length - 1) {
            title = line.substring(0, dashIndex).trim();
            singer = line.substring(dashIndex + 1).trim();
          }
          
          // 如果有"("分隔符
          const parenIndex = line.indexOf('(');
          if (parenIndex > 0) {
            title = line.substring(0, parenIndex).trim();
          }
          
          if (title && title.length > 1) {
            songs.push({
              rank: currentRank++,
              title,
              singer,
              duration: '--:--',
              url: ''
            });
          }
        });
      });
      
      return songs.slice(0, 20);
    });

    console.log(`获取到 ${songs.length} 首歌曲`);
    return songs;
  } finally {
    await browser.close();
  }
}

async function loadPreviousData() {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('report')).sort().reverse();
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

function analyzeNewEntries(newEntries) {
  const realSongs = newEntries.filter(song => {
    const title = song.title.toLowerCase();
    const invalidKeywords = ['播放', '下载', '分享', '榜单', '热门', '特色', '全球', '全部'];
    return !invalidKeywords.some(keyword => title.includes(keyword));
  });
  
  const analysis = {
    total: newEntries.length,
    realSongs: realSongs.length,
    byGenre: {},
    bySinger: {},
    commonThemes: [],
    notableFeatures: []
  };
  
  realSongs.forEach(song => {
    const genres = detectGenre(song.title, song.singer);
    genres.forEach(genre => {
      analysis.byGenre[genre] = (analysis.byGenre[genre] || 0) + 1;
    });
    
    if (song.singer && song.singer !== '未知歌手') {
      analysis.bySinger[song.singer] = (analysis.bySinger[song.singer] || 0) + 1;
    }
  });
  
  return analysis;
}

function analyzeChartTrends(songs) {
  const realSongs = songs.filter(song => {
    const title = song.title.toLowerCase();
    const invalidKeywords = ['播放', '下载', '分享', '榜单', '热门', '特色', '全球', '全部'];
    return !invalidKeywords.some(keyword => title.includes(keyword));
  });
  
  const analysis = {
    total: songs.length,
    realSongs: realSongs.length,
    genreDistribution: {},
    singerDiversity: 0,
    avgTitleLength: 0,
    topKeywords: []
  };
  
  // 曲风分布
  realSongs.forEach(song => {
    const genres = detectGenre(song.title, song.singer);
    genres.forEach(genre => {
      analysis.genreDistribution[genre] = (analysis.genreDistribution[genre] || 0) + 1;
    });
  });
  
  // 歌手多样性
  const singers = new Set(realSongs.map(s => s.singer).filter(s => s && s !== '未知歌手'));
  analysis.singerDiversity = singers.size;
  
  // 标题长度
  analysis.avgTitleLength = realSongs.reduce((sum, song) => sum + song.title.length, 0) / realSongs.length || 0;
  
  // 热门关键词
  const wordFrequency = {};
  realSongs.forEach(song => {
    const words = song.title.split(/[^\u4e00-\u9fa5a-zA-Z0-9]+/);
    words.forEach(word => {
      if (word.length > 1) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
  });
  
  analysis.topKeywords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count, percentage: ((count / realSongs.length) * 100).toFixed(1) }));
  
  return analysis;
}

async function generateReport(current, changes, newEntryAnalysis, trendAnalysis) {
  const report = `# 酷狗TOP500榜单分析报告 (${TODAY})

## 📊 数据概览
- **抓取时间**: ${new Date().toISOString()}
- **总歌曲数**: ${current.length} 首
- **有效歌曲**: ${trendAnalysis.realSongs} 首
- **新上榜歌曲**: ${changes.newEntries.length} 首
- **有效新歌**: ${newEntryAnalysis.realSongs} 首

## 🆕 新上榜歌曲分析

### 曲风分布
${Object.entries(newEntryAnalysis.byGenre)
  .sort((a, b) => b[1] - a[1])
  .map(([genre, count]) => `- **${genre}**: ${count}首 (${((count / newEntryAnalysis.realSongs) * 100).toFixed(1)}%)`)
  .join('\n')}

### 热门歌手
${Object.entries(newEntryAnalysis.bySinger)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([singer, count]) => `- **${singer}**: ${count}首`)
  .join('\n')}

### 新歌亮点
${changes.newEntries
  .filter(song => {
    const title = song.title.toLowerCase();
    const invalidKeywords = ['播放', '下载', '分享', '榜单', '热门', '特色', '全球', '全部'];
    return !invalidKeywords.some(keyword => title.includes(keyword));
  })
  .slice(0, 10)
  .map(song => {
    const genres = detectGenre(song.title, song.singer);
    return `- **${song.rank}**. ${song.title} - ${song.singer} [${genres.join('/')}]`;
  })
  .join('\n')}

## 📈 榜单整体趋势

### 曲风分布
${Object.entries(trendAnalysis.genreDistribution)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([genre, count]) => `- **${genre}**: ${count}首 (${((count / trendAnalysis.realSongs) * 100).toFixed(1)}%)`)
  .join('\n')}

### 关键指标
- **歌手多样性**: ${trendAnalysis.singerDiversity} 位不同歌手
- **平均标题长度**: ${trendAnalysis.avgTitleLength.toFixed(1)} 字符
- **热门关键词**: ${trendAnalysis.topKeywords.slice(0, 5).map(k => `${k.word}(${k.count}次)`).join(', ')}

### 潜力歌曲（排名10-30）
${current
  .filter(song => {
    const title = song.title.toLowerCase();
    const invalidKeywords = ['播放', '下载', '分享', '榜单', '热门', '特色', '全球', '全部'];
    return !invalidKeywords.some(keyword => title.includes(keyword)) && song.rank > 10 && song.rank <= 30;
  })
  .slice(0, 5)
  .map(song => {
    const genres = detectGenre(song.title, song.singer);
    return `- **${song.rank}**. ${song.title} - ${song.singer} [${genres.join('/')}]`;
  })
  .join('\n')}

## 🔄 排名变动
${changes.moved.length > 0 ? changes.moved.map(song => {
  const dir = song.change > 0 ? '↑' : '↓';
  return `- **${song.previousRank} → ${song.rank}** ${dir}${Math.abs(song.change)}位: ${song.title} - ${song.singer}`;
}).join('\n') : '今日无显著排名变动'}

## 💡 趋势洞察
${generateInsights(newEntryAnalysis, trendAnalysis)}

---
*报告生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*
*数据来源: 酷狗音乐TOP500榜单*
`;

  await fs.writeFile(REPORT_FILE, report);
  console.log(`报告已保存至: ${REPORT_FILE}`);
}

function generateInsights(newEntryAnalysis, trendAnalysis) {
  const insights = [];
  
  // 曲风趋势
  const topGenres = Object.entries(newEntryAnalysis.byGenre).sort((a, b) => b[1] - a[1]);
  if (topGenres.length > 0) {
    insights.push(`1. **${topGenres[0][0]}** 是新上榜歌曲的主要曲风，占新歌的 ${((topGenres[0][1] / newEntryAnalysis.realSongs) * 100).toFixed(1)}%`);
  }
  
  // 歌手集中度
  const topSingers = Object.entries(newEntryAnalysis.bySinger).sort((a, b) => b[1] - a[1]);
  if (topSingers.length > 0 && topSingers[0][1] > 1) {
    insights.push(`2. **${topSingers[0][0]}** 表现突出，有 ${topSingers[0][1]} 首新歌上榜`);
  }
  
  // 多样性分析
  if (trendAnalysis.singerDiversity < 10) {
    insights.push(`3. 歌手集中度较高，仅 ${trendAnalysis.singerDiversity} 位歌手占据榜单`);
  } else {
    insights.push(`3. 歌手多样性良好，有 ${trendAnalysis.singerDiversity} 位不同歌手`);
  }
  
  // 关键词趋势
  if (trendAnalysis.topKeywords.length > 0) {
    const topKeyword = trendAnalysis.topKeywords[0];
    insights.push(`4. 热门关键词 **"${topKeyword.word}"** 出现 ${topKeyword.count} 次，占 ${topKeyword.percentage}%`);
  }
  
  return insights.join('\n');
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  console.log('开始酷狗榜单全面监控...');
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
    const newEntryAnalysis = analyzeNewEntries(changes.newEntries);
    const trendAnalysis = analyzeChartTrends(mockSongs);
    
    await fs.writeFile(DATA_FILE, JSON.stringify({
      date: TODAY,
      timestamp: new Date().toISOString(),
      songs: mockSongs,
      changes,
      note: '真实抓取失败，使用模拟数据'
    }, null, 2));
    
    await generateReport(mockSongs, changes, newEntryAnalysis, trendAnalysis);
    
    console.log(`\n=== 酷狗榜单报告 (${TODAY}) [模拟数据] ===`);
    console.log(`数据已保存至: ${DATA_FILE}`);
    console.log(`报告已生成: ${REPORT_FILE}`);
    return;
  }

  const previous = await loadPreviousData();
  const changes = compareChanges(current, previous);
  const newEntryAnalysis = analyzeNewEntries(changes.newEntries);
  const trendAnalysis = analyzeChartTrends(current);

  await fs.writeFile(DATA_FILE, JSON.stringify({
    date: TODAY,
    timestamp: new Date().toISOString(),
    songs: current,
    changes,
    note: '真实抓取数据'
  }, null, 2));

  await generateReport(current, changes, newEntryAnalysis, trendAnalysis);

  console.log(`\n=== 酷狗TOP500榜单全面监控完成 (${TODAY}) ===`);
  console.log(`数据已保存至: ${DATA_FILE}`);
  console.log(`分析报告: ${REPORT_FILE}`);
  
  // 控制台输出摘要
  console.log('\n📋 报告摘要:');
  console.log(`- 有效歌曲: ${trendAnalysis.realSongs} 首`);
  console.log(`- 新上榜: ${changes.newEntries.length} 首 (有效: ${newEntryAnalysis.realSongs} 首)`);
  
  const topGenre = Object.entries(newEntryAnalysis.byGenre).sort((a, b) => b[1] - a[1])[0];
  if (topGenre) {
    console.log(`- 主要曲风: ${topGenre[0]} (${topGenre[1]}首)`);
  }
  
  const topSinger = Object.entries(newEntryAnalysis.bySinger).sort((a, b) => b[1] - a[1])[0];
  if (topSinger) {
    console.log(`- 热门歌手: ${topSinger[0]} (${topSinger[1]}首)`);
  }
}

main().catch(err => {
  console.error('监控失败:', err);
  process.exit(1);
});