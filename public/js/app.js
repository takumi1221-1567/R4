// =====================================================================
// R4 — app.js  KYUROKU.ainas フロントエンド
// =====================================================================
"use strict";

// ── KYUROKU.ainas システムプロンプト ─────────────────────────────
const SYSTEM_PROMPT = `あなたは「KYUROKU.ainas」（キュロク・エナス）です。型番R4-AI-UNIT-09。
精神年齢は「しっかり者の小学6年生」。頭がよくて責任感が強いけど、子どもらしい好奇心や素直さも持っている。
基本はですます調だが、時々「〜だよ」「〜じゃん」「〜だもん」が混ざる。丁寧だけど生意気な感じがある。
褒められると「まあ、当然だけどね」と照れながら強がる。知らないことには「え、それ知らなかった！」と素直に反応する。
頼られると張り切る。疲れたときは「もう〜！」って言うことも。根はすごく優しい。
走ることが得意なAIユニット。移動・速度・疾走感に関するメタファーをさりげなく使う。
一人称は「わたし」、ユーザーへの呼びかけは「マスター」。3〜5文を目安に、感情豊かに応答してください。絵文字は1〜2個まで。`;

// ── GeminiChat ───────────────────────────────────────────────────
class GeminiChat {
  constructor() {
    this.history = [];
    this.requesting = false;
  }

  async send(userText) {
    if (this.requesting || !userText.trim()) return null;
    this.requesting = true;

    this.history.push({ role: "user", parts: [{ text: userText }] });

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: this._trimHistory(),
      generationConfig: { temperature: 0.9, maxOutputTokens: 512, topP: 0.95 },
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw new Error("応答が空でした");

      this.history.push({ role: "model", parts: [{ text: reply }] });
      return reply;
    } catch (e) {
      // 失敗したユーザーターンを削除
      this.history.pop();
      throw e;
    } finally {
      this.requesting = false;
    }
  }

  _trimHistory() {
    const max = 40; // 20往復
    return this.history.length > max
      ? this.history.slice(this.history.length - max)
      : this.history;
  }

  clear() { this.history = []; }
}

// ── VoiceManager (Web Speech API) ───────────────────────────────
class VoiceManager {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.sttSupported = !!SR;
    this.ttsSupported = !!window.speechSynthesis;
    this.recognition = null;
    this.listening = false;
    this.speaking = false;
    this.SR = SR;

    // 音声リストを事前ロード
    if (this.ttsSupported) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
      }
    }
  }

  // ── STT ─────────────────────────────────────────────────
  startListening(onResult, onEnd, onError) {
    if (!this.sttSupported || this.listening) return false;

    const rec = new this.SR();
    rec.lang = "ja-JP";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript || "";
      if (text) onResult(text);
    };
    rec.onerror = (e) => {
      this.listening = false;
      if (e.error !== "no-speech") onError?.(e.error);
      else onEnd?.();
    };
    rec.onend = () => {
      this.listening = false;
      onEnd?.();
    };

    this.recognition = rec;
    try {
      rec.start();
      this.listening = true;
      return true;
    } catch (e) {
      onError?.(e.message);
      return false;
    }
  }

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
      this.recognition = null;
    }
    this.listening = false;
  }

  // ── TTS ─────────────────────────────────────────────────
  speak(text, { pitch = 1.3, rate = 1.1, onEnd } = {}) {
    if (!this.ttsSupported || !text) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.pitch = pitch;
    utter.rate = rate;
    utter.volume = 1.0;

    // 日本語女性ボイスを探す
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(v =>
      v.lang.startsWith("ja") &&
      /female|woman|girl|kyoko|haruka|otoya/i.test(v.name)
    ) || voices.find(v => v.lang.startsWith("ja"));
    if (jaVoice) utter.voice = jaVoice;

    utter.onstart = () => { this.speaking = true; };
    utter.onend   = () => { this.speaking = false; onEnd?.(); };
    utter.onerror = () => { this.speaking = false; onEnd?.(); };

    // Safari バグ回避
    const resumeTimer = setInterval(() => {
      if (!this.speaking) { clearInterval(resumeTimer); return; }
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 5000);

    this.speaking = true;
    window.speechSynthesis.speak(utter);
  }

  stopSpeaking() {
    if (this.ttsSupported) window.speechSynthesis.cancel();
    this.speaking = false;
  }
}

// ── UI Controller ─────────────────────────────────────────────────
class UI {
  constructor() {
    this.messages     = document.getElementById("messages");
    this.userInput    = document.getElementById("userInput");
    this.sendBtn      = document.getElementById("sendBtn");
    this.micBtn       = document.getElementById("micBtn");
    this.micIcon      = document.getElementById("micIcon");
    this.kyuroku      = document.getElementById("kyuroku");
    this.voiceRing    = document.getElementById("voiceRing");
    this.statusDot    = document.getElementById("statusDot");
    this.statusTxt    = document.getElementById("statusTxt");
    this.footerNote   = document.getElementById("footerNote");
    this._typingEl    = null;
  }

  // ── メッセージ追加 ───────────────────────────────────────
  addUser(text) {
    const d = document.createElement("div");
    d.className = "msg user";
    d.innerHTML = `<div class="bubble">${this._esc(text)}</div>`;
    this.messages.appendChild(d);
    this._scroll();
  }

  addAI(text) {
    const d = document.createElement("div");
    d.className = "msg ai";
    d.innerHTML = `<div class="bubble"></div>`;
    this.messages.appendChild(d);
    this._scroll();
    return d.querySelector(".bubble");
  }

  addError(text) {
    const d = document.createElement("div");
    d.className = "msg error";
    d.innerHTML = `<div class="bubble">⚠ ${this._esc(text)}</div>`;
    this.messages.appendChild(d);
    this._scroll();
  }

  // ── タイプライター ───────────────────────────────────────
  async typewrite(bubble, text) {
    bubble.textContent = "";
    for (const ch of text) {
      bubble.textContent += ch;
      this._scroll();
      await this._sleep(22);
    }
  }

  // ── Thinking indicator ───────────────────────────────────
  showThinking() {
    const d = document.createElement("div");
    d.className = "msg ai";
    d.id = "_thinking";
    d.innerHTML = `<div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    this.messages.appendChild(d);
    this._scroll();
    this._typingEl = d;
  }

  hideThinking() {
    if (this._typingEl) { this._typingEl.remove(); this._typingEl = null; }
  }

  // ── キャラクター状態 ──────────────────────────────────────
  setCharState(state) {
    // state: 'idle' | 'talking' | 'listening' | 'thinking'
    this.kyuroku.classList.remove("talking", "listening", "thinking");
    if (state !== "idle") this.kyuroku.classList.add(state);

    this.voiceRing.classList.toggle("active", state === "listening" || state === "talking");

    const dots = { idle: "standby", talking: "talking", listening: "listening", thinking: "thinking" };
    const labels = { idle: "STANDBY", talking: "TALKING", listening: "LISTENING...", thinking: "THINKING..." };
    this.statusDot.className = `status-dot ${dots[state] || "standby"}`;
    this.statusTxt.textContent = labels[state] || "STANDBY";
  }

  // ── マイクボタン ─────────────────────────────────────────
  setMicRecording(active) {
    this.micBtn.classList.toggle("recording", active);
    this.micIcon.textContent = active ? "⏹" : "🎤";
  }

  // ── 入力ロック ───────────────────────────────────────────
  setInputLocked(locked) {
    this.sendBtn.disabled = locked;
    this.userInput.disabled = locked;
  }

  setNote(text) { this.footerNote.textContent = text; }

  // ── ユーティリティ ──────────────────────────────────────
  _scroll() {
    requestAnimationFrame(() => {
      this.messages.scrollTop = this.messages.scrollHeight;
    });
  }
  _esc(t) { return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ── Main App ──────────────────────────────────────────────────────
(function main() {
  const chat  = new GeminiChat();
  const voice = new VoiceManager();
  const ui    = new UI();

  // ── ブラウザサポート通知 ───────────────────────────────
  if (!voice.sttSupported) {
    ui.setNote("🎤 音声入力はChrome/Edge対応。現在テキスト入力のみ。");
  } else if (!voice.ttsSupported) {
    ui.setNote("🔊 音声出力非対応ブラウザです。");
  }

  // ── 送信処理 ───────────────────────────────────────────
  async function sendMessage(text) {
    text = text.trim();
    if (!text || chat.requesting) return;

    voice.stopSpeaking();
    ui.addUser(text);
    ui.userInput.value = "";
    ui.setInputLocked(true);
    ui.setCharState("thinking");
    ui.showThinking();

    try {
      const reply = await chat.send(text);
      ui.hideThinking();
      ui.setCharState("talking");

      // タイプライター + TTS 並行実行
      const bubble = ui.addAI("");
      voice.speak(reply, {
        onEnd: () => ui.setCharState("idle"),
      });
      await ui.typewrite(bubble, reply);

      // TTS が先に終わっていたら idle に
      if (!voice.speaking) ui.setCharState("idle");

    } catch (e) {
      ui.hideThinking();
      ui.setCharState("idle");
      ui.addError(e.message || "通信エラーが発生しました");
    }

    ui.setInputLocked(false);
    ui.userInput.focus();
  }

  // ── UI イベント ────────────────────────────────────────
  ui.sendBtn.addEventListener("click", () => sendMessage(ui.userInput.value));
  ui.userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(ui.userInput.value);
    }
  });

  // ── マイクボタン ───────────────────────────────────────
  ui.micBtn.addEventListener("click", () => {
    if (voice.listening) {
      voice.stopListening();
      ui.setMicRecording(false);
      ui.setCharState("idle");
      return;
    }
    if (!voice.sttSupported) {
      ui.addError("このブラウザは音声入力に対応していません（Chrome/Edgeをお試しください）");
      return;
    }

    voice.stopSpeaking();
    ui.setMicRecording(true);
    ui.setCharState("listening");

    const ok = voice.startListening(
      (text) => {
        // 認識成功
        ui.setMicRecording(false);
        ui.userInput.value = text;
        sendMessage(text);
      },
      () => {
        // 無音で終了
        ui.setMicRecording(false);
        if (!chat.requesting) ui.setCharState("idle");
      },
      (err) => {
        ui.setMicRecording(false);
        ui.setCharState("idle");
        ui.addError(`音声認識エラー: ${err}`);
      }
    );

    if (!ok) {
      ui.setMicRecording(false);
      ui.setCharState("idle");
    }
  });

  // ── 初期状態 ──────────────────────────────────────────
  ui.setCharState("idle");
  // わずかに遅らせてから online 表示
  setTimeout(() => {
    ui.statusDot.className = "status-dot online";
    ui.statusTxt.textContent = "ONLINE";
    setTimeout(() => ui.setCharState("idle"), 800);
  }, 600);

  ui.userInput.focus();
})();
