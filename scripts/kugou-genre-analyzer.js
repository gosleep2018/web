#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'kugou-charts');
const TODAY = new Date().toISOString().split('T')[0];

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

// 从歌曲标题和歌手推断曲风
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
  
  // 如果没有匹配到，根据其他特征推断
  if (genres.length === 0) {
    if (title.includes('(') && title.includes('版)')) {
      genres.push('DJ混音');
    } else if (singer.includes('DJ')) {
      genres.push('电子');
    } else if (title.includes('feat.') || title.includes('&')) {
      genres.push('合唱');
    } else {
      genres.push('流行'); // 默认
    }
  }
  
  return [...new Set(genres)]; // 去重
}

// 分析新上榜歌曲的特点
function analyzeNewEntries(newEntries) {
  const analysis = {
    total: newEntries.length,
    byGenre: {},
    bySinger: {},
    commonThemes: [],
    notableFeatures: []
  };
  
  // 过滤掉明显的非歌曲条目
  const realSongs = newEntries.filter(song => {
    const title = song.title.toLowerCase();
    const invalidKeywords = ['播放', '下载', '分享', '榜单', '热门', '特色', '全球', '全部'];
    return !invalidKeywords.some(keyword => title.includes(keyword));
  });
  
  console.log(`\n=== 新上榜歌曲分析 (${TODAY}) ===`);
  console.log(`总计新上榜: ${newEntries.length} 首`);
  console.log(`有效歌曲: ${realSongs.length} 首`);
  
  if (realSongs.length === 0) {
    console.log('⚠️  没有检测到有效的新上榜歌曲');
    return analysis;
  }
  
  // 按曲风统计
  realSongs.forEach(song => {
    const genres = detectGenre(song.title, song.singer);
    genres.forEach(genre => {
      analysis.byGenre[genre] = (analysis.byGenre[genre] || 0) + 1;
    });
    
    // 按歌手统计
    if (song.singer && song.singer !== '未知歌手') {
      analysis.bySinger[song.singer] = (analysis.bySinger[song.singer] || 0) + 1;
    }
  });
  
  // 识别共同主题
  const titles = realSongs.map(s => s.title);
  const commonWords = {};
  titles.forEach(title => {
    const words = title.split(/[^\u4e00-\u9fa5a-zA-Z0-9]+/);
    words.forEach(word => {
      if (word.length > 1) {
        commonWords[word] = (commonWords[word] || 0) + 1;
      }
    });
  });
  
  analysis.commonThemes = Object.entries(commonWords)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => `${word}(${count}次)`);
  
  // 识别显著特征
  realSongs.forEach(song => {
    const title = song.title;
    if (title.includes('(') && title.includes('版)')) {
      analysis.notableFeatures.push('多版本/改编版');
    }
    if (title.includes('feat.') || title.includes('&')) {
      analysis.notableFeatures.push('合作曲');
    }
    if (song.singer.includes('DJ')) {
      analysis.notableFeatures.push('DJ制作');
    }
  });
  
  analysis.notableFeatures = [...new Set(analysis.notableFeatures)];
  
  // 输出分析结果
  console.log('\n📊 曲风分布:');
  Object.entries(analysis.byGenre)
    .sort((a, b) => b[1] - a[1])
    .forEach(([genre, count]) => {
      const percentage = ((count / realSongs.length) * 100).toFixed(1);
      console.log(`  ${genre}: ${count}首 (${percentage}%)`);
    });
  
  console.log('\n🎤 热门歌手:');
  Object.entries(analysis.bySinger)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([singer, count]) => {
      console.log(`  ${singer}: ${count}首`);
    });
  
  if (analysis.commonThemes.length > 0) {
    console.log('\n🎯 共同主题:');
    analysis.commonThemes.forEach(theme => console.log(`  ${theme}`));
  }
  
  if (analysis.notableFeatures.length > 0) {
    console.log('\n✨ 显著特征:');
    analysis.notableFeatures.forEach(feature => console.log(`  ${feature}`));
  }
  
  console.log('\n🔥 新歌亮点:');
  realSongs.slice(0, 5).forEach(song => {
    const genres = detectGenre(song.title, song.singer);
    console.log(`  ${song.rank}. ${song.title} - ${song.singer} [${genres.join('/')}]`);
  });
  
  return analysis;
}

// 分析榜单整体趋势
function analyzeChartTrends(songs) {
  const realSongs = songs.filter(song => {
    const title = song.title.toLowerCase();
    const invalidKeywords = ['播放', '下载', '分享', '榜单', '热门', '特色', '全球', '全部'];
    return !invalidKeywords.some(keyword => title.includes(keyword));
  });
  
  console.log(`\n=== TOP500榜单趋势分析 (${TODAY}) ===`);
  console.log(`有效歌曲: ${realSongs.length} 首`);
  
  if (realSongs.length === 0) {
    console.log('⚠️  没有检测到有效歌曲数据');
    return;
  }
  
  // 曲风分布
  const genreDistribution = {};
  realSongs.forEach(song => {
    const genres = detectGenre(song.title, song.singer);
    genres.forEach(genre => {
      genreDistribution[genre] = (genreDistribution[genre] || 0) + 1;
    });
  });
  
  console.log('\n🎵 整体曲风分布:');
  Object.entries(genreDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([genre, count]) => {
      const percentage = ((count / realSongs.length) * 100).toFixed(1);
      console.log(`  ${genre}: ${count}首 (${percentage}%)`);
    });
  
  // 歌手多样性
  const singers = new Set(realSongs.map(s => s.singer).filter(s => s && s !== '未知歌手'));
  console.log(`\n👥 歌手多样性: ${singers.size} 位不同歌手`);
  
  // 标题长度分析
  const avgTitleLength = realSongs.reduce((sum, song) => sum + song.title.length, 0) / realSongs.length;
  console.log(`📝 平均标题长度: ${avgTitleLength.toFixed(1)} 字符`);
  
  // 识别热门关键词
  const wordFrequency = {};
  realSongs.forEach(song => {
    const words = song.title.split(/[^\u4e00-\u9fa5a-zA-Z0-9]+/);
    words.forEach(word => {
      if (word.length > 1) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
  });
  
  const topKeywords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log('\n🔑 热门关键词:');
  topKeywords.forEach(([word, count]) => {
    const percentage = ((count / realSongs.length) * 100).toFixed(1);
    console.log(`  ${word}: ${count}次 (${percentage}%)`);
  });
  
  // 识别潜力歌曲（排名靠后的好歌）
  const potentialHits = realSongs
    .filter(song => song.rank > 10 && song.rank <= 30)
    .slice(0, 3);
  
  if (potentialHits.length > 0) {
    console.log('\n🚀 潜力歌曲（排名10-30）:');
    potentialHits.forEach(song => {
      const genres = detectGenre(song.title, song.singer);
      console.log(`  ${song.rank}. ${song.title} - ${song.singer} [${genres.join('/')}]`);
    });
  }
}

async function main() {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
    
    if (jsonFiles.length === 0) {
      console.log('没有找到榜单数据文件');
      return;
    }
    
    const latestFile = path.join(DATA_DIR, jsonFiles[0]);
    const content = await fs.readFile(latestFile, 'utf8');
    const data = JSON.parse(content);
    
    console.log(`📅 分析日期: ${data.date}`);
    console.log(`📈 数据来源: ${data.note || '未知'}`);
    
    // 分析新上榜歌曲
    if (data.changes && data.changes.newEntries) {
      analyzeNewEntries(data.changes.newEntries);
    }
    
    // 分析整体趋势
    if (data.songs) {
      analyzeChartTrends(data.songs);
    }
    
    // 如果有历史数据，分析趋势变化
    if (jsonFiles.length > 1) {
      console.log(`\n📊 历史数据: ${jsonFiles.length} 天记录`);
      console.log('(运行几天后可以看到曲风趋势变化)');
    }
    
    console.log('\n💡 建议:');
    console.log('1. 连续运行几天后，可以看到曲风趋势变化');
    console.log('2. 关注新上榜歌曲的曲风分布，预测流行趋势');
    console.log('3. 识别潜力歌曲，提前关注可能爆火的曲风');
    
  } catch (err) {
    console.error('分析失败:', err.message);
  }
}

main().catch(err => {
  console.error('程序错误:', err);
  process.exit(1);
});
