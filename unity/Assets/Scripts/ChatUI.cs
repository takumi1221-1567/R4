// =====================================================================
// ChatUI.cs
// R4 Project — KYUROKU.ainas チャット UI + 音声入出力 統合
// =====================================================================
// 必要な Unity UI コンポーネント:
//   - Canvas (Screen Space - Overlay)
//   - ScrollRect + Content(VerticalLayoutGroup) → メッセージログ
//   - TMP_InputField → テキスト入力
//   - Button: SendButton / OpenChatButton / CloseChatButton / MicButton
//   - GameObject: TypingIndicator / SpeakingIndicator / ListeningIndicator
// =====================================================================

using System.Collections;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using R4.AI;
using R4.Character;
using R4.Voice;

namespace R4.UI
{
    public class ChatUI : MonoBehaviour
    {
        // ── Inspector ───────────────────────────────────────────────
        [Header("チャットパネル")]
        [SerializeField] private GameObject   chatPanel;
        [SerializeField] private ScrollRect   scrollRect;
        [SerializeField] private Transform    messageContainer;
        [SerializeField] private GameObject   userBubblePrefab;
        [SerializeField] private GameObject   aiBubblePrefab;

        [Header("テキスト入力エリア")]
        [SerializeField] private TMP_InputField inputField;
        [SerializeField] private Button         sendButton;
        [SerializeField] private Button         openChatButton;
        [SerializeField] private Button         closeChatButton;

        [Header("マイクボタン")]
        [Tooltip("マイクボタン本体")]
        [SerializeField] private Button         micButton;
        [Tooltip("マイクアイコン（通常時）")]
        [SerializeField] private GameObject     micIconNormal;
        [Tooltip("マイクアイコン（録音中・点滅）")]
        [SerializeField] private GameObject     micIconActive;

        [Header("状態インジケーター")]
        [Tooltip("AI が考え中…（テキスト生成待ち）")]
        [SerializeField] private GameObject typingIndicator;
        [Tooltip("KYUROKU が話している（TTS再生中）")]
        [SerializeField] private GameObject speakingIndicator;
        [Tooltip("KYUROKU が聴いている（STT録音中）")]
        [SerializeField] private GameObject listeningIndicator;

        [Header("演出")]
        [SerializeField] private float typewriterSpeed = 0.025f;

        [Header("参照")]
        [SerializeField] private GeminiChatManager geminiManager;
        [SerializeField] private PlayerController   playerController;
        [SerializeField] private VoiceManager       voiceManager;

        // ── 内部状態 ──────────────────────────────────────────────
        private bool isChatOpen = false;
        private Coroutine typewriterCoroutine;
        private Coroutine micBlinkCoroutine;

        // ────────────────────────────────────────────────────────────
        private void Awake()
        {
            // テキスト送受信イベント
            if (sendButton)      sendButton.onClick.AddListener(OnSendClicked);
            if (openChatButton)  openChatButton.onClick.AddListener(() => SetChatOpen(true));
            if (closeChatButton) closeChatButton.onClick.AddListener(() => SetChatOpen(false));
            if (inputField)      inputField.onSubmit.AddListener(OnSubmitField);

            // マイクボタン
            if (micButton) micButton.onClick.AddListener(OnMicClicked);

            // Gemini AI イベント
            if (geminiManager)
            {
                geminiManager.OnResponseReceived += OnAIResponse;
                geminiManager.OnRequestStarted   += OnRequestStarted;
                geminiManager.OnRequestCompleted += OnRequestCompleted;
                geminiManager.OnError            += OnAIError;
            }

            // VoiceManager イベント
            if (voiceManager)
            {
                voiceManager.OnSpeechRecognized  += OnSpeechRecognized;
                voiceManager.OnListeningStarted  += OnListeningStarted;
                voiceManager.OnListeningEnded    += OnListeningEnded;
                voiceManager.OnRecognitionError  += OnRecognitionError;
                voiceManager.OnSpeakingStarted   += OnKyurokuSpeakingStarted;
                voiceManager.OnSpeakingEnded     += OnKyurokuSpeakingEnded;
            }

            // 初期表示
            if (chatPanel)          chatPanel.SetActive(false);
            SetIndicator(typingIndicator,   false);
            SetIndicator(speakingIndicator, false);
            SetIndicator(listeningIndicator,false);
            SetMicIcon(isRecording: false);
        }

        private void Update()
        {
            if (!isChatOpen) return;
            if (Input.GetKeyDown(KeyCode.Escape))
                SetChatOpen(false);
        }

        private void OnDestroy()
        {
            if (voiceManager != null)
            {
                voiceManager.OnSpeechRecognized -= OnSpeechRecognized;
                voiceManager.OnListeningStarted -= OnListeningStarted;
                voiceManager.OnListeningEnded   -= OnListeningEnded;
                voiceManager.OnRecognitionError -= OnRecognitionError;
                voiceManager.OnSpeakingStarted  -= OnKyurokuSpeakingStarted;
                voiceManager.OnSpeakingEnded    -= OnKyurokuSpeakingEnded;
            }
        }

        // ────────────────────────────────────────────────────────────
        // チャットパネル 開閉
        // ────────────────────────────────────────────────────────────
        public void SetChatOpen(bool open)
        {
            isChatOpen = open;
            if (chatPanel) chatPanel.SetActive(open);
            playerController?.SetChatMode(open);

            if (open)
            {
                inputField?.ActivateInputField();
                ScrollToBottom();
            }
            else
            {
                // 閉じるときは録音・再生を止める
                voiceManager?.StopListening();
                voiceManager?.StopSpeaking();
            }
        }

        // ────────────────────────────────────────────────────────────
        // テキスト送信
        // ────────────────────────────────────────────────────────────
        private void OnSendClicked()
        {
            string text = inputField?.text?.Trim();
            if (string.IsNullOrEmpty(text)) return;
            if (geminiManager == null || geminiManager.IsRequesting) return;

            SubmitUserMessage(text);
        }

        private void OnSubmitField(string _) => OnSendClicked();

        /// <summary>テキスト/音声認識どちらからも呼ばれる共通送信処理</summary>
        private void SubmitUserMessage(string text)
        {
            // ユーザーがしゃべり始めたら KYUROKU の読み上げを止める
            voiceManager?.StopSpeaking();

            AddBubble(text, isUser: true);
            if (inputField) inputField.text = "";
            inputField?.ActivateInputField();

            geminiManager.SendMessage(text);
        }

        // ────────────────────────────────────────────────────────────
        // マイクボタン
        // ────────────────────────────────────────────────────────────
        private void OnMicClicked()
        {
            if (voiceManager == null) return;
            voiceManager.ToggleListening();
        }

        // ────────────────────────────────────────────────────────────
        // VoiceManager イベントハンドラー — STT
        // ────────────────────────────────────────────────────────────

        /// <summary>音声認識成功 → そのままAIへ送信</summary>
        private void OnSpeechRecognized(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            // 認識テキストをインプットフィールドに表示してから送信
            if (inputField) inputField.text = text;
            SubmitUserMessage(text);
        }

        private void OnListeningStarted()
        {
            SetIndicator(listeningIndicator, true);
            SetMicIcon(isRecording: true);
            // KYUROKU: 聴いているアニメ ON（移動は停止せず、ただ耳を傾ける）
            playerController?.SetListening(true);
            if (micBlinkCoroutine != null) StopCoroutine(micBlinkCoroutine);
            micBlinkCoroutine = StartCoroutine(BlinkMicIcon());
        }

        private void OnListeningEnded()
        {
            SetIndicator(listeningIndicator, false);
            SetMicIcon(isRecording: false);
            playerController?.SetListening(false);
            if (micBlinkCoroutine != null)
            {
                StopCoroutine(micBlinkCoroutine);
                micBlinkCoroutine = null;
            }
        }

        private void OnRecognitionError(string msg)
        {
            OnListeningEnded();
            AddBubble($"🎤 {msg}", isUser: false, isError: true);
        }

        // ────────────────────────────────────────────────────────────
        // VoiceManager イベントハンドラー — TTS
        // ────────────────────────────────────────────────────────────

        private void OnKyurokuSpeakingStarted()
        {
            SetIndicator(speakingIndicator, true);
            // KYUROKU: 話しているアニメ ON
            playerController?.SetTalking(true);
        }

        private void OnKyurokuSpeakingEnded()
        {
            SetIndicator(speakingIndicator, false);
            playerController?.SetTalking(false);
        }

        // ────────────────────────────────────────────────────────────
        // Gemini AI ハンドラー
        // ────────────────────────────────────────────────────────────
        private void OnAIResponse(string text)
        {
            if (typewriterCoroutine != null) StopCoroutine(typewriterCoroutine);
            typewriterCoroutine = StartCoroutine(TypewriterBubble(text));

            // TTS で読み上げ開始（イベントが OnSpeakingStarted を発火→アニメ連動）
            voiceManager?.Speak(text);
        }

        private void OnRequestStarted()
        {
            if (sendButton) sendButton.interactable = false;
            if (micButton)  micButton.interactable  = false;
            SetIndicator(typingIndicator, true);
        }

        private void OnRequestCompleted()
        {
            if (sendButton) sendButton.interactable = true;
            if (micButton)  micButton.interactable  = true;
            SetIndicator(typingIndicator, false);
        }

        private void OnAIError(string errorMsg)
        {
            AddBubble($"[エラー] {errorMsg}", isUser: false, isError: true);
        }

        // ────────────────────────────────────────────────────────────
        // バブル生成
        // ────────────────────────────────────────────────────────────
        private TMP_Text AddBubble(string text, bool isUser, bool isError = false)
        {
            var prefab = isUser ? userBubblePrefab : aiBubblePrefab;
            if (prefab != null)
            {
                var bubble = Instantiate(prefab, messageContainer);
                var tmp    = bubble.GetComponentInChildren<TMP_Text>();
                if (tmp)
                {
                    tmp.text  = text;
                    if (isError) tmp.color = Color.red;
                }
                ScrollToBottom();
                return tmp;
            }
            return AddFallbackText(text, isUser, isError);
        }

        private TMP_Text AddFallbackText(string text, bool isUser, bool isError)
        {
            var go  = new GameObject(isUser ? "UserMsg" : "AIMsg");
            go.transform.SetParent(messageContainer, false);
            var tmp = go.AddComponent<TextMeshProUGUI>();
            tmp.text      = (isUser ? "You: " : "KYUROKU: ") + text;
            tmp.fontSize  = 18;
            tmp.color     = isError ? Color.red : (isUser ? Color.white : new Color(0.7f, 0.95f, 1f));
            tmp.alignment = isUser ? TextAlignmentOptions.Right : TextAlignmentOptions.Left;
            var le = go.AddComponent<LayoutElement>();
            le.preferredWidth = 600;
            le.flexibleWidth  = 1;
            ScrollToBottom();
            return tmp;
        }

        // ────────────────────────────────────────────────────────────
        // タイプライター演出
        // ────────────────────────────────────────────────────────────
        private IEnumerator TypewriterBubble(string fullText)
        {
            TMP_Text tmp = AddBubble("", isUser: false);
            if (tmp == null) yield break;
            foreach (char c in fullText)
            {
                tmp.text += c;
                ScrollToBottom();
                yield return new WaitForSeconds(typewriterSpeed);
            }
        }

        // ────────────────────────────────────────────────────────────
        // マイクアイコン点滅
        // ────────────────────────────────────────────────────────────
        private IEnumerator BlinkMicIcon()
        {
            bool visible = true;
            while (true)
            {
                visible = !visible;
                if (micIconActive) micIconActive.SetActive(visible);
                yield return new WaitForSeconds(0.5f);
            }
        }

        private void SetMicIcon(bool isRecording)
        {
            if (micIconNormal) micIconNormal.SetActive(!isRecording);
            if (micIconActive) micIconActive.SetActive(isRecording);
        }

        // ────────────────────────────────────────────────────────────
        // ユーティリティ
        // ────────────────────────────────────────────────────────────
        private void SetIndicator(GameObject indicator, bool active)
        {
            if (indicator != null) indicator.SetActive(active);
        }

        private void ScrollToBottom()
        {
            if (scrollRect == null) return;
            Canvas.ForceUpdateCanvases();
            scrollRect.verticalNormalizedPosition = 0f;
        }
    }
}
