# R4 Project — KYUROKU.ainas

ロックマンXスタイルの3Dキャラクターがブラウザ上で走り回り、AIと会話できるWebアプリ。

---

## プロジェクト構成

```
R4/
├── blender/
│   └── create_r4_character.py    # Blender自動モデリング + リグ + アニメ生成
├── unity/
│   └── Assets/Scripts/
│       ├── GeminiChatManager.cs  # Gemini 2.5 Flash AI会話
│       ├── PlayerController.cs   # キャラクター移動制御
│       └── ChatUI.cs             # チャットUI
├── KYUROKU_ainas_system_prompt.txt  # AI人格定義
├── wrangler.toml                 # Cloudflare Pages設定
├── .github/workflows/deploy.yml  # 自動デプロイ
└── .gitignore
```

---

## Phase 1: Blender でキャラクター生成

### 前提
- Blender 5.0.1 以降

### 実行

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background \
  --python /Users/matsumuratakumi/R4/blender/create_r4_character.py
```

出力: `/tmp/R4_Character.fbx`

### スクリプトの内容
| 機能 | 詳細 |
|------|------|
| メッシュ生成 | 頭/胴/腕/脚を分離メッシュで構築 |
| マテリアル | Principled BSDF (BodyBlue/GoldTrim/Visor等) |
| アーマチュア | Root→Hips→Spine→...の階層構造 |
| IK/FK | 両手・両足にIKターゲット + ポールベクター |
| アニメーション | Idle / Run / Turn の3アクション |
| 自動ウェイト | 全メッシュをアーマチュアに自動バインド |
| エクスポート | FBX (Unity互換設定) |

---

## Phase 2: Unity セットアップ

### 必要パッケージ（Package Manager）
- **TextMeshPro** (UI)
- **Input System** (新しい入力システム)
- **Newtonsoft Json** (API通信) ← `com.unity.nuget.newtonsoft-json`

### 音声機能 (WebSpeech.jslib)
`Assets/Plugins/WebGL/WebSpeech.jslib` が自動でWebGLビルドに組み込まれます。
**対応ブラウザ:** Chrome / Edge（STT） / ほぼ全ブラウザ（TTS）
マイク使用時はブラウザの許可ダイアログが表示されます（HTTPS必須 → Cloudflare Pagesなら自動対応）。

### セットアップ手順

1. Unity 2022.3 LTS で新規プロジェクト作成（3D URP推奨）
2. `/tmp/R4_Character.fbx` を `Assets/Models/` にドラッグ&ドロップ
3. FBXのインポート設定:
   - **Animation Type**: Humanoid
   - **Import Animations**: ✅ ON
4. `Assets/Scripts/` に3つのC#スクリプトを追加
5. シーン構築:

```
Scene Hierarchy:
├── Main Camera
├── Directional Light
├── Ground (Plane)
├── Player
│   ├── [CharacterController コンポーネント]
│   ├── [PlayerController.cs]
│   └── R4_Character (FBXプレハブ)
│       └── [Animator コンポーネント]
├── Canvas
│   ├── ChatPanel
│   │   ├── ScrollRect
│   │   │   └── Content (VerticalLayoutGroup)
│   │   ├── InputField (TMP)
│   │   ├── SendButton
│   │   ├── MicButton          ← 🎤 ボタン
│   │   │   ├── MicIconNormal  ← 通常時アイコン
│   │   │   └── MicIconActive  ← 録音中アイコン（点滅）
│   │   ├── TypingIndicator    ← AI考え中…
│   │   ├── SpeakingIndicator  ← KYUROKU が話している
│   │   └── ListeningIndicator ← KYUROKU が聴いている
│   └── OpenChatButton
└── GameManager
    ├── [GeminiChatManager.cs]  ← API Key を Inspector に設定
    ├── [VoiceManager.cs]       ← Pitch=1.3 Rate=1.1 で KYUROKU の声
    └── [ChatUI.cs]             ← VoiceManager の参照もセット
```

### Animator Controller 設定

```
Parameters:
  - Speed      (Float)
  - IsRunning  (Bool)
  - IsTurning  (Bool)
  - IsTalking  (Bool)  ← TTS再生中 (KYUROKU が話している)
  - IsListening (Bool) ← STT録音中 (KYUROKU が聴いている)

Transitions:
  Idle       →[Speed > 0.1]   →  Run
  Run        →[Speed < 0.1]   →  Idle
  Any        →[IsTurning]     →  Turn
  Turn       →[!IsTurning]    →  Idle/Run
  Any State  →[IsTalking]     →  Talking   ← 話しているポーズ
  Talking    →[!IsTalking]    →  Idle
  Any State  →[IsListening]   →  Listening ← 聴いているポーズ
  Listening  →[!IsListening]  →  Idle
```

> **優先順位**: IsTalking / IsListening は他のアニメより高い Priority を設定してください。
> Talking 中は移動アニメを抑制するため、Lower Body Layer で Weight 分離するのがベストです。

### API Key 設定（ローカル開発）

`GeminiChatManager` の Inspector の `Api Key` フィールドに直接入力。
**本番デプロイ時は必ず Cloudflare 経由で注入すること。**

---

## Phase 3: Git + Cloudflare デプロイ

### Git 初期化

```bash
cd /Users/matsumuratakumi/R4
git init
git add .
git commit -m "R4 initial commit"

# GitHub でリポジトリ "R4" を作成してから:
git remote add origin https://github.com/YOUR_USERNAME/R4.git
git branch -M main
git push -u origin main
```

### Cloudflare プロジェクト作成

```bash
# 初回のみ
npx wrangler pages project create r4-kyuroku

# 手動デプロイ（テスト用）
npx wrangler pages deploy unity/Builds/WebGL --project-name=r4-kyuroku
```

### GEMINI_API_KEY の安全な管理

```bash
# Cloudflare Pages シークレットとして保存（UIでの設定も可）
npx wrangler pages secret put GEMINI_API_KEY --project-name=r4-kyuroku
# → プロンプトが表示されたらキーを貼り付け

# ローカル開発用（.gitignore済み・絶対コミット禁止）
echo 'GEMINI_API_KEY=your_key_here' > .dev.vars
```

### GitHub Secrets 設定

GitHub リポジトリの `Settings > Secrets and variables > Actions` で以下を登録:

| Secret名 | 値 |
|---|---|
| `UNITY_LICENSE` | Unity ライセンスXML |
| `UNITY_EMAIL` | Unity アカウントEmail |
| `UNITY_PASSWORD` | Unity アカウントPW |
| `CLOUDFLARE_API_TOKEN` | CF APIトークン (Pages:Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | CF アカウントID |

### 自動デプロイの流れ

```
git push origin main
    └→ GitHub Actions 起動
        └→ Unity WebGL ビルド (GameCI)
            └→ Cloudflare Pages デプロイ
                └→ https://r4-kyuroku.pages.dev 公開
```

---

## KYUROKU.ainas について

`KYUROKU_ainas_system_prompt.txt` に人格定義を記載。
- **精神年齢**: しっかり者の小学6年生
- **口調**: ですます調 + 子どもらしい生意気さが混在
- **特性**: 走ること・記憶・責任感を大切にするAIユニット
- **LLM**: Gemini 2.5 Flash (`gemini-2.5-flash`)

---

## 参照画像（フォーム定義）

| ファイル | フォーム | 特徴 |
|---|---|---|
| キャストオフ.PNG | ベース | 青スーツ・金トリム（デフォルト） |
| キャストオン.PNG | アーマード | 暗青・黄バイザー |
| アクア.PNG | アクア | 青・ティール・肩ポッド |
| ヒート.PNG | ヒート | 赤/金・バスター |
| マリン.PNG | マリン | オレンジ/青 |
| サイト.PNG | サイト | 緑・スパークル |
| バグ.PNG | バグ | 暗青・回路ライン |
