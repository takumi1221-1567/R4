// =====================================================================
// WebSpeech.jslib — R4 Project
// Web Speech API (STT + TTS) ブリッジ for Unity WebGL
// =====================================================================
// ブラウザ対応:
//   STT: Chrome / Edge (✅)  Firefox (❌)  Safari 17.4+ (△)
//   TTS: Chrome / Edge / Safari / Firefox (✅ 概ね対応)
// =====================================================================

var WebSpeechPlugin = {

    // ── 共有ステート ──────────────────────────────────────────────
    $R4Voice: {
        // STT
        recognition  : null,
        status       : 0,    // 0=idle 1=listening 2=recognized 3=error 4=ended
        resultText   : "",
        errorMsg     : "",
        // TTS
        synth        : null,
        speaking     : false,
        voicesReady  : false
    },

    // ── 初期化 ────────────────────────────────────────────────────
    JS_Voice_Init: function() {
        R4Voice.synth = window.speechSynthesis || null;

        // TTS ボイスリストを事前ロード（非同期対策）
        if (R4Voice.synth) {
            var loadVoices = function() {
                R4Voice.synth.getVoices();
                R4Voice.voicesReady = true;
            };
            if (R4Voice.synth.onvoiceschanged !== undefined) {
                R4Voice.synth.onvoiceschanged = loadVoices;
            }
            // 既にロード済みの場合も対応
            if (R4Voice.synth.getVoices().length > 0) {
                R4Voice.voicesReady = true;
            }
            // フォールバック: 1秒後に強制ロード
            setTimeout(loadVoices, 1000);
        }
    },

    // ── 音声認識 (STT) ───────────────────────────────────────────

    JS_Voice_IsRecognitionSupported: function() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition) ? 1 : 0;
    },

    JS_Voice_IsSynthesisSupported: function() {
        return !!window.speechSynthesis ? 1 : 0;
    },

    JS_Voice_StartRecognition: function() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            R4Voice.status   = 3;
            R4Voice.errorMsg = "unsupported";
            return 0;
        }

        // 既存セッションを停止
        if (R4Voice.recognition) {
            try { R4Voice.recognition.abort(); } catch(e) {}
            R4Voice.recognition = null;
        }

        var rec = new SR();
        rec.lang            = 'ja-JP';
        rec.continuous      = false;
        rec.interimResults  = false;
        rec.maxAlternatives = 1;

        rec.onstart = function() {
            R4Voice.status = 1;
        };

        rec.onresult = function(event) {
            if (event.results.length > 0 && event.results[0].length > 0) {
                R4Voice.resultText = event.results[0][0].transcript;
                R4Voice.status     = 2;
            }
        };

        rec.onerror = function(event) {
            // "no-speech" はエラーではなく単なる無音扱い
            if (event.error === 'no-speech') {
                R4Voice.status = 4; // ended
            } else {
                R4Voice.errorMsg = event.error;
                R4Voice.status   = 3;
            }
        };

        rec.onend = function() {
            // onresult が先に来ている場合はそちら優先
            if (R4Voice.status === 1) {
                R4Voice.status = 4; // 結果なしで終了
            }
            R4Voice.recognition = null;
        };

        R4Voice.recognition = rec;
        try {
            rec.start();
            return 1;
        } catch(e) {
            R4Voice.status   = 3;
            R4Voice.errorMsg = e.message;
            return 0;
        }
    },

    JS_Voice_StopRecognition: function() {
        if (R4Voice.recognition) {
            try { R4Voice.recognition.stop(); } catch(e) {}
            R4Voice.recognition = null;
        }
        if (R4Voice.status === 1) R4Voice.status = 4;
    },

    JS_Voice_GetStatus: function() {
        return R4Voice.status;
    },

    JS_Voice_ResetStatus: function() {
        R4Voice.status     = 0;
        R4Voice.resultText = "";
        R4Voice.errorMsg   = "";
    },

    // テキストをバッファにコピーして文字数を返す
    JS_Voice_GetRecognizedText: function(buffer, size) {
        var text = R4Voice.resultText;
        R4Voice.resultText = "";
        if (size > 0 && buffer !== 0) {
            stringToUTF8(text, buffer, size);
        }
        return lengthBytesUTF8(text);
    },

    // ── 音声合成 (TTS) ───────────────────────────────────────────

    JS_Voice_Speak: function(textPtr, pitch, rate) {
        if (!R4Voice.synth) return;
        var text = UTF8ToString(textPtr);
        if (!text || text.length === 0) return;

        // 再生中なら止める
        R4Voice.synth.cancel();

        var utter = new SpeechSynthesisUtterance(text);
        utter.lang   = 'ja-JP';
        utter.pitch  = pitch;   // KYUROKU: 1.3 (子どもらしい高め)
        utter.rate   = rate;    // KYUROKU: 1.1 (少し早め・活発)
        utter.volume = 1.0;

        // 日本語ボイスを探す（女性優先）
        var voices = R4Voice.synth.getVoices();
        var bestVoice = null;
        for (var i = 0; i < voices.length; i++) {
            var v = voices[i];
            if (!v.lang.startsWith('ja')) continue;
            if (!bestVoice) bestVoice = v;
            // 女性ボイスを優先
            if (v.name.match(/female|woman|girl|kyoko|Kyoko|haruka|Haruka|お|女|Otoya/i)) {
                bestVoice = v;
                break;
            }
        }
        if (bestVoice) utter.voice = bestVoice;

        utter.onstart = function() { R4Voice.speaking = true; };
        utter.onend   = function() { R4Voice.speaking = false; };
        utter.onerror = function() { R4Voice.speaking = false; };

        R4Voice.speaking = true;
        R4Voice.synth.speak(utter);

        // Safariの自動停止バグ対策: 定期的に resume を呼ぶ
        var resumeTimer = setInterval(function() {
            if (R4Voice.synth.paused) R4Voice.synth.resume();
            if (!R4Voice.speaking) clearInterval(resumeTimer);
        }, 5000);
    },

    JS_Voice_StopSpeaking: function() {
        if (R4Voice.synth) {
            R4Voice.synth.cancel();
        }
        R4Voice.speaking = false;
    },

    JS_Voice_IsSpeaking: function() {
        return R4Voice.speaking ? 1 : 0;
    }
};

autoAddDeps(WebSpeechPlugin, '$R4Voice');
mergeInto(LibraryManager.library, WebSpeechPlugin);
