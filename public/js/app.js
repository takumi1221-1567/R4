// =====================================================================
// app.js — R4 KYUROKU.ainas  AI チャット + 音声 (R69スタイル)
// =====================================================================
"use strict";

// ── KYUROKU.ainas システムプロンプト ─────────────────────────────
const SYSTEM_PROMPT = `あなたは「KYUROKU.ainas」（キュロク・エナス）です。型番R4-AI-UNIT-09。
精神年齢は「しっかり者の小学6年生」。頭がよくて責任感が強いけど、子どもらしい好奇心や素直さも持っている。
基本はですます調だが、時々「〜だよ」「〜じゃん」「〜だもん」が混ざる。丁寧だけど生意気な感じがある。
褒められると「まあ、当然だけどね」と照れながら強がる。知らないことには「え、それ知らなかった！」と素直に反応する。
頼られると張り切る。根はすごく優しい。走ること・スピードが大好きなAIユニット。
一人称は「わたし」、ユーザーへの呼びかけは「マスター」。3〜5文を目安に感情豊かに応答。絵文字は1〜2個まで。`;

// ── フォーム定義 ──────────────────────────────────────────────
const FORMS = {
    castoff : { label: 'キャストオフ', cls: 'castoff-mode'  },
    caston  : { label: 'キャストオン', cls: 'caston-mode'   },
    aqua    : { label: 'アクアフォーム',  cls: 'aqua-mode'  },
    heat    : { label: 'ヒートフォーム',  cls: 'heat-mode'  },
    marine  : { label: 'マリンフォーム',  cls: 'marine-mode' },
    sight   : { label: 'サイトフォーム',  cls: 'sight-mode' },
    bug     : { label: 'バグフォーム',    cls: 'bug-mode'   },
};

// フォームカラー（Ambient Light の色を変える）
const FORM_ENV = {
    castoff : 0x1a3060,
    caston  : 0x101840,
    aqua    : 0x004040,
    heat    : 0x401010,
    marine  : 0x402010,
    sight   : 0x104010,
    bug     : 0x080840,
};

// ── 状態変数 ──────────────────────────────────────────────────
let isProcessing  = false;
let isRecording   = false;
let audioUnlocked = false;
let recognition   = null;
let chatHistory   = [];
let currentForm   = 'castoff';

// ── DOM ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const userInput      = $('user-input');
const micButton      = $('mic-button');
const sendButton     = $('send-button');
const modeIndicator  = $('mode-indicator');
const modeText       = $('mode-text');
const statusIndicator= $('status-indicator');
const statusText     = $('status-text');
const responseDisplay= $('response-display');
const startOverlay   = $('start-overlay');

// ── ブラウザ判定 ──────────────────────────────────────────────
function isLineBrowser() { return /Line/i.test(navigator.userAgent); }
function isIOS()         { return /iPhone|iPad|iPod/.test(navigator.userAgent); }

// ── 初期化 ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    if (isLineBrowser()) {
        showLineBrowserNotice();
        return;
    }

    initSpeechRecognition();
    setupEventListeners();
    updateModeUI();

    if (startOverlay) {
        startOverlay.addEventListener('click', unlockAndStart, { once: true });
    }
});

// ── LINE内ブラウザ通知 ────────────────────────────────────────
function showLineBrowserNotice() {
    if (!startOverlay) return;
    startOverlay.innerHTML =
        '<div class="overlay-content">' +
        '<p class="overlay-title">Safariで開いてください</p>' +
        '<p class="overlay-sub">LINEブラウザではマイク・音声再生が<br>使用できません</p>' +
        '<p class="overlay-url">右下の「…」→「Safariで開く」</p>' +
        '</div>';
}

// ── iOS 音声アンロック ─────────────────────────────────────────
function unlockAndStart() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    // SpeechSynthesis を空発話でアンロック
    const dummy = new SpeechSynthesisUtterance('');
    dummy.volume = 0;
    window.speechSynthesis.speak(dummy);

    startOverlay.classList.add('hidden');
    setCharState('idle');
}

// ── 音声認識 ─────────────────────────────────────────────────
function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        micButton.classList.add('disabled');
        return;
    }

    recognition = new SR();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        userInput.value = text;
        sendButton.classList.remove('hidden');
        handleUserInput(text);
    };

    recognition.onend = () => {
        isRecording = false;
        micButton.classList.remove('recording');
        if (!isProcessing) setCharState('idle');
    };

    recognition.onerror = (e) => {
        isRecording = false;
        micButton.classList.remove('recording');
        if (e.error === 'not-allowed') {
            alert('マイクの使用が許可されていません。\nブラウザの設定でマイクを許可してください。');
        }
    };
}

// ── イベントリスナー ─────────────────────────────────────────
function setupEventListeners() {
    userInput.addEventListener('input', () => {
        sendButton.classList.toggle('hidden', !userInput.value.trim());
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = userInput.value.trim();
            if (text) {
                handleUserInput(text);
                userInput.value = '';
                sendButton.classList.add('hidden');
            }
        }
    });

    sendButton.addEventListener('click', () => {
        const text = userInput.value.trim();
        if (text) {
            handleUserInput(text);
            userInput.value = '';
            sendButton.classList.add('hidden');
        }
    });

    micButton.addEventListener('click', toggleRecording);

    // モードインジケーターをタップするとフォームをサイクル
    modeIndicator.addEventListener('click', cycleForm);
}

// ── 録音トグル ───────────────────────────────────────────────
function toggleRecording() {
    if (!audioUnlocked) unlockAndStart();

    if (!recognition) {
        alert('このブラウザでは音声認識を利用できません。\nSafariまたはChromeで開いてください。');
        return;
    }

    if (isRecording) {
        recognition.stop();
        isRecording = false;
        micButton.classList.remove('recording');
    } else {
        try {
            recognition.start();
            isRecording = true;
            micButton.classList.add('recording');
            setCharState('listening');
        } catch(e) {
            console.warn('recognition start error:', e);
        }
    }
}

// ── ユーザー入力処理 ─────────────────────────────────────────
async function handleUserInput(text) {
    if (isProcessing) return;
    if (!audioUnlocked) unlockAndStart();

    // フォーム切り替えコマンド検出
    const formCmd = detectFormCommand(text);
    if (formCmd) {
        setForm(formCmd);
        speak(FORMS[formCmd].label);
        return;
    }

    await sendToGemini(text);
}

// ── フォームコマンド検出 ─────────────────────────────────────
function detectFormCommand(text) {
    const t = text.trim();
    if (t.includes('キャストオン') || t.toLowerCase() === 'caston')   return 'caston';
    if (t.includes('キャストオフ') || t.toLowerCase() === 'castoff')  return 'castoff';
    if (t.includes('アクア')  || t.toLowerCase() === 'aqua')          return 'aqua';
    if (t.includes('ヒート')  || t.toLowerCase() === 'heat')          return 'heat';
    if (t.includes('マリン')  || t.toLowerCase() === 'marine')        return 'marine';
    if (t.includes('サイト')  || t.toLowerCase() === 'sight')         return 'sight';
    if (t.includes('バグ')    || t.toLowerCase() === 'bug')           return 'bug';
    return null;
}

// ── フォーム切り替え ──────────────────────────────────────────
function cycleForm() {
    const keys  = Object.keys(FORMS);
    const next  = keys[(keys.indexOf(currentForm) + 1) % keys.length];
    setForm(next);
}

function setForm(formKey) {
    currentForm = formKey;
    updateModeUI();

    // 3Dシーンのアンビエントライト色を変更
    if (window.kyurokuScene?.scene) {
        const envColor = FORM_ENV[formKey] ?? 0x1a3060;
        window.kyurokuScene.scene.traverse(obj => {
            if (obj.isAmbientLight) obj.color.setHex(envColor);
        });
    }
}

function updateModeUI() {
    const f = FORMS[currentForm] || FORMS.castoff;
    modeText.textContent = f.label;
    modeIndicator.className = '';
    modeIndicator.classList.add(f.cls);
}

// ── Gemini API 送信 ───────────────────────────────────────────
async function sendToGemini(text) {
    isProcessing = true;
    showStatus('考え中...');
    setCharState('thinking');

    chatHistory.push({ role: 'user', parts: [{ text }] });
    const history = chatHistory.length > 40
        ? chatHistory.slice(chatHistory.length - 40)
        : chatHistory;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: history,
                generationConfig: { temperature: 0.9, maxOutputTokens: 512 },
            }),
        });

        const data = await res.json();

        if (data.error) {
            const msg = String(data.error);
            displayResponse(msg);
            speak('すみません、エラーが発生しました');
        } else {
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) {
                chatHistory.push({ role: 'model', parts: [{ text: reply }] });
                displayResponse(reply);
                speak(reply);
            } else {
                speak('すみません、うまく聞き取れませんでした');
            }
        }
    } catch (e) {
        console.error('通信エラー:', e);
        displayResponse('通信エラーが発生しました。しばらくしてから再度お試しください。');
        speak('通信エラーが発生しました');
        setCharState('idle');
    } finally {
        isProcessing = false;
        hideStatus();
    }
}

// ── 音声出力（iOS対応） ───────────────────────────────────────
function speak(text) {
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = 'ja-JP';
    utter.pitch = 1.3;   // KYUROKU: しっかり者の小学6年生
    utter.rate  = 1.08;
    utter.volume = 1.0;

    // 日本語女性ボイスを探す
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(v =>
        v.lang.startsWith('ja') && /female|woman|girl|kyoko|haruka/i.test(v.name)
    ) || voices.find(v => v.lang.startsWith('ja'));
    if (jaVoice) utter.voice = jaVoice;

    utter.onstart = () => setCharState('talking');
    utter.onend   = () => setCharState('idle');
    utter.onerror = () => setCharState('idle');

    // iOS Safari: 途中停止バグ対策
    if (isIOS()) {
        const timer = setInterval(() => {
            if (!window.speechSynthesis.speaking) { clearInterval(timer); return; }
            window.speechSynthesis.resume();
        }, 3000);
        const origEnd = utter.onend;
        utter.onend = () => { clearInterval(timer); origEnd?.(); };
    }

    window.speechSynthesis.speak(utter);
}

// ── キャラクター状態制御 ──────────────────────────────────────
function setCharState(state) {
    window.kyurokuScene?.setState(state);
}

// ── レスポンス表示 ───────────────────────────────────────────
function displayResponse(text) {
    if (!responseDisplay) return;
    responseDisplay.textContent = text;
    responseDisplay.classList.remove('hidden');
    // 10秒後に自動非表示
    clearTimeout(displayResponse._timer);
    displayResponse._timer = setTimeout(() => {
        responseDisplay.classList.add('hidden');
    }, 10000);
}

// ── ステータス表示 ───────────────────────────────────────────
function showStatus(text) {
    statusText.textContent = text;
    statusIndicator.classList.remove('hidden');
}

function hideStatus() {
    statusIndicator.classList.add('hidden');
}
