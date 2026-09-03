# TalkPractice — アーキテクチャ設計（ステップ1）

会話練習AndroidアプリのStep 1成果物。プロジェクト基盤と、以降のステップ（2〜4）が乗る土台の設計方針をまとめる。

## 1. 全体レイヤー構成

```
ui/            Jetpack Compose 画面 + ViewModel（MVVM）
  situationselect/   ①シチュエーション選択
  conversation/      ②会話画面
  report/            ③レポート画面
  navigation/        Navigation Compose によるNavHost
  theme/

domain/
  model/         Situation, Character, TranscriptEntry, ConversationMetrics, EvaluationReport
  usecase/       StartConversationUseCase, EndConversationAndGenerateReportUseCase（Step3/4で実装）

core/
  gemini/
    live/        GeminiLiveClient（Multimodal Live API, WebSocket）
    report/      GeminiReportClient（generateContent, REST）
  audio/         AudioRecorder / AudioPlayer（Step3で実装, AudioRecord/AudioTrack直叩き）

di/              Hilt モジュール（NetworkModule 等）
```

- **MVVM + 軽量ドメイン層**: 永続化がないため repository/DB層は作らない。ViewModelが `GeminiLiveClient` / `GeminiReportClient` を直接（DomainのUseCase経由で）呼び出す。
- **状態管理**: 各ViewModelは `StateFlow<UiState>` を公開し、Composeは `collectAsStateWithLifecycle()` で購読する。
- **DI**: Hilt。APIキーは `local.properties` → `BuildConfig.GEMINI_API_KEY` 経由で注入し、ソースにもVCSにも残さない。
- **非同期**: Kotlin Coroutines + Flow。WebSocketの受信イベントは `Flow<LiveEvent>` として `GeminiLiveClient` から流す。

## 2. 画面とデータの流れ

```
①SituationSelectScreen
   → Situation を選択 → Conversation へ navigate（situationId をルート引数で渡す）

②ConversationScreen
   ConversationViewModel:
     - StartConversationUseCase で GeminiLiveClient.connect(situation)
     - events: Flow<LiveEvent> を収集し UiState を更新
         AudioChunk       → AudioPlayer に渡して再生 + 発話者ハイライト
         SpeakerChanged   → 発光中のキャラID更新
         UserAizuchi/Interrupted → ConversationMetrics に加算
     - マイク入力: AudioRecorder が PCM16 チャンクを都度 sendAudioChunk() へ
     - 「終了」ボタン → disconnect() → 蓄積したtranscript+metricsを
       ReportViewModel（nav-graph-scoped）に渡して Report へ navigate

③ReportScreen
   ReportViewModel:
     - EndConversationAndGenerateReportUseCase で GeminiReportClient.generateReport(...)
     - 結果の EvaluationReport を RadarChart / 良かった点・悪かった点 / 言い換え提案として表示
```

会話ログ・メトリクスは画面遷移時にnav-graph-scoped ViewModel（`SavedStateHandle`ではなくメモリ保持）で受け渡す。PRD通りディスクへの永続化は行わない。

## 3. Gemini Multimodal Live API 接続の設計（Step 3で実装）

- OkHttp WebSocketで `wss://generativelanguage.googleapis.com/.../BidiGenerateContent` に接続。
- 接続時に `setup` メッセージでシステムプロンプト（シチュエーション設定・キャラクター人格・「相槌をリアルタイム検知して」という指示）と音声設定を送信。
- マイク: `AudioRecord`（16kHz, 16bit PCM, mono）→ Base64 → `realtimeInput` として逐次送信。
- モデル音声: 24kHz PCMチャンクが返る → `AudioTrack` のストリーミング再生キューに投入。
- Live APIの組み込みVADからの割り込み/発話区間イベントを使い、「ユーザーが相槌を打ったか」「ユーザーが割り込んだか」を検知して `ConversationMetrics` に集計。

## 4. レポート生成の設計（Step 4で実装）

- 会話終了後、蓄積した `List<TranscriptEntry>` と `ConversationMetrics` を1回のREST `generateContent` 呼び出し（gemini-1.5-pro等）に渡す。
- レスポンスは `responseSchema` でJSON形式を強制し、`EvaluationReport`（3軸スコア・良い点/悪い点・言い換え提案）にそのままデコードする。
- 単発リクエストなのでLive API接続とは別クライアント（`GeminiReportClient`、通常のOkHttp + kotlinx.serialization）。

## 5. 重要な設計トレードオフ：複数キャラクターの音声表現

Gemini Multimodal Live APIは**1セッション＝1つの音声（ボイス）**が基本で、AIキャラクターごとに別の声色を出し分ける標準機能はない。今回は以下の方針を採用する：

- **採用案**: 1つのLive APIセッションに対し、システムプロンプトで「複数キャラクターを演じ分け、各発言の先頭に話者タグ（例: `[山田さん]`）を付けて話す」よう指示する。アプリ側はストリーミングされるテキストトランスクリプトから話者タグをパースして `SpeakerChanged` イベントを発行し、UIのアイコン発光を切り替える。音声そのものは単一ボイスのまま。
- **代替案（将来拡張）**: キャラクターごとに個別のLive APIセッションを張り、アプリ側で発言権を管理して交互に音声を流す。声質を本当に変えられる一方、セッション管理・順番制御・レイテンシの複雑さが大きく増す。Step 3では採用しない。

この制約とUI要件（発話者が光る）の両立方法は、Step 2のUIモックアップおよびStep 3の実装で具体化する。

## 6. プロジェクト基盤（Step 1で実装済み）

- Kotlin 2.0 / AGP 8.5 / Gradle 8.9（Version Catalog: `gradle/libs.versions.toml`）
- Jetpack Compose（BOM 2024.09） + Material3 + Navigation Compose
- Hilt（DI）、OkHttp（WebSocket/REST）、kotlinx.serialization（JSON）
- `minSdk 26` / `targetSdk 34`
- `RECORD_AUDIO` / `INTERNET` パーミッションをマニフェストに宣言済み
- 3画面ぶんのプレースホルダー付きNavHostが起動する状態（本物のUIはStep 2）
- APIキーは `local.properties`（gitignore対象）経由。`local.properties.example` を参照。

> 注: この開発環境はサンドボックス化されておりAndroid SDK / Google Mavenへの外部アクセスがブロックされているため、`./gradlew build` はこの場では実行できない。Android Studio（またはネットワーク制限のないCI）で開けば通常通りビルドできる構成にしてある。
