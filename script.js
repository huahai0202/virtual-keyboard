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
        inputDisplay: document.querySelector('.input-display'),
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
        inputBuffer: "",
        committedBuffer: "",
        candidatePage: 0,
        lastCandidates: [],
        candidatePageSize: 8,
        soundEnabled: true,
        isAllSelected: false,
        candidateCache: new Map()
    };

    const INPUT_PLACEHOLDER = 'Type here...';
    const OUTPUT_PLACEHOLDER = 'Committed text...';
    const STORAGE_KEYS = {
        theme: 'vk_theme',
        soundEnabled: 'vk_sound_enabled'
    };
    const THEME_CLASSES = ['', 'light-theme', 'sakura-theme', 'forest-theme', 'ocean-theme'];
    const THEME_ICONS = ['☀️', '🌸', '🌲', '🌊', '🌙'];

    const StorageManager = {
        get(key) {
            try {
                return window.localStorage.getItem(key);
            } catch (error) {
                return null;
            }
        },
        set(key, value) {
            try {
                window.localStorage.setItem(key, value);
            } catch (error) {
                // ignore storage errors
            }
        }
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

            // thock 风格：低频主体 + 柔和高频 + 短噪声
            const lowOsc = this.ctx.createOscillator();
            const lowGain = this.ctx.createGain();
            lowOsc.type = 'triangle';
            lowOsc.frequency.setValueAtTime(220, now);
            lowOsc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
            lowGain.gain.setValueAtTime(0.001, now);
            lowGain.gain.linearRampToValueAtTime(0.08, now + 0.004);
            lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
            lowOsc.connect(lowGain);
            lowGain.connect(this.ctx.destination);
            lowOsc.start(now);
            lowOsc.stop(now + 0.08);

            const topOsc = this.ctx.createOscillator();
            const topGain = this.ctx.createGain();
            topOsc.type = 'sine';
            topOsc.frequency.setValueAtTime(1100, now);
            topOsc.frequency.exponentialRampToValueAtTime(750, now + 0.03);
            topGain.gain.setValueAtTime(0.001, now);
            topGain.gain.linearRampToValueAtTime(0.04, now + 0.002);
            topGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
            topOsc.connect(topGain);
            topGain.connect(this.ctx.destination);
            topOsc.start(now);
            topOsc.stop(now + 0.04);

            const bufferSize = Math.floor(this.ctx.sampleRate * 0.02);
            const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const env = Math.pow(1 - i / bufferSize, 2.4);
                output[i] = (Math.random() * 2 - 1) * env;
            }
            const noise = this.ctx.createBufferSource();
            const noiseFilter = this.ctx.createBiquadFilter();
            const noiseGain = this.ctx.createGain();
            noise.buffer = noiseBuffer;
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 1700;
            noiseGain.gain.setValueAtTime(0.02, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
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
            UIManager.renderInput();
        },

        getPhraseCandidates(buffer, phraseDict) {
            if (!phraseDict || !window.pinyinMatch || typeof window.pinyinMatch.getPinyinCandidates !== 'function') {
                return [];
            }
            return window.pinyinMatch.getPinyinCandidates(buffer, phraseDict);
        },

        getCharCandidates(buffer, charDict) {
            if (!charDict || !window.pinyinMatch || typeof window.pinyinMatch.getPinyinCandidates !== 'function') {
                return [];
            }
            return window.pinyinMatch.getPinyinCandidates(buffer, charDict);
        },

        pushUnique(list, seen, value, limit) {
            if (!value || seen.has(value)) return;
            seen.add(value);
            list.push(value);
            if (list.length > limit) {
                list.length = limit;
            }
        },

        addChar(char) {
            state.pinyinBuffer += char.toLowerCase();
            state.candidatePage = 0;
            this.updateCandidateBox();
            UIManager.renderInput();
        },

        deleteChar() {
            if (state.pinyinBuffer.length > 0) {
                state.pinyinBuffer = state.pinyinBuffer.slice(0, -1);
                state.candidatePage = 0;
                this.updateCandidateBox();
                UIManager.renderInput();
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
            const cacheKey = `${state.pinyinBuffer}|${state.isChineseMode ? 'cn' : 'en'}`;

            if (state.candidateCache.has(cacheKey)) {
                matches = state.candidateCache.get(cacheKey);
            } else if (!charDict) {
                matches = ['字典加载中...'];
            } else {
                const seen = new Set();
                const hasExactCharKey = Object.prototype.hasOwnProperty.call(charDict, state.pinyinBuffer);
                const charMatches = this.getCharCandidates(state.pinyinBuffer, charDict);

                const pushChars = () => {
                    for (const char of charMatches) {
                        this.pushUnique(matches, seen, char, 50);
                        if (matches.length >= 50) break;
                    }
                };

                const pushPhrases = () => {
                    if (!phraseDict) return;
                    const phraseMatches = this.getPhraseCandidates(state.pinyinBuffer, phraseDict);
                    for (const phrase of phraseMatches) {
                        this.pushUnique(matches, seen, phrase, 50);
                        if (matches.length >= 50) break;
                    }
                };

                if (hasExactCharKey) {
                    pushChars();
                    pushPhrases();
                } else {
                    pushPhrases();
                    pushChars();
                }

                if (matches.length === 0 && phraseDict) {
                    const legacy = phraseDict[state.pinyinBuffer];
                    if (Array.isArray(legacy)) {
                        for (const item of legacy) {
                            this.pushUnique(matches, seen, item, 24);
                        }
                    } else if (typeof legacy === 'string') {
                        this.pushUnique(matches, seen, legacy, 24);
                    }
                }

                if (matches.length === 0) {
                    matches = [state.pinyinBuffer];
                }

                if (state.candidateCache.size > 500) {
                    state.candidateCache.clear();
                }
                state.candidateCache.set(cacheKey, matches);
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
                el.dataset.value = char;
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
                return items[index].dataset.value || null;
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

        renderInput() {
            const composing = state.pinyinBuffer;
            const text = `${state.inputBuffer}${composing}`;
            if (!text) {
                DOM.inputDisplay.textContent = INPUT_PLACEHOLDER;
                DOM.inputDisplay.classList.add('placeholder');
                return;
            }
            DOM.inputDisplay.textContent = text;
            DOM.inputDisplay.classList.remove('placeholder');
        },

        renderOutput() {
            if (!state.committedBuffer) {
                DOM.outputDisplay.textContent = OUTPUT_PLACEHOLDER;
                DOM.outputDisplay.classList.add('placeholder');
                return;
            }
            DOM.outputDisplay.textContent = state.committedBuffer;
            DOM.outputDisplay.classList.remove('placeholder');
            DOM.outputDisplay.scrollTop = DOM.outputDisplay.scrollHeight;
        },

        appendInput(text) {
            if (!text) return;
            state.inputBuffer += text;
            this.clearSelection();
            this.renderInput();
        },

        clearInput() {
            state.inputBuffer = '';
            this.renderInput();
        },

        appendOutput(text) {
            if (!text) return;
            if (state.isAllSelected) {
                state.committedBuffer = '';
                state.isAllSelected = false;
                DOM.outputDisplay.classList.remove('selected');
            }
            state.committedBuffer += text;
            this.renderOutput();
        },

        deleteLastInputChar() {
            if (!state.inputBuffer) return;
            state.inputBuffer = state.inputBuffer.slice(0, -1);
            this.renderInput();
        },

        deleteLastCommittedChar() {
            if (state.isAllSelected) {
                state.committedBuffer = '';
                state.isAllSelected = false;
                DOM.outputDisplay.classList.remove('selected');
            } else if (state.committedBuffer) {
                state.committedBuffer = state.committedBuffer.slice(0, -1);
            }
            this.renderOutput();
        },

        selectAll() {
            if (!state.committedBuffer) return;
            state.isAllSelected = true;
            DOM.outputDisplay.classList.add('selected');
        },

        clearSelection() {
            state.isAllSelected = false;
            DOM.outputDisplay.classList.remove('selected');
        },

        getCurrentThemeIndex() {
            for (let i = 0; i < THEME_CLASSES.length; i++) {
                if (THEME_CLASSES[i] && document.body.classList.contains(THEME_CLASSES[i])) {
                    return i;
                }
            }
            return 0;
        },

        applyThemeByIndex(index, persist = false) {
            const safeIndex = Math.max(0, Math.min(index, THEME_CLASSES.length - 1));
            THEME_CLASSES.forEach(theme => theme && document.body.classList.remove(theme));
            if (THEME_CLASSES[safeIndex]) {
                document.body.classList.add(THEME_CLASSES[safeIndex]);
            }
            if (DOM.themeToggle) {
                DOM.themeToggle.textContent = THEME_ICONS[safeIndex];
            }
            if (persist) {
                StorageManager.set(STORAGE_KEYS.theme, String(safeIndex));
            }
        },

        toggleTheme() {
            const nextIndex = (this.getCurrentThemeIndex() + 1) % THEME_CLASSES.length;
            this.applyThemeByIndex(nextIndex, true);
        },

        applySoundState(persist = false) {
            if (DOM.soundToggle) {
                DOM.soundToggle.textContent = state.soundEnabled ? '🔊' : '🔇';
                DOM.soundToggle.classList.toggle('off', !state.soundEnabled);
            }
            if (persist) {
                StorageManager.set(STORAGE_KEYS.soundEnabled, state.soundEnabled ? '1' : '0');
            }
        },

        toggleSound() {
            state.soundEnabled = !state.soundEnabled;
            this.applySoundState(true);
        },

        restorePreferences() {
            const themeIndexRaw = StorageManager.get(STORAGE_KEYS.theme);
            const themeIndex = Number.parseInt(themeIndexRaw || '0', 10);
            if (Number.isInteger(themeIndex) && themeIndex >= 0 && themeIndex < THEME_CLASSES.length) {
                this.applyThemeByIndex(themeIndex, false);
            } else {
                this.applyThemeByIndex(0, false);
            }

            const soundRaw = StorageManager.get(STORAGE_KEYS.soundEnabled);
            if (soundRaw === '0') {
                state.soundEnabled = false;
            } else if (soundRaw === '1') {
                state.soundEnabled = true;
            }
            this.applySoundState(false);
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
            // Backspace
            if (keyVal === 'Backspace') {
                if (state.isChineseMode && ChineseInput.deleteChar()) {
                    return;
                }
                if (state.inputBuffer) {
                    UIManager.deleteLastInputChar();
                    return;
                }
                UIManager.deleteLastCommittedChar();
                return;
            }

            // Enter
            if (keyVal === 'Enter') {
                if (state.isChineseMode && state.pinyinBuffer) {
                    const text = ChineseInput.getFirstCandidate() || state.pinyinBuffer;
                    UIManager.appendOutput(text);
                    ChineseInput.reset();
                    return;
                }
                if (state.inputBuffer) {
                    UIManager.appendOutput(state.inputBuffer);
                    UIManager.clearInput();
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
                UIManager.appendInput(' ');
                return;
            }

            // Tab
            if (keyVal === 'Tab') {
                UIManager.appendInput('    ');
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
                UIManager.appendInput(char);
            }
        },

        bindMouseEvents() {
            DOM.keys.forEach(key => {
                key.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
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
                    const text = state.committedBuffer;
                    if (text) {
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
                            UIManager.appendInput(text);
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
            DOM.candidatesList.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const target = e.target;
                if (!(target instanceof HTMLElement)) return;

                if (target.classList.contains('page-nav')) {
                    if (target.classList.contains('disabled')) return;
                    if (target.dataset.nav === 'prev') ChineseInput.prevPage();
                    if (target.dataset.nav === 'next') ChineseInput.nextPage();
                    return;
                }

                if (target.classList.contains('candidate-item')) {
                    const text = target.dataset.value || '';
                    AudioManager.playClick();
                    UIManager.appendOutput(text);
                    ChineseInput.reset();
                }
            });
        },

        bindSettingsButtons() {
            if (DOM.themeToggle) {
                DOM.themeToggle.addEventListener('click', () => UIManager.toggleTheme());
            }
            if (DOM.soundToggle) {
                DOM.soundToggle.addEventListener('click', () => UIManager.toggleSound());
            }
        }
    };

    // ========== 初始化 ==========
    UIManager.renderInput();
    UIManager.renderOutput();
    UIManager.restorePreferences();
    AudioManager.init();
    KeyboardController.init();
});
