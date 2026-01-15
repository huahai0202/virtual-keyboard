/**
 * ===================================
 * 赛博虚拟键盘 - Cyber Keyboard
 * ===================================
 * 功能：中英文输入、机械键盘音效模拟
 */

document.addEventListener('DOMContentLoaded', () => {
    // ========== DOM 元素缓存 ==========
    const DOM = {
        keys: document.querySelectorAll('.key'),
        outputDisplay: document.querySelector('.output-display'),
        capsLight: document.querySelector('.status-light[data-label="CAPS"]'),
        cnLight: document.querySelector('.status-light[data-label="CN"]'),
        candidateBox: document.querySelector('.candidate-box'),
        pinyinDisplay: document.querySelector('.pinyin-text'),
        candidatesList: document.querySelector('.candidates-list'),
        themeToggle: document.getElementById('theme-toggle'),
        soundToggle: document.getElementById('sound-toggle')
    };

    // ========== 状态管理 ==========
    const state = {
        capsLock: false,
        isChineseMode: false,
        pinyinBuffer: "",
        candidatePage: 0,
        lastCandidates: [],
        candidatePageSize: 8,
        soundEnabled: true,
        isAllSelected: false
    };

    // ========== 中文标点映射 ==========
    const chinesePunctuation = {
        ',': '\uff0c',
        '.': '\u3002',
        '?': '\uff1f',
        '!': '\uff01',
        ':': '\uff1a',
        ';': '\uff1b',
        '(': '\uff08',
        ')': '\uff09',
        '<': '\u300a',
        '>': '\u300b',
        '/': '\u3001',
        '\\': '\u3001'
    };

    // ========== 音频管理模块 ==========
    const AudioManager = {
        ctx: null,

        init() {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        },

        playClick() {
            if (!this.ctx || !state.soundEnabled) return;

            // 恢复挂起的音频上下文
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            const now = this.ctx.currentTime;

            // 创建更好听的机械键盘音效
            // 1. 主敲击音 - 清脆的高频
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1800, now);
            osc1.frequency.exponentialRampToValueAtTime(800, now + 0.02);
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.15, now + 0.003);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.05);

            // 2. 敲击底座音 - 低沉的震动
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(150, now);
            osc2.frequency.exponentialRampToValueAtTime(60, now + 0.04);
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.linearRampToValueAtTime(0.08, now + 0.005);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start(now);
            osc2.stop(now + 0.06);

            // 3. 金属质感噪音
            const bufferSize = this.ctx.sampleRate * 0.03;
            const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
            }
            const noise = this.ctx.createBufferSource();
            const noiseGain = this.ctx.createGain();
            const noiseFilter = this.ctx.createBiquadFilter();
            noise.buffer = noiseBuffer;
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.value = 4000;
            noiseFilter.Q.value = 2;
            noiseGain.gain.setValueAtTime(0.04, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);
            noise.start(now);
        }
    };

    // ========== 中文输入管理模块 ==========
    const ChineseInput = {
        getDict() {
            return window.pinyinHanziDict;
        },

        reset() {
            state.pinyinBuffer = "";
            state.candidatePage = 0;
            state.lastCandidates = [];
            this.updateCandidateBox();
        },

        addChar(char) {
            state.pinyinBuffer += char.toLowerCase();
            state.candidatePage = 0;
            this.updateCandidateBox();
        },

        deleteChar() {
            if (state.pinyinBuffer.length > 0) {
                state.pinyinBuffer = state.pinyinBuffer.slice(0, -1);
                state.candidatePage = 0;
                this.updateCandidateBox();
                return true;
            }
            return false;
        },

        prevPage() {
            if (state.candidatePage > 0) {
                state.candidatePage--;
                this.updateCandidateBox();
            }
        },

        nextPage() {
            const totalPages = Math.ceil(state.lastCandidates.length / state.candidatePageSize);
            if (state.candidatePage < totalPages - 1) {
                state.candidatePage++;
                this.updateCandidateBox();
            }
        },

        updateCandidateBox() {
            if (!state.pinyinBuffer) {
                DOM.candidateBox.style.display = 'none';
                return;
            }

            DOM.candidateBox.style.display = 'flex';
            DOM.pinyinDisplay.textContent = state.pinyinBuffer;

            let matches = [];
            const charDict = this.getDict();
            const phraseDict = window.pinyinPhraseDict;

            if (!charDict) {
                matches = ['字典加载中...'];
            } else {
                // 1. 词组精确匹配（最高优先级）
                if (phraseDict && phraseDict[state.pinyinBuffer]) {
                    matches.push(phraseDict[state.pinyinBuffer]);
                }

                // 2. 词组前缀匹配
                if (phraseDict && matches.length < 10) {
                    for (const key in phraseDict) {
                        if (key !== state.pinyinBuffer && key.startsWith(state.pinyinBuffer)) {
                            if (!matches.includes(phraseDict[key])) {
                                matches.push(phraseDict[key]);
                            }
                            if (matches.length >= 10) break;
                        }
                    }
                }

                // 3. 单字精确匹配
                if (charDict[state.pinyinBuffer]) {
                    for (const char of charDict[state.pinyinBuffer]) {
                        if (!matches.includes(char)) {
                            matches.push(char);
                        }
                        if (matches.length >= 50) break;
                    }
                }

                // 4. 单字前缀匹配
                if (matches.length < 50) {
                    for (const key in charDict) {
                        if (key !== state.pinyinBuffer && key.startsWith(state.pinyinBuffer)) {
                            for (const char of charDict[key]) {
                                if (!matches.includes(char)) {
                                    matches.push(char);
                                }
                                if (matches.length >= 50) break;
                            }
                        }
                        if (matches.length >= 50) break;
                    }
                }

                if (matches.length === 0) {
                    matches = [state.pinyinBuffer];
                }
            }

            state.lastCandidates = matches;

            // 渲染候选词
            const totalPages = Math.max(1, Math.ceil(matches.length / state.candidatePageSize));
            state.candidatePage = Math.min(state.candidatePage, totalPages - 1);

            const pageStart = state.candidatePage * state.candidatePageSize;
            const displayMatches = matches.slice(pageStart, pageStart + state.candidatePageSize);

            // 使用 DocumentFragment 优化 DOM 操作
            const fragment = document.createDocumentFragment();

            // 上一页按钮
            const prevNav = document.createElement('div');
            prevNav.className = 'page-nav' + (state.candidatePage === 0 ? ' disabled' : '');
            prevNav.dataset.nav = 'prev';
            prevNav.textContent = '<';
            fragment.appendChild(prevNav);

            // 候选字
            displayMatches.forEach((char, index) => {
                const el = document.createElement('span');
                el.className = 'candidate-item' + (index === 0 ? ' active' : '');
                el.textContent = `${index + 1} ${char}`;
                fragment.appendChild(el);
            });

            // 下一页按钮
            const nextNav = document.createElement('div');
            nextNav.className = 'page-nav' + (state.candidatePage >= totalPages - 1 ? ' disabled' : '');
            nextNav.dataset.nav = 'next';
            nextNav.textContent = '>';
            fragment.appendChild(nextNav);

            DOM.candidatesList.innerHTML = '';
            DOM.candidatesList.appendChild(fragment);
        },

        selectCandidate(index) {
            const items = DOM.candidatesList.querySelectorAll('.candidate-item');
            if (items[index]) {
                const text = items[index].textContent.split(' ')[1];
                return text;
            }
            return null;
        },

        getFirstCandidate() {
            return this.selectCandidate(0);
        }
    };

    // ========== UI 管理模块 ==========
    const UIManager = {
        highlightKey(keyElement) {
            if (!keyElement) return;
            keyElement.classList.add('active');
            setTimeout(() => keyElement.classList.remove('active'), 100);
        },

        toggleCapsLight(isOn) {
            DOM.capsLight.classList.toggle('on', isOn);
        },

        toggleCnLight(isOn) {
            DOM.cnLight.classList.toggle('on', isOn);
        },

        appendOutput(text) {
            if (!text) return;
            if (DOM.outputDisplay.textContent === 'Type something...') {
                DOM.outputDisplay.textContent = '';
            }
            // 全选状态下输入新内容先清空
            if (state.isAllSelected) {
                DOM.outputDisplay.textContent = '';
                state.isAllSelected = false;
                DOM.outputDisplay.classList.remove('selected');
            }
            DOM.outputDisplay.textContent += text;
            // 自动滚动到底部
            DOM.outputDisplay.scrollTop = DOM.outputDisplay.scrollHeight;
        },

        deleteLastChar() {
            if (state.isAllSelected) {
                // 全选状态下删除全部
                DOM.outputDisplay.textContent = '';
                state.isAllSelected = false;
                DOM.outputDisplay.classList.remove('selected');
            } else {
                DOM.outputDisplay.textContent = DOM.outputDisplay.textContent.slice(0, -1);
            }
        },

        selectAll() {
            state.isAllSelected = true;
            DOM.outputDisplay.classList.add('selected');
        },

        clearSelection() {
            state.isAllSelected = false;
            DOM.outputDisplay.classList.remove('selected');
        },

        toggleTheme() {
            // 主题列表: 默认赛博 → 亮色 → 樱花粉 → 森林绿 → 海洋蓝 → 默认
            const themes = ['', 'light-theme', 'sakura-theme', 'forest-theme', 'ocean-theme'];
            const icons = ['☀️', '🌸', '🌲', '🌊', '🌙'];

            // 查找当前主题
            let currentIndex = 0;
            for (let i = 0; i < themes.length; i++) {
                if (themes[i] && document.body.classList.contains(themes[i])) {
                    currentIndex = i;
                    break;
                }
            }

            // 移除所有主题类
            themes.forEach(t => t && document.body.classList.remove(t));

            // 切换到下一个主题
            const nextIndex = (currentIndex + 1) % themes.length;
            if (themes[nextIndex]) {
                document.body.classList.add(themes[nextIndex]);
            }

            // 更新按钮图标
            if (DOM.themeToggle) {
                DOM.themeToggle.textContent = icons[nextIndex];
            }
        },

        toggleSound() {
            state.soundEnabled = !state.soundEnabled;
            if (DOM.soundToggle) {
                DOM.soundToggle.textContent = state.soundEnabled ? '🔊' : '🔇';
                DOM.soundToggle.classList.toggle('off', !state.soundEnabled);
            }
        },

        showCopyFeedback() {
            // 短暂闪烁输出区表示复制成功
            DOM.outputDisplay.classList.add('copied');
            setTimeout(() => DOM.outputDisplay.classList.remove('copied'), 300);
        },

        createRipple(keyElement, event) {
            // 创建按键波纹效果
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            keyElement.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        }
    };

    // ========== 键盘控制器 ==========
    const KeyboardController = {
        shiftKeyUsed: false,

        init() {
            this.bindMouseEvents();
            this.bindKeyboardEvents();
            this.bindCandidateEvents();
            this.bindSettingsButtons();
        },

        toggleChineseMode() {
            state.isChineseMode = !state.isChineseMode;
            UIManager.toggleCnLight(state.isChineseMode);
            ChineseInput.reset();
        },

        handleInput(keyVal, isPhysical = false) {
            // 清除占位符
            if (DOM.outputDisplay.textContent === 'Type something...') {
                DOM.outputDisplay.textContent = '';
            }

            // Backspace
            if (keyVal === 'Backspace') {
                if (state.isChineseMode && ChineseInput.deleteChar()) {
                    return;
                }
                UIManager.deleteLastChar();
                return;
            }

            // Enter
            if (keyVal === 'Enter') {
                if (state.isChineseMode && state.pinyinBuffer) {
                    UIManager.appendOutput(state.pinyinBuffer);
                    ChineseInput.reset();
                    return;
                }
                UIManager.appendOutput('\n');
                return;
            }

            // Space - 选择第一个候选字
            if (keyVal === 'Space' || keyVal === ' ') {
                if (state.isChineseMode && state.pinyinBuffer) {
                    const text = ChineseInput.getFirstCandidate() || state.pinyinBuffer;
                    UIManager.appendOutput(text);
                    ChineseInput.reset();
                    return;
                }
                UIManager.appendOutput(' ');
                return;
            }

            // Tab
            if (keyVal === 'Tab') {
                UIManager.appendOutput('    ');
                return;
            }

            // CapsLock
            if (keyVal === 'CapsLock') {
                if (!isPhysical) {
                    state.capsLock = !state.capsLock;
                    UIManager.toggleCapsLight(state.capsLock);
                }
                return;
            }

            // 翻页快捷键
            if (state.isChineseMode && state.pinyinBuffer) {
                if (keyVal === '-' || keyVal === '[') {
                    ChineseInput.prevPage();
                    return;
                }
                if (keyVal === '=' || keyVal === '+' || keyVal === ']') {
                    ChineseInput.nextPage();
                    return;
                }
            }

            // 字符输入
            if (keyVal.length === 1) {
                if (state.isChineseMode) {
                    // 字母 -> 拼音
                    if (/^[a-z]$/i.test(keyVal)) {
                        ChineseInput.addChar(keyVal);
                        return;
                    }

                    // 数字 -> 选择候选字
                    if (state.pinyinBuffer && /^[1-9]$/.test(keyVal)) {
                        const text = ChineseInput.selectCandidate(parseInt(keyVal) - 1);
                        if (text) {
                            UIManager.appendOutput(text);
                            ChineseInput.reset();
                        }
                        return;
                    }

                    // 标点符号 -> 中文标点
                    if (chinesePunctuation[keyVal]) {
                        // 如果有拼音，先提交第一个候选字
                        if (state.pinyinBuffer) {
                            const text = ChineseInput.getFirstCandidate() || state.pinyinBuffer;
                            UIManager.appendOutput(text);
                            ChineseInput.reset();
                        }
                        UIManager.appendOutput(chinesePunctuation[keyVal]);
                        return;
                    }
                }

                // 普通字符输入
                const char = isPhysical ? keyVal : (state.capsLock ? keyVal.toUpperCase() : keyVal.toLowerCase());
                UIManager.appendOutput(char);
            }
        },

        bindMouseEvents() {
            DOM.keys.forEach(key => {
                key.addEventListener('mousedown', () => {
                    AudioManager.playClick();
                    UIManager.createRipple(key);

                    const keyVal = key.getAttribute('data-key') || key.innerText;
                    if (keyVal === 'Shift') {
                        this.toggleChineseMode();
                        UIManager.highlightKey(key);
                        return;
                    }
                    UIManager.highlightKey(key);
                    this.handleInput(keyVal, false);
                });
            });
        },

        bindKeyboardEvents() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+A 全选
                if (e.ctrlKey && e.key === 'a') {
                    e.preventDefault();
                    UIManager.selectAll();
                    return;
                }

                // Ctrl+C 复制
                if (e.ctrlKey && e.key === 'c') {
                    e.preventDefault();
                    const text = DOM.outputDisplay.textContent;
                    if (text && text !== 'Type something...') {
                        navigator.clipboard.writeText(text).then(() => {
                            UIManager.showCopyFeedback();
                        });
                    }
                    return;
                }

                // Ctrl+V 粘贴
                if (e.ctrlKey && e.key === 'v') {
                    e.preventDefault();
                    navigator.clipboard.readText().then(text => {
                        if (text) {
                            UIManager.appendOutput(text);
                        }
                    });
                    return;
                }

                if (!e.repeat) {
                    AudioManager.playClick();
                }

                const keyElement = document.querySelector(`.key[data-code="${e.code}"]`);
                if (keyElement) UIManager.highlightKey(keyElement);

                if (e.key === 'Shift') {
                    this.shiftKeyUsed = false;
                    return;
                } else if (e.shiftKey) {
                    this.shiftKeyUsed = true;
                }

                if (e.key === 'CapsLock') {
                    state.capsLock = e.getModifierState("CapsLock");
                    UIManager.toggleCapsLight(state.capsLock);
                } else if (e.key.length === 1 || ['Backspace', 'Enter', 'Tab'].includes(e.key)) {
                    if (e.key === 'Tab') e.preventDefault();
                    this.handleInput(e.key, true);
                }
            });

            document.addEventListener('keyup', (e) => {
                if (e.key === 'Shift' && !this.shiftKeyUsed) {
                    this.toggleChineseMode();
                }
            });
        },

        bindCandidateEvents() {
            DOM.candidatesList.addEventListener('mousedown', (e) => {
                const target = e.target;
                if (!(target instanceof HTMLElement)) return;

                if (target.classList.contains('page-nav')) {
                    if (target.classList.contains('disabled')) return;
                    if (target.dataset.nav === 'prev') ChineseInput.prevPage();
                    if (target.dataset.nav === 'next') ChineseInput.nextPage();
                    return;
                }

                if (target.classList.contains('candidate-item')) {
                    const text = target.textContent.split(' ').slice(1).join(' ');
                    AudioManager.playClick();
                    UIManager.appendOutput(text);
                    ChineseInput.reset();
                }
            });
        },

        bindSettingsButtons() {
            if (DOM.themeToggle) {
                DOM.themeToggle.addEventListener('click', UIManager.toggleTheme);
            }
            if (DOM.soundToggle) {
                DOM.soundToggle.addEventListener('click', UIManager.toggleSound);
            }
        }
    };

    // ========== 初始化 ==========
    AudioManager.init();
    KeyboardController.init();
});
