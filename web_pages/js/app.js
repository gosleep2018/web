// Welsh Learning - 独立项目主应用
class WelshLearningApp {
  constructor() {
    this.config = {
      api: {
        tts: 'https://web-x0ya.onrender.com/tts'
      },
      settings: {
        showPrefixSuffix: true,
        showMemoryHints: true,
        showExtensions: true,
        autoPlayAudio: false,
        learningMode: 'balanced' // quick, balanced, deep
      },
      currentModule: 'dailyWords',
      currentWordIndex: 0
    };
    
    this.data = {
      dailyWords: [],
      commonPhrases: [],
      pronunciation: [],
      culture: []
    };
    
    this.init();
  }
  
  async init() {
    console.log('🏴󠁧󠁢󠁷󠁬󠁳󠁿 威尔士学习应用初始化...');
    
    // 初始化进度数据
    this.progressData = this.loadProgress();
    
    // 加载词汇数据
    await this.loadData();
    
    // 从API加载服务器进度（如果可用）
    await this.loadServerProgress();
    
    // 初始化UI
    this.initUI();
    
    // 绑定事件
    this.bindEvents();
    
    // 显示初始内容
    this.showModule(this.config.currentModule);
    
    console.log('✅ 应用初始化完成');
  }
  
  // 从服务器加载进度
  async loadServerProgress() {
    try {
      if (window.welshAPI) {
        const result = await window.welshAPI.getUserProgress();
        if (result.success && result.data) {
          console.log('✅ 从服务器加载进度:', result.data);
          
          // 合并服务器进度到本地
          this.mergeServerProgress(result.data);
        }
      }
    } catch (error) {
      console.warn('无法从服务器加载进度，使用本地存储:', error);
    }
  }
  
  // 合并服务器进度
  mergeServerProgress(serverProgress) {
    // 这里可以根据需要实现服务器和本地进度的合并逻辑
    // 例如：如果服务器有更新的进度，覆盖本地进度
    console.log('合并服务器进度:', serverProgress);
  }
  
  async loadData() {
    try {
      // 示例数据 - 实际可以从服务器加载
      this.data.dailyWords = [
        {
          id: 1,
          english: "hello",
          welsh: "helo",
          pronunciation: "HEH-lo",
          prefix: "",
          suffix: "-o (常见结尾)",
          memoryHint: "和英语 hello 几乎一样，只是发音更短促",
          extensions: {
            synonyms: ["hi", "greetings"],
            antonyms: ["goodbye"],
            collocations: ["say hello", "hello there"],
            sentence: "Helo, sut wyt ti? (Hello, how are you?)"
          },
          ttsText: "helo",
          category: "greetings"
        },
        {
          id: 2,
          english: "thank you",
          welsh: "diolch",
          pronunciation: "DEE-olch",
          prefix: "di- (强调前缀)",
          suffix: "-olch (感谢后缀)",
          memoryHint: "联想：DEEp OLCH → 深深的感谢",
          extensions: {
            synonyms: ["thanks", "gratitude"],
            antonyms: ["ingratitude"],
            collocations: ["diolch yn fawr (非常感谢)"],
            sentence: "Diolch am eich help. (谢谢你的帮助。)"
          },
          ttsText: "diolch",
          category: "courtesy"
        },
        {
          id: 3,
          english: "water",
          welsh: "dŵr",
          pronunciation: "door",
          prefix: "",
          suffix: "ŵr (液体后缀)",
          memoryHint: "发音像英语 door，想象水从门里流出来",
          extensions: {
            synonyms: ["liquid", "aqua"],
            antonyms: ["fire"],
            collocations: ["tap water", "mineral water"],
            sentence: "Mae'r dŵr yn oer. (水是冷的。)"
          },
          ttsText: "dŵr",
          category: "basics"
        },
        {
          id: 4,
          english: "good",
          welsh: "da",
          pronunciation: "dah",
          prefix: "",
          suffix: "-a (形容词后缀)",
          memoryHint: "发音像中文'大'，想象'大的就是好的'",
          extensions: {
            synonyms: ["fine", "excellent"],
            antonyms: ["bad"],
            collocations: ["very good", "good morning"],
            sentence: "Mae'n dda iawn. (非常好。)"
          },
          ttsText: "da",
          category: "basics"
        },
        {
          id: 5,
          english: "house",
          welsh: "tŷ",
          pronunciation: "tee",
          prefix: "",
          suffix: "ŷ (名词后缀)",
          memoryHint: "发音像英语 tea，想象在房子里喝茶",
          extensions: {
            synonyms: ["home", "dwelling"],
            antonyms: ["outside"],
            collocations: ["big house", "house number"],
            sentence: "Mae'r tŷ yn fawr. (房子很大。)"
          },
          ttsText: "tŷ",
          category: "basics"
        }
      ];
      
      // 计算学习进度
      this.calculateProgress();
      
      console.log(`✅ 数据加载完成: ${this.data.dailyWords.length} 个单词`);
    } catch (error) {
      console.error('❌ 数据加载失败:', error);
      this.showError('数据加载失败，请刷新页面重试');
    }
  }
  
  initUI() {
    // 初始化设置控件
    this.updateSettingsUI();
    
    // 更新进度显示
    this.updateProgressUI();
    
    // 设置当前日期
    document.getElementById('currentDate').textContent = 
      new Date().toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
      });
  }
  
  bindEvents() {
    // 导航链接
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const module = e.target.dataset.module || e.target.closest('.nav-link').dataset.module;
        this.showModule(module);
      });
    });
    
    // 设置切换
    document.getElementById('togglePrefix').addEventListener('change', (e) => {
      this.config.settings.showPrefixSuffix = e.target.checked;
      this.renderCurrentWord();
    });
    
    document.getElementById('toggleMemory').addEventListener('change', (e) => {
      this.config.settings.showMemoryHints = e.target.checked;
      this.renderCurrentWord();
    });
    
    document.getElementById('toggleExtensions').addEventListener('change', (e) => {
      this.config.settings.showExtensions = e.target.checked;
      this.renderCurrentWord();
    });
    
    document.getElementById('toggleAutoPlay').addEventListener('change', (e) => {
      this.config.settings.autoPlayAudio = e.target.checked;
    });
    
    document.getElementById('learningMode').addEventListener('change', (e) => {
      this.config.settings.learningMode = e.target.value;
      this.applyLearningMode();
    });
    
    // 导航按钮
    document.getElementById('prevBtn').addEventListener('click', () => this.prevWord());
    document.getElementById('nextBtn').addEventListener('click', () => this.nextWord());
    
    // 播放按钮（动态绑定在 renderCurrentWord 中）
  }
  
  showModule(moduleName) {
    this.config.currentModule = moduleName;
    
    // 更新导航激活状态
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.module === moduleName);
    });
    
    // 更新模块标题
    const moduleTitles = {
      dailyWords: '每日威尔士语词汇',
      commonPhrases: '常用短语',
      pronunciation: '发音练习',
      culture: '威尔士文化'
    };
    
    document.getElementById('moduleTitle').textContent = 
      moduleTitles[moduleName] || '威尔士语学习';
    
    // 显示对应内容
    if (moduleName === 'dailyWords') {
      this.showDailyWords();
    } else {
      this.showComingSoon(moduleName);
    }
  }
  
  showDailyWords() {
    const container = document.getElementById('moduleContent');
    
    if (this.data.dailyWords.length === 0) {
      container.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>加载单词数据中...</p>
        </div>
      `;
      return;
    }
    
    // 显示单词学习界面
    container.innerHTML = `
      <div class="word-learning">
        <div id="wordCardContainer"></div>
        <div class="nav-buttons">
          <button id="prevBtn" class="btn btn-prev">
            <i class="fas fa-arrow-left"></i> 上一个
          </button>
          <div class="word-counter">
            <span id="wordCounter">1 / ${this.data.dailyWords.length}</span>
          </div>
          <button id="nextBtn" class="btn btn-next">
            下一个 <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
    
    // 重新绑定导航按钮
    document.getElementById('prevBtn').addEventListener('click', () => this.prevWord());
    document.getElementById('nextBtn').addEventListener('click', () => this.nextWord());
    
    // 显示当前单词
    this.config.currentWordIndex = 0;
    this.renderCurrentWord();
    
    // 自动播放（如果开启）
    if (this.config.settings.autoPlayAudio) {
      setTimeout(() => this.playCurrentWordAudio(), 800);
    }
  }
  
  renderCurrentWord() {
    const container = document.getElementById('wordCardContainer');
    if (!container || this.data.dailyWords.length === 0) return;
    
    const word = this.data.dailyWords[this.config.currentWordIndex];
    if (!word) return;
    
    let html = `
      <div class="word-card">
        <div class="word-header">
          <div class="word-text">
            <div class="word-english">${word.english}</div>
            <div class="word-welsh">${word.welsh}</div>
            <div class="pronunciation">发音: ${word.pronunciation}</div>
          </div>
          <div class="audio-controls">
            <button class="btn-audio" id="playCurrentWord">
              <i class="fas fa-volume-up"></i>
            </button>
            <div class="progress-controls" style="display: flex; gap: 10px; margin-left: 15px;">
              <button class="btn-progress" id="markForReview" style="padding: 8px 15px; background: #f39c12; color: white; border: none; border-radius: 5px; cursor: pointer;">
                <i class="fas fa-redo"></i> 需要复习
              </button>
              <button class="btn-progress" id="markAsMastered" style="padding: 8px 15px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer;">
                <i class="fas fa-check-circle"></i> 已掌握
              </button>
            </div>
          </div>
        </div>
    `;
    
    // 词根词缀（根据设置显示）
    if (this.config.settings.showPrefixSuffix && (word.prefix || word.suffix)) {
      html += `
        <div class="enhanced-module">
          <div class="module-title">
            <i class="fas fa-puzzle-piece"></i> 词根词缀分析
          </div>
          <div class="prefix-suffix-grid">
            ${word.prefix ? `
              <div class="prefix-box">
                <strong>前缀:</strong> ${word.prefix}
              </div>
            ` : ''}
            ${word.suffix ? `
              <div class="suffix-box">
                <strong>后缀:</strong> ${word.suffix}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
    
    // 记忆技巧（根据设置显示）
    if (this.config.settings.showMemoryHints && word.memoryHint) {
      html += `
        <div class="enhanced-module">
          <div class="module-title">
            <i class="fas fa-lightbulb"></i> 记忆技巧
          </div>
          <div class="memory-hint-box">
            ${word.memoryHint}
          </div>
        </div>
      `;
    }
    
    // 扩展学习（根据设置显示）
    if (this.config.settings.showExtensions && word.extensions) {
      html += `
        <div class="enhanced-module">
          <div class="module-title">
            <i class="fas fa-expand-alt"></i> 扩展学习
          </div>
          <div class="extensions-grid">
      `;
      
      if (word.extensions.synonyms) {
        html += `
          <div class="extension-card">
            <div class="extension-title">同义词</div>
            <div>${word.extensions.synonyms.join(', ')}</div>
          </div>
        `;
      }
      
      if (word.extensions.antonyms) {
        html += `
          <div class="extension-card">
            <div class="extension-title">反义词</div>
            <div>${word.extensions.antonyms.join(', ')}</div>
          </div>
        `;
      }
      
      if (word.extensions.collocations) {
        html += `
          <div class="extension-card">
            <div class="extension-title">常用搭配</div>
            <div>${word.extensions.collocations.join(', ')}</div>
          </div>
        `;
      }
      
      html += `</div>`;
      
      if (word.extensions.sentence) {
        html += `
          <div class="example-sentence">
            <strong>例句:</strong> ${word.extensions.sentence}
          </div>
        `;
      }
      
      html += `</div>`;
    }
    
    html += `</div>`;
    container.innerHTML = html;
    
    // 绑定播放按钮
    document.getElementById('playCurrentWord').addEventListener('click', () => 
      this.playCurrentWordAudio()
    );
    
    // 绑定进度控制按钮
    document.getElementById('markForReview').addEventListener('click', () => {
      const word = this.data.dailyWords[this.config.currentWordIndex];
      this.markWordForReview(word.id);
    });
    
    document.getElementById('markAsMastered').addEventListener('click', () => {
      const word = this.data.dailyWords[this.config.currentWordIndex];
      this.markWordAsMastered(word.id);
    });
    
    // 显示当前单词状态
    const wordStatus = this.getWordStatus(word.id);
    if (wordStatus === 'mastered') {
      document.getElementById('markAsMastered').innerHTML = '<i class="fas fa-check-double"></i> 已掌握';
      document.getElementById('markAsMastered').style.background = '#2ecc71';
      document.getElementById('markAsMastered').disabled = true;
    } else if (wordStatus === 'reviewed') {
      document.getElementById('markForReview').innerHTML = '<i class="fas fa-clock"></i> 复习中';
      document.getElementById('markForReview').style.background = '#e67e22';
    }
    
    // 更新计数器
    document.getElementById('wordCounter').textContent = 
      `${this.config.currentWordIndex + 1} / ${this.data.dailyWords.length}`;
    
    // 更新进度
    this.updateProgressUI();
  }
  
  playCurrentWordAudio() {
    const word = this.data.dailyWords[this.config.currentWordIndex];
    if (!word) return;
    
    const ttsUrl = `${this.config.api.tts}?text=${encodeURIComponent(word.ttsText)}&voice=en-US-JennyNeural`;
    const audio = new Audio(ttsUrl);
    
    // 视觉反馈
    const btn = document.getElementById('playCurrentWord');
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      btn.disabled = true;
      
      audio.play().then(() => {
        audio.onended = () => {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        };
      }).catch(err => {
        console.error('❌ 音频播放失败:', err);
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        btn.disabled = false;
        
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 2000);
      });
    }
  }
  
  prevWord() {
    if (this.config.currentWordIndex > 0) {
      this.config.currentWordIndex--;
      this.renderCurrentWord();
      
      if (this.config.settings.autoPlayAudio) {
        setTimeout(() => this.playCurrentWordAudio(), 300);
      }
    }
  }
  
  nextWord() {
    if (this.config.currentWordIndex < this.data.dailyWords.length - 1) {
      this.config.currentWordIndex++;
      this.renderCurrentWord();
      
      if (this.config.settings.autoPlayAudio) {
        setTimeout(() => this.playCurrentWordAudio(), 300);
      }
    }
  }
  
  updateSettingsUI() {
    document.getElementById('togglePrefix').checked = this.config.settings.showPrefixSuffix;
    document.getElementById('toggleMemory').checked = this.config.settings.showMemoryHints;
    document.getElementById('toggleExtensions').checked = this.config.settings.showExtensions;
    document.getElementById('toggleAutoPlay').checked = this.config.settings.autoPlayAudio;
    document.getElementById('learningMode').value = this.config.settings.learningMode;
  }
  
  applyLearningMode() {
    switch(this.config.settings.learningMode) {
      case 'quick':
        this.config.settings.showPrefixSuffix = false;
        this.config.settings.showMemoryHints = true;
        this.config.settings.showExtensions = false;
        this.config.settings.autoPlayAudio = true;
        break;
      case 'balanced':
        this.config.settings.showPrefixSuffix = true;
        this.config.settings.showMemoryHints = true;
        this.config.settings.showExtensions = true;
        this.config.settings.autoPlayAudio = true;
        break;
      case 'deep':
        this.config.settings.showPrefixSuffix = true;
        this.config.settings.showMemoryHints = true;
        this.config.settings.showExtensions = true;
        this.config.settings.autoPlayAudio = true;
        // 深度模式可以添加更多功能
        break;
    }
    
    this.updateSettingsUI();
    this.renderCurrentWord();
  }
  
  calculateProgress() {
    // 从本地存储加载学习状态
    const progressData = this.loadProgress();
    const totalWords = this.data.dailyWords.length;
    
    // 计算已掌握单词数
    const masteredWords = progressData.masteredWords.length;
    const reviewedWords = progressData.reviewedWords.length;
    const totalLearned = new Set([...progressData.masteredWords, ...progressData.reviewedWords]).size;
    
    this.progress = {
      mastered: masteredWords,
      reviewed: reviewedWords,
      totalLearned: totalLearned,
      total: totalWords,
      percentage: Math.round((totalLearned / totalWords) * 100),
      streak: progressData.streak,
      lastStudyDate: progressData.lastStudyDate
    };
  }
  
  // 加载学习进度
  loadProgress() {
    const defaultProgress = {
      masteredWords: [],      // 完全掌握的单词ID
      reviewedWords: [],      // 复习过的单词ID
      learningHistory: [],    // 学习记录
      streak: 0,              // 连续学习天数
      lastStudyDate: null,    // 最后学习日期
      settings: this.config.settings
    };
    
    try {
      const saved = localStorage.getItem('welshLearningProgress');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // 检查是否需要重置连续天数
        if (parsed.lastStudyDate) {
          const lastDate = new Date(parsed.lastStudyDate);
          const today = new Date();
          const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            parsed.streak += 1;
          } else if (diffDays > 1) {
            parsed.streak = 0;
          }
        }
        
        return { ...defaultProgress, ...parsed };
      }
    } catch (error) {
      console.error('加载进度失败:', error);
    }
    
    return defaultProgress;
  }
  
  // 保存学习进度
  saveProgress() {
    const progressData = {
      masteredWords: this.progressData.masteredWords,
      reviewedWords: this.progressData.reviewedWords,
      learningHistory: this.progressData.learningHistory,
      streak: this.progress.streak,
      lastStudyDate: new Date().toISOString(),
      settings: this.config.settings,
      updatedAt: new Date().toISOString()
    };
    
    try {
      localStorage.setItem('welshLearningProgress', JSON.stringify(progressData));
      console.log('✅ 进度已保存');
    } catch (error) {
      console.error('保存进度失败:', error);
    }
  }
  
  // 标记单词为已掌握
  async markWordAsMastered(wordId) {
    if (!this.progressData.masteredWords.includes(wordId)) {
      this.progressData.masteredWords.push(wordId);
      
      // 从复习列表中移除（如果存在）
      this.progressData.reviewedWords = this.progressData.reviewedWords.filter(id => id !== wordId);
      
      // 记录学习历史
      this.progressData.learningHistory.push({
        wordId: wordId,
        action: 'mastered',
        timestamp: new Date().toISOString()
      });
      
      // 保存到本地
      this.saveProgress();
      
      // 同步到服务器（如果可用）
      try {
        if (window.welshAPI) {
          await window.welshAPI.updateWordStatus(wordId, 'mastered');
        }
      } catch (error) {
        console.warn('同步到服务器失败:', error);
      }
      
      this.updateProgressUI();
      
      // 显示成功反馈
      this.showToast('🎉 单词已标记为已掌握！', 'success');
    }
  }
  
  // 标记单词为需要复习
  async markWordForReview(wordId) {
    if (!this.progressData.reviewedWords.includes(wordId) && 
        !this.progressData.masteredWords.includes(wordId)) {
      this.progressData.reviewedWords.push(wordId);
      
      this.progressData.learningHistory.push({
        wordId: wordId,
        action: 'reviewed',
        timestamp: new Date().toISOString()
      });
      
      // 保存到本地
      this.saveProgress();
      
      // 同步到服务器（如果可用）
      try {
        if (window.welshAPI) {
          await window.welshAPI.updateWordStatus(wordId, 'reviewed');
        }
      } catch (error) {
        console.warn('同步到服务器失败:', error);
      }
      
      this.updateProgressUI();
      
      this.showToast('📝 单词已加入复习列表', 'info');
    }
  }
  
  // 获取单词学习状态
  getWordStatus(wordId) {
    if (this.progressData.masteredWords.includes(wordId)) {
      return 'mastered';
    } else if (this.progressData.reviewedWords.includes(wordId)) {
      return 'reviewed';
    } else {
      return 'new';
    }
  }
  
  updateProgressUI() {
    this.calculateProgress();
    
    // 更新进度条
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
      progressFill.style.width = `${this.progress.percentage}%`;
    }
    
    // 更新进度文本
    const progressText = document.getElementById('progressText');
    if (progressText) {
      progressText.innerHTML = `
        <div style="margin-bottom: 5px;">
          <strong>进度:</strong> ${this.progress.totalLearned}/${this.progress.total} 单词 (${this.progress.percentage}%)
        </div>
        <div style="font-size: 0.9rem; color: #666;">
          <span style="color: #27ae60;">✓ 已掌握: ${this.progress.mastered}</span> | 
          <span style="color: #f39c12;">📝 需复习: ${this.progress.reviewed}</span> | 
          <span style="color: #3498db;">🔥 连续: ${this.progress.streak}天</span>
        </div>
      `;
    }
    
    // 更新侧边栏统计
    const statsElement = document.getElementById('progressStats');
    if (statsElement) {
      statsElement.innerHTML = `
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value" style="color: #27ae60;">${this.progress.mastered}</div>
            <div class="stat-label">已掌握</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" style="color: #f39c12;">${this.progress.reviewed}</div>
            <div class="stat-label">需复习</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" style="color: #e74c3c;">${this.progress.total - this.progress.totalLearned}</div>
            <div class="stat-label">未学习</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" style="color: #3498db;">${this.progress.streak}</div>
            <div class="stat-label">连续天数</div>
          </div>
        </div>
      `;
    }
  }
  
  // 显示通知
  showToast(message, type = 'info') {
    // 移除现有通知
    const existingToast = document.getElementById('learningToast');
    if (existingToast) existingToast.remove();
    
    // 创建新通知
    const toast = document.createElement('div');
    toast.id = 'learningToast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
      color: white;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease;
      max-width: 300px;
    `;
    
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <div>${message}</div>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // 3秒后自动消失
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3000);
  }
  
  showComingSoon(moduleName) {
    const container = document.getElementById('moduleContent');
    const moduleNames = {
      commonPhrases: '常用短语',
      pronunciation: '发音练习',
      culture: '威尔士文化'
    };
    
    container.innerHTML = `
      <div class="text-center mt-20 mb-20">
        <div style="font-size: 4rem; color: var(--welsh-gold); margin-bottom: 20px;">
          <i class="fas fa-tools"></i>
        </div>
        <h2 style="color: var(--welsh-red); margin-bottom: 15px;">
          ${moduleNames[moduleName] || moduleName} 模块
        </h2>
        <p style="font-size: 1.2rem; margin-bottom: 30px;">
          正在开发中，即将推出...
        </p>
        <div style="background: #f8f9