// 威尔士学习API客户端
class WelshLearningAPI {
  constructor() {
    this.baseURL = 'http://localhost:3001/api';
    this.userId = this.getUserId();
  }
  
  // 获取或创建用户ID
  getUserId() {
    let userId = localStorage.getItem('welshUserId');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('welshUserId', userId);
    }
    return userId;
  }
  
  // 通用请求方法
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': this.userId
      }
    };
    
    const config = { ...defaultOptions, ...options };
    
    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API请求失败:', error);
      
      // 如果API不可用，回退到本地存储
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        console.warn('API服务不可用，使用本地存储模式');
        return this.fallbackToLocalStorage(endpoint, options);
      }
      
      throw error;
    }
  }
  
  // API不可用时的回退方案
  fallbackToLocalStorage(endpoint, options) {
    console.log('使用本地存储回退方案');
    
    // 这里可以添加更多的端点处理
    if (endpoint.startsWith('/progress/') && options.method === 'GET') {
      return this.getLocalProgress();
    }
    
    // 默认返回空数据
    return Promise.resolve({ 
      success: true, 
      data: {},
      message: '使用本地存储模式'
    });
  }
  
  // 获取本地存储的进度
  getLocalProgress() {
    const progress = localStorage.getItem('welshLearningProgress');
    const data = progress ? JSON.parse(progress) : {
      masteredWords: [],
      reviewedWords: [],
      learningHistory: [],
      streak: 0,
      lastStudyDate: null
    };
    
    const totalWords = 13; // 当前示例单词数
    
    return Promise.resolve({
      success: true,
      data: {
        totalWords: totalWords,
        masteredWords: data.masteredWords.length,
        reviewedWords: data.reviewedWords.length,
        totalLearned: new Set([...data.masteredWords, ...data.reviewedWords]).size,
        streak: data.streak || 0,
        lastStudyDate: data.lastStudyDate,
        totalStudyTime: 0,
        percentage: totalWords ? Math.round((new Set([...data.masteredWords, ...data.reviewedWords]).size / totalWords) * 100) : 0
      }
    });
  }
  
  // 获取用户进度
  async getUserProgress() {
    return this.request(`/progress/${this.userId}`);
  }
  
  // 更新单词状态
  async updateWordStatus(wordId, status, reviewCount = 0) {
    return this.request(`/progress/${this.userId}/word/${wordId}`, {
      method: 'POST',
      body: JSON.stringify({ status, reviewCount })
    });
  }
  
  // 获取需要复习的单词
  async getReviewWords(limit = 10) {
    return this.request(`/progress/${this.userId}/review?limit=${limit}`);
  }
  
  // 获取学习历史
  async getLearningHistory(limit = 50, offset = 0) {
    return this.request(`/progress/${this.userId}/history?limit=${limit}&offset=${offset}`);
  }
  
  // 健康检查
  async healthCheck() {
    try {
      const result = await this.request('/health');
      return {
        apiAvailable: true,
        data: result
      };
    } catch (error) {
      return {
        apiAvailable: false,
        error: error.message
      };
    }
  }
  
  // 同步本地进度到服务器
  async syncLocalProgress() {
    const localProgress = localStorage.getItem('welshLearningProgress');
    if (!localProgress) return;
    
    const progress = JSON.parse(localProgress);
    
    // 同步已掌握的单词
    for (const wordId of progress.masteredWords) {
      try {
        await this.updateWordStatus(wordId, 'mastered');
      } catch (error) {
        console.warn(`同步单词 ${wordId} 失败:`, error);
      }
    }
    
    // 同步需要复习的单词
    for (const wordId of progress.reviewedWords) {
      try {
        await this.updateWordStatus(wordId, 'reviewed');
      } catch (error) {
        console.warn(`同步单词 ${wordId} 失败:`, error);
      }
    }
    
    console.log('✅ 本地进度已同步到服务器');
  }
}

// 全局API实例
window.welshAPI = new WelshLearningAPI();

// 测试API连接
async function testAPIConnection() {
  console.log('🔌 测试API连接...');
  
  const health = await window.welshAPI.healthCheck();
  
  if (health.apiAvailable) {
    console.log('✅ API服务可用:', health.data);
    return true;
  } else {
    console.warn('⚠️ API服务不可用，使用本地存储模式');
    return false;
  }
}

// 页面加载时测试连接
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    testAPIConnection().then(apiAvailable => {
      if (apiAvailable) {
        // 如果有本地进度，同步到服务器
        if (localStorage.getItem('welshLearningProgress')) {
          window.welshAPI.syncLocalProgress();
        }
      }
    });
  }, 1000);
});