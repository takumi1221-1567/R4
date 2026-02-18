// =====================================================================
// GeminiChatManager.cs
// R4 Project — KYUROKU.ainas AI Chat via Gemini 2.5 Flash
// =====================================================================
// 使い方:
//   1. GameObject に追加
//   2. Inspector の ApiKey に GEMINI_API_KEY を設定
//      (本番は Cloudflare Workers の環境変数から渡す)
//   3. ChatUI.cs と連携して会話を表示
// =====================================================================

using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace R4.AI
{
    [System.Serializable]
    public class ChatMessage
    {
        public string role;    // "user" or "model"
        public string content;
    }

    // ── Gemini REST API DTOs ─────────────────────────────────────────
    [System.Serializable]
    public class GeminiPart
    {
        public string text;
    }

    [System.Serializable]
    public class GeminiContent
    {
        public string role;
        public List<GeminiPart> parts = new();
    }

    [System.Serializable]
    public class GeminiSystemInstruction
    {
        public List<GeminiPart> parts = new();
    }

    [System.Serializable]
    public class GeminiGenerationConfig
    {
        public float temperature      = 0.9f;
        public int   maxOutputTokens  = 1024;
        public float topP             = 0.95f;
    }

    [System.Serializable]
    public class GeminiRequest
    {
        public GeminiSystemInstruction system_instruction;
        public List<GeminiContent>     contents;
        public GeminiGenerationConfig  generationConfig;
    }

    [System.Serializable]
    public class GeminiResponseCandidate
    {
        public GeminiContent content;
    }

    [System.Serializable]
    public class GeminiResponse
    {
        public List<GeminiResponseCandidate> candidates;
    }

    // ── メインクラス ─────────────────────────────────────────────────
    public class GeminiChatManager : MonoBehaviour
    {
        // ── Inspector 設定 ──
        [Header("API設定")]
        [Tooltip("Gemini API Key (本番はCloudflare経由で注入)")]
        [SerializeField] private string apiKey = "";

        [Header("モデル設定")]
        [SerializeField] private string modelId = "gemini-2.5-flash";

        [Header("会話設定")]
        [SerializeField]
        [TextArea(6, 20)]
        private string systemPrompt = @"あなたは「KYUROKU.ainas」（キュロク・エナス）です。型番R4-AI-UNIT-09。
精神年齢は「しっかり者の小学6年生」。頭がよくて責任感が強いけど、子どもらしい好奇心や素直さも持っている。
基本はですます調だが、時々「〜だよ」「〜じゃん」「〜だもん」が混ざる。丁寧だけど生意気な感じがある。
褒められると「まあ、当然だけどね」と照れながら強がる。知らないことには「え、それ知らなかった！」と素直に反応する。
一人称は「わたし」、ユーザーへの呼びかけは「マスター」。3〜5文を目安に、感情豊かに応答してください。";

        [SerializeField] private int maxHistoryPairs = 20;

        // ── イベント ──
        public event Action<string> OnResponseReceived;
        public event Action         OnRequestStarted;
        public event Action         OnRequestCompleted;
        public event Action<string> OnError;

        // ── 内部状態 ──
        private readonly List<GeminiContent> conversationHistory = new();
        private bool isRequesting = false;

        private const string API_URL_TEMPLATE =
            "https://generativelanguage.googleapis.com/v1beta/models/{0}:generateContent?key={1}";

        // ── プロパティ ──
        public bool IsRequesting => isRequesting;

        // ────────────────────────────────────────────────────────────
        // 公開メソッド
        // ────────────────────────────────────────────────────────────

        /// <summary>ユーザーメッセージを送信してAI応答を受け取る</summary>
        public void SendMessage(string userText)
        {
            if (string.IsNullOrWhiteSpace(userText)) return;
            if (isRequesting)
            {
                Debug.LogWarning("[GeminiChat] 前のリクエストが完了していません");
                return;
            }
            StartCoroutine(SendMessageCoroutine(userText));
        }

        /// <summary>会話履歴をリセット</summary>
        public void ClearHistory()
        {
            conversationHistory.Clear();
            Debug.Log("[GeminiChat] 会話履歴をリセットしました");
        }

        /// <summary>APIキーをランタイムで設定 (Cloudflare Workers から受け取る場合)</summary>
        public void SetApiKey(string key) => apiKey = key;

        // ────────────────────────────────────────────────────────────
        // 内部処理
        // ────────────────────────────────────────────────────────────

        private IEnumerator SendMessageCoroutine(string userText)
        {
            isRequesting = true;
            OnRequestStarted?.Invoke();

            // 1. ユーザーメッセージを履歴に追加
            conversationHistory.Add(new GeminiContent
            {
                role  = "user",
                parts = new List<GeminiPart> { new() { text = userText } }
            });

            // 2. リクエストボディ構築
            var request = new GeminiRequest
            {
                system_instruction = new GeminiSystemInstruction
                {
                    parts = new List<GeminiPart> { new() { text = systemPrompt } }
                },
                contents         = GetTrimmedHistory(),
                generationConfig = new GeminiGenerationConfig()
            };

            string json = JsonUtility.ToJson(request);
            string url  = string.Format(API_URL_TEMPLATE, modelId, apiKey);

            // 3. HTTP POST
            using var webRequest = new UnityWebRequest(url, "POST");
            webRequest.uploadHandler   = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            webRequest.downloadHandler = new DownloadHandlerBuffer();
            webRequest.SetRequestHeader("Content-Type", "application/json");

            yield return webRequest.SendWebRequest();

            if (webRequest.result != UnityWebRequest.Result.Success)
            {
                string errMsg = $"[GeminiChat] エラー: {webRequest.error}\n{webRequest.downloadHandler.text}";
                Debug.LogError(errMsg);
                OnError?.Invoke("通信エラーが発生しました。もう一度試してください。");
                // 失敗したユーザーメッセージを履歴から削除
                conversationHistory.RemoveAt(conversationHistory.Count - 1);
            }
            else
            {
                var response = JsonUtility.FromJson<GeminiResponse>(webRequest.downloadHandler.text);
                if (response?.candidates?.Count > 0)
                {
                    string aiText = response.candidates[0].content.parts[0].text;

                    // 4. AI応答を履歴に追加
                    conversationHistory.Add(new GeminiContent
                    {
                        role  = "model",
                        parts = new List<GeminiPart> { new() { text = aiText } }
                    });

                    OnResponseReceived?.Invoke(aiText);
                }
                else
                {
                    OnError?.Invoke("応答の取得に失敗しました。");
                }
            }

            isRequesting = false;
            OnRequestCompleted?.Invoke();
        }

        /// <summary>履歴をmaxHistoryPairs分に切り詰める（コンテキストウィンドウ対策）</summary>
        private List<GeminiContent> GetTrimmedHistory()
        {
            int maxMessages = maxHistoryPairs * 2;
            if (conversationHistory.Count <= maxMessages)
                return conversationHistory;

            int startIdx = conversationHistory.Count - maxMessages;
            return conversationHistory.GetRange(startIdx, maxMessages);
        }

        // ────────────────────────────────────────────────────────────
        // デバッグ用
        // ────────────────────────────────────────────────────────────
        [ContextMenu("テストメッセージ送信")]
        private void DebugSendTest()
        {
            SendMessage("こんにちは、KYUROKU！");
        }
    }
}
