// =====================================================================
// VoiceManager.cs
// R4 Project — 音声入力(STT) + 音声出力(TTS)
// =====================================================================
// WebGL  : WebSpeech.jslib 経由で Web Speech API を使用
// Editor : 機能なし（ログのみ表示 — ブラウザAPIなので実機WebGLのみ動作）
//
// KYUROKU.ainas の声設定:
//   - pitch: 1.3 (子どもらしい高め)
//   - rate : 1.1 (少し早め・活発)
//   - lang : ja-JP
// =====================================================================

using System;
using System.Collections;
using System.Text;
using UnityEngine;

#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace R4.Voice
{
    public enum RecognitionStatus
    {
        Idle       = 0,
        Listening  = 1,
        Recognized = 2,
        Error      = 3,
        Ended      = 4   // 無音・タイムアウトで終了
    }

    public class VoiceManager : MonoBehaviour
    {
        // ── Inspector ─────────────────────────────────────────────
        [Header("KYUROKU.ainas 声設定")]
        [Range(0.5f, 2.0f)] [SerializeField] private float kyurokuPitch = 1.3f;
        [Range(0.5f, 2.0f)] [SerializeField] private float kyurokuRate  = 1.1f;

        [Header("認識設定")]
        [Tooltip("ステータスのポーリング間隔(秒)")]
        [SerializeField] private float pollingInterval = 0.08f;

        // ── イベント ───────────────────────────────────────────────
        /// <summary>音声認識完了 → 認識テキストを渡す</summary>
        public event Action<string> OnSpeechRecognized;
        /// <summary>マイク録音開始</summary>
        public event Action OnListeningStarted;
        /// <summary>マイク録音終了（結果あり/なし問わず）</summary>
        public event Action OnListeningEnded;
        /// <summary>認識エラー</summary>
        public event Action<string> OnRecognitionError;
        /// <summary>TTS 読み上げ開始</summary>
        public event Action OnSpeakingStarted;
        /// <summary>TTS 読み上げ終了</summary>
        public event Action OnSpeakingEnded;

        // ── プロパティ ─────────────────────────────────────────────
        public bool IsListening         { get; private set; }
        public bool IsSpeaking          { get; private set; }
        public bool IsRecognitionAvailable { get; private set; }
        public bool IsSynthesisAvailable   { get; private set; }

        // ── 内部 ──────────────────────────────────────────────────
        private Coroutine pollingCoroutine;
        private bool      wasSpeaking;

        // ── jslib バインディング (WebGL専用) ─────────────────────
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void JS_Voice_Init();
        [DllImport("__Internal")] static extern int  JS_Voice_IsRecognitionSupported();
        [DllImport("__Internal")] static extern int  JS_Voice_IsSynthesisSupported();
        [DllImport("__Internal")] static extern int  JS_Voice_StartRecognition();
        [DllImport("__Internal")] static extern void JS_Voice_StopRecognition();
        [DllImport("__Internal")] static extern int  JS_Voice_GetStatus();
        [DllImport("__Internal")] static extern void JS_Voice_ResetStatus();
        [DllImport("__Internal")] static extern int  JS_Voice_GetRecognizedText(byte[] buf, int size);
        [DllImport("__Internal")] static extern void JS_Voice_Speak(string text, float pitch, float rate);
        [DllImport("__Internal")] static extern void JS_Voice_StopSpeaking();
        [DllImport("__Internal")] static extern int  JS_Voice_IsSpeaking();
#endif

        // ────────────────────────────────────────────────────────────
        private void Awake()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            JS_Voice_Init();
            IsRecognitionAvailable = JS_Voice_IsRecognitionSupported() == 1;
            IsSynthesisAvailable   = JS_Voice_IsSynthesisSupported()   == 1;
            Debug.Log($"[VoiceManager] STT={IsRecognitionAvailable} TTS={IsSynthesisAvailable}");
#else
            IsRecognitionAvailable = false;
            IsSynthesisAvailable   = false;
            Debug.Log("[VoiceManager] Editor環境 — 音声機能はWebGLビルドのみ動作します");
#endif
        }

        private void Start()
        {
            pollingCoroutine = StartCoroutine(PollLoop());
        }

        private void OnDestroy()
        {
            if (pollingCoroutine != null) StopCoroutine(pollingCoroutine);
            StopSpeaking();
        }

        // ────────────────────────────────────────────────────────────
        // 公開API — 音声認識 (STT)
        // ────────────────────────────────────────────────────────────

        /// <summary>マイク録音開始。既に録音中の場合は何もしない。</summary>
        public void StartListening()
        {
            if (IsListening) return;

            if (!IsRecognitionAvailable)
            {
                OnRecognitionError?.Invoke("このブラウザは音声認識(SpeechRecognition)に対応していません。Chrome/Edgeをお試しください。");
                return;
            }

#if UNITY_WEBGL && !UNITY_EDITOR
            JS_Voice_ResetStatus();
            int ok = JS_Voice_StartRecognition();
            if (ok == 1)
            {
                IsListening = true;
                OnListeningStarted?.Invoke();
            }
            else
            {
                OnRecognitionError?.Invoke("マイクへのアクセスが許可されていないか、対応ブラウザではありません");
            }
#else
            Debug.Log("[VoiceManager] StartListening — WebGLのみ");
#endif
        }

        /// <summary>録音を手動停止する（Push-to-Talk用）</summary>
        public void StopListening()
        {
            if (!IsListening) return;
#if UNITY_WEBGL && !UNITY_EDITOR
            JS_Voice_StopRecognition();
#endif
            IsListening = false;
            OnListeningEnded?.Invoke();
        }

        /// <summary>録音状態をトグル（ボタン1つで開始/停止）</summary>
        public void ToggleListening()
        {
            if (IsListening) StopListening();
            else             StartListening();
        }

        // ────────────────────────────────────────────────────────────
        // 公開API — 音声合成 (TTS)
        // ────────────────────────────────────────────────────────────

        /// <summary>KYUROKU.ainasの声でテキストを読み上げる</summary>
        public void Speak(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            if (!IsSynthesisAvailable) return;

            // 既に読み上げ中なら止めて再開
            StopSpeaking();

#if UNITY_WEBGL && !UNITY_EDITOR
            JS_Voice_Speak(text, kyurokuPitch, kyurokuRate);
            IsSpeaking  = true;
            wasSpeaking = true;
            OnSpeakingStarted?.Invoke();
#else
            Debug.Log($"[VoiceManager] Speak (WebGLのみ): {text}");
#endif
        }

        /// <summary>読み上げを停止する</summary>
        public void StopSpeaking()
        {
            if (!IsSpeaking) return;
#if UNITY_WEBGL && !UNITY_EDITOR
            JS_Voice_StopSpeaking();
#endif
            IsSpeaking  = false;
            wasSpeaking = false;
        }

        // ────────────────────────────────────────────────────────────
        // ポーリングループ（メインスレッドで毎秒数回JSステートを確認）
        // ────────────────────────────────────────────────────────────
        private IEnumerator PollLoop()
        {
            var wait = new WaitForSeconds(pollingInterval);

            while (true)
            {
                yield return wait;

#if UNITY_WEBGL && !UNITY_EDITOR
                // ── STT ステータス確認 ──
                if (IsListening)
                {
                    var status = (RecognitionStatus)JS_Voice_GetStatus();
                    switch (status)
                    {
                        case RecognitionStatus.Recognized:
                        {
                            // テキストをバッファ経由で受け取る
                            var buf = new byte[2048];
                            int len = JS_Voice_GetRecognizedText(buf, buf.Length);
                            IsListening = false;
                            OnListeningEnded?.Invoke();
                            if (len > 0)
                            {
                                string text = Encoding.UTF8.GetString(buf, 0, Mathf.Min(len, buf.Length - 1));
                                OnSpeechRecognized?.Invoke(text);
                            }
                            JS_Voice_ResetStatus();
                            break;
                        }
                        case RecognitionStatus.Error:
                            IsListening = false;
                            OnListeningEnded?.Invoke();
                            OnRecognitionError?.Invoke("音声認識エラーが発生しました");
                            JS_Voice_ResetStatus();
                            break;

                        case RecognitionStatus.Ended:
                            // 音声なし・タイムアウト
                            IsListening = false;
                            OnListeningEnded?.Invoke();
                            JS_Voice_ResetStatus();
                            break;
                    }
                }

                // ── TTS 終了検知 ──
                if (IsSpeaking)
                {
                    bool nowSpeaking = JS_Voice_IsSpeaking() == 1;
                    if (!nowSpeaking)
                    {
                        IsSpeaking  = false;
                        wasSpeaking = false;
                        OnSpeakingEnded?.Invoke();
                    }
                }
#endif
            }
        }
    }
}
