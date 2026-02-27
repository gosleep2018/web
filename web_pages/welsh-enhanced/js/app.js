// Welsh Learning 2.0 - Enhanced App
class WelshLearningApp {
  constructor() {
    this.data = null;
    this.currentWordIndex = 0;
    this.settings = {
      showPrefixSuffix: true,
      showMemoryHint: true,
      showExtensions: true,
      autoPlay: false,
      learningIntensity: 'medium'
    };
    
    this.init();
  }
  
  async init() {
    // 加载数据
    await this.loadData();
    
    // 初始化UI
    this.initUI();
    
    // 绑定事件
    this.bindEvents();
    
    // 显示第一个单词
    this.renderWord();
  }
  
  async loadData() {
    try {
      // 这里可以改为从服务器加载
      this.data = {
        date: new Date().toISOString().split('T')[0],
        words: [
          {
            english: "hello",
            welsh: "helo",
            pronunciation: "HEH-lo",
            prefix: "",
            suffix: "-o (common ending)",
            memory_hint: "和英语 hello 几乎一样，只是发音更短促",
            extensions: {
              synonyms: ["hi", "greetings"],
              antonyms: ["goodbye"],
              collocations: ["say hello", "hello there"],
              sentence: "Helo, sut wyt ti? (Hello, how are you?)"
            },
            tts_text: "helo"
          },
          {
            english: "thank you",
            welsh: "diolch",
            pronunciation: "DEE-olch",
            prefix: "di- (intensive)",
            suffix: "-olch (gratitude suffix)",
            memory_hint: "联想：DEEp OLCH → 深深的感谢",
            extensions: {
              synonyms: ["thanks", "gratitude"],
              antonyms: ["ingratitude"],
              collocations: ["diolch yn fawr (thank you very much)"],
              sentence: "Diolch am eich help. (Thank you for your help.)"
            },
            tts_text: "diolch"
          },
          {
            english: "water",
            welsh: "dŵr",
            pronunciation: "door",
            prefix: "",
            suffix: "ŵr (liquid suffix)",
            memory_hint: "发音像英语 door，想象水从门里流出来",
            extensions: {
              synonyms: ["liquid", "aqua"],
              antonyms: ["fire"],
              collocations: ["tap water", "mineral water"],
              sentence: "Mae'r dŵr yn oer. (The water is cold.)"
            },
            tts_text: "dŵr"
          }
        ],
        settings: this.settings
      };
      
      console.log('✅ 数据加载完成:', this.data.words.length, '个单词');
    } catch (error) {
      console.error('❌ 数据加载失败:', error);
      this.showError('数据加载失败，请刷新页面');
    }
  }
  
  initUI() {
    // 初始化设置控件
    document.getElementById('togglePrefix').checked = this.settings.showPrefixSuffix;
    document.getElementById('toggleMemory').checked = this.settings.showMemoryHint;
    document.getElementById('toggleExtensions').checked = this.settings.showExtensions;
    document.getElementById('toggleAutoPlay').checked = this.settings.autoPlay;
    document.getElementById('intensitySelect').value = this.settings.learningIntensity;
    
    // 更新进度条
    this.updateProgress();
  }
  
  bindEvents() {
    // 设置切换
    document.getElementById('togglePrefix').addEventListener('change', (e) => {
      this.settings.showPrefixSuffix = e.target.checked;
      this.renderWord();
    });
    
    document.getElementById('toggleMemory').addEventListener('change', (e) => {
      this.settings.showMemoryHint = e.target.checked;
      this.renderWord();
    });
    
    document.getElementById('toggleExtensions').addEventListener('change', (e) => {
      this.settings.showExtensions = e.target.checked;
      this.renderWord();
    });
    
    document.getElementById('toggleAutoPlay').addEventListener('change', (e) => {
      this.settings.autoPlay = e.target.checked;
    });
    
    document.getElementById('intensitySelect').addEventListener('change', (e) => {
      this.settings.learningIntensity = e.target.value;
      this.applyIntensity();
    });
    
    // 导航按钮
    document.getElementById('prevBtn').addEventListener('click', () => this.prevWord());
    document.getElementById('nextBtn').addEventListener('click', () => this.nextWord());
    
    // 播放按钮
    document.getElementById('playBtn').addEventListener('click', () => this.playAudio());
  }
  
  renderWord() {
    if (!this.data || !this.data.words[this.currentWordIndex]) return;
    
    const word = this.data.words[this.currentWordIndex];
    const container = document.getElementById('wordContainer');
    
    let html = `
      <div class="word-card">
        <div class="word-header">
          <div>
            <div class="word-english">${word.english}</div>
            <div class="word-welsh">${word.welsh}</div>
            <div class="pronunciation">发音: ${word.pronunciation}</div>
          </div>
          <div class="audio-controls">
            <button class="play-btn" id="currentPlayBtn">
              <i class="fas fa-volume-up"></i>
            </button>
          </div>
        </div>
    `;
    
    // 前缀/后缀（根据设置显示）
    if (this.settings.showPrefixSuffix && (word.prefix || word.suffix)) {
      html += `
        <div class="enhanced-section">
          <div class="section-title">
            <i class="fas fa-puzzle-piece"></i> 词根词缀分析
          </div>
          <div class="prefix-suffix">
            ${word.prefix ? `<div class="prefix"><strong>前缀:</strong> ${word.prefix}</div>` : ''}
            ${word.suffix ? `<div class="suffix"><strong>后缀:</strong> ${word.suffix}</div>` : ''}
          </div>
        </div>
      `;
    }
    
    // 记忆方法（根据设置显示）
    if (this.settings.showMemoryHint && word.memory_hint) {
      html += `
        <div class="enhanced-section">
          <div class="section-title">
            <i class="fas fa-lightbulb"></i> 记忆技巧
          </div>
          <div class="memory-hint">${word.memory_hint}</div>
        </div>
      `;
    }
    
    // 扩展学习（根据设置显示）
    if (this.settings.showExtensions && word.extensions) {
      html += `
        <div class="enhanced-section">
          <div class="section-title">
            <i class="fas fa-expand-alt"></i> 扩展学习
          </div>
          <div class="extensions-grid">
            ${word.extensions.synonyms ? `
              <div class="extension-card">
                <h4>同义词</h4>
                <div>${word.extensions.synonyms.join(', ')}</div>
              </div>
            ` : ''}
            
            ${word.extensions.antonyms ? `
              <div class="extension-card">
                <h4>反义词</h4>
                <div>${word.extensions.antonyms.join(', ')}</div>
              </div>
            ` : ''}
            
            ${word.extensions.collocations ? `
              <div class="extension-card">
                <h4>常用搭配</h4>
                <div>${word.extensions.collocations.join(', ')}</div>
              </div>
            ` : ''}
          </div>
          
          ${word.extensions.sentence ? `
            <div class="sentence">
              <strong>例句:</strong> ${word.extensions.sentence}
            </div>
          ` : ''}
        </div>
      `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
    
    // 重新绑定当前播放按钮
    document.getElementById('currentPlayBtn')?.addEventListener('click', () => this.playAudio());
    
    // 更新进度
    this.updateProgress();
    
    // 自动播放（如果开启）
    if (this.settings.autoPlay) {
      setTimeout(() => this.playAudio(), 500);
    }
  }
  
  playAudio() {
    if (!this.data || !this.data.words[this.currentWordIndex]) return;
    
    const word = this.data.words[this.currentWordIndex];
    const ttsUrl = `https://web-x0ya.onrender.com/tts?text=${encodeURIComponent(word.tts_text)}&voice=en-US-JennyNeural`;
    
    const audio = new Audio(ttsUrl);
    audio.play().catch(err => {
      console.error('❌ 音频播放失败:', err);
      alert('发音播放失败，请检查网络或TTS服务');
    });
    
    // 视觉反馈
    const btn = document.getElementById('currentPlayBtn');
    if (btn) {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      btn.disabled = true;
      
      audio.onended = () => {
        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
        btn.disabled = false;
      };
      
      setTimeout(() => {
        if (!btn.disabled) return;
        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
        btn.disabled = false;
      }, 3000);
    }
  }
  
  prevWord() {
    if (this.currentWordIndex > 0) {
      this.currentWordIndex--;
      this.renderWord();
    }
  }
  
  nextWord() {
    if (this.data && this.currentWordIndex < this.data.words.length - 1) {
      this.currentWordIndex++;
      this.renderWord();
    }
  }
  
  updateProgress() {
    if (!this.data) return;
    
    const progress = ((this.currentWordIndex + 1) / this.data.words.length) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = 
      `单词 ${this.currentWordIndex + 1} / ${this.data.words.length}`;
  }
  
  applyIntensity() {
    // 根据学习强度调整设置
    switch(this.settings.learningIntensity) {
      case 'low':
        this.settings.showPrefixSuffix = false;
        this.settings.showMemoryHint = true;
        this.settings.showExtensions = false;
        this.settings.autoPlay = true;
        break;
      case 'medium':
        this.settings.showPrefixSuffix = true;
        this.settings.showMemoryHint = true;
        this.settings.showExtensions = true;
        this.settings.autoPlay = true;
        break;
      case 'high':
        this.settings.showPrefixSuffix = true;
        this.settings.showMemoryHint = true;
        this.settings.showExtensions = true;
        this.settings.autoPlay = true;
        // 高强度模式可以添加更多功能
        break;
    }
    
    // 更新UI
    this.initUI();
    this.renderWord();
  }
  
  showError(message) {
    const container = document.getElementById('wordContainer');
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #e74c3c;">
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
        <h3>${message}</h3>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
          刷新页面
        </button>
      </div>
    `;
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new WelshLearningApp();
});