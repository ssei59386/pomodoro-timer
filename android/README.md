# TalkPractice（Androidアプリ）

複数人でのコミュニケーションが苦手なユーザー向けの、AIキャラクターとの音声会話練習アプリ。
設計の詳細は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照。

このディレクトリはリポジトリ内の独立したAndroid Gradleプロジェクトで、ルートのReact製学習管理アプリとは無関係。

## セットアップ

1. Android Studio（Koala以降推奨）でこの `android/` ディレクトリを開く。
2. `local.properties.example` を `local.properties` にコピーし、`GEMINI_API_KEY` に
   [Google AI Studio](https://aistudio.google.com/apikey) で発行したAPIキーを設定する
   （`local.properties` はgitignore対象なのでコミットされない）。
3. Sync後、通常どおり実行。

## 開発ステップ

1. ✅ プロジェクト初期設定・基本アーキテクチャ設計
2. シチュエーション選択画面・会話画面のUIモックアップ
3. Gemini Multimodal Live APIへの接続・リアルタイム音声会話
4. レポート画面（レーダーチャート含む）
