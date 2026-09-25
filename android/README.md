# TalkPractice（Androidアプリ）

複数人でのコミュニケーションが苦手なユーザー向けの、AIキャラクターとの音声会話練習アプリ。
設計の詳細は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照。

このディレクトリはリポジトリ内の独立したAndroid Gradleプロジェクトで、ルートのReact製学習管理アプリとは無関係。

## セットアップ

1. Android Studio（Koala以降推奨）でこの `android/` ディレクトリを開く（リポジトリ全体ではなく `android/` を開くこと）。
2. `local.properties.example` を `local.properties` にコピーし、`GEMINI_API_KEY` に
   [Google AI Studio](https://aistudio.google.com/apikey) で発行したAPIキーを設定する
   （`local.properties` はgitignore対象なのでコミットされない）。
3. Gradle Syncが完了したら、実機（推奨）またはエミュレータで実行。

### 実機を推奨する理由

- マイクとスピーカーが同時に使われるため、実機の方がエコーキャンセル（`AudioSource.VOICE_COMMUNICATION`）が確実に効く。
- Live APIとの低遅延な音声ストリーミングを試すには、Wi-Fi環境の実機の方が体感を確認しやすい。
- USB接続でAndroid Studioから直接「Run」すれば十分（開発者モード＋USBデバッグを有効化）。

### 動作確認のポイント（初回実行時）

このアプリのGemini Live API連携部分は、このリポジトリの開発環境（サンドボックス）からは実際に接続して検証できていない。初回実行時は以下を確認してほしい：

- `GeminiLiveClientImpl.kt` 内の `MODEL_NAME`（`gemini-2.5-flash-native-audio-preview-12-2025`）が現在も有効か。Google側でモデルが更新/廃止されている場合、[Live APIのモデル一覧](https://ai.google.dev/gemini-api/docs/models)で現行のLiveモデルIDに差し替える。
- 同様に `GeminiReportClientImpl.kt` 内の `REPORT_MODEL`（`gemini-2.5-pro`）も現行モデル名か確認。
- 会話画面でマイク許可のダイアログが出たら「許可」する。拒否すると接続が始まらない。
- Logcatで `GeminiLiveClientImpl`/`OkHttp` 関連のログにWebSocketエラーが出ていないか確認すると、接続失敗時の原因切り分けがしやすい。

## 開発ステップ

1. ✅ プロジェクト初期設定・基本アーキテクチャ設計
2. ✅ シチュエーション選択画面・会話画面のUIモックアップ（発話者が光るギミックはモック回転で仮実装、Step3で実イベントに差し替え）
3. ✅ Gemini Multimodal Live APIへの接続・リアルタイム音声会話（詳細はARCHITECTURE.md §3）
4. ✅ 会話終了後のログ取得・レポート画面（レーダーチャート含む）（詳細はARCHITECTURE.md §4）
