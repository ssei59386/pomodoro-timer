# study-planner-ai-advice (Cloudflare Worker)

「後悔防止トリガー」に相談機能を追加するための、生徒の学習データを一切経由しない
薄いバックエンド。単一エンドポイント `POST /advice` で Anthropic Claude API を中継し、
グローバル日次上限・匿名ID別日次上限の2段のレート制限をかける。

このディレクトリはリポジトリのルートアプリ（Vite/vitest）とは完全に独立している。
ルートの `tsconfig.json` は `"include": ["src"]` のみなので、`npm run build` / `npm test`
（ルート側）はこのディレクトリの存在・内容に一切影響を受けない。

## アーキテクチャ上の位置づけ（CLAUDE.md「バックエンドなし」原則との関係）

このWorkerは「AI壁打ち相談」機能専用の例外であり、**生徒の学習データ（教科・章・理解度・
セッション履歴等）は一切このWorkerを経由しない**。渡るのは相談中の会話文（教科名・章名・
残り日数・生徒の発言のみ）だけで、localStorageのデータそのものはブラウザの外に出ない。
アプリ全体の「データはlocalStorageのみ・バックエンド無し」という原則は無傷のまま、という
位置づけ。

## ディレクトリ構成

```
worker/
  package.json
  tsconfig.json
  wrangler.toml
  .dev.vars.example   # ローカル開発用の環境変数テンプレ（実体の .dev.vars は gitignore 対象）
  src/
    index.ts          # fetchハンドラ本体、ルーティング
    cors.ts            # オリジン許可判定・CORSヘッダ構築
    rateLimiter.ts      # KVによる2段レート制限（グローバル/匿名ID別、日次・JST基準）
    anthropic.ts         # Claude API呼び出し・システムプロンプト（トーン固定）
    types.ts              # リクエスト/レスポンス型・Env型
```

## ローカル開発（Stage A: このセッションで完結する範囲）

```bash
cd worker
npm install
npx tsc --noEmit        # 型チェック
```

`.dev.vars` を用意する（Anthropic APIキーが無くてもCORS/バリデーション/レート制限の
検証はできる。ダミー値でよい）:

```bash
cp .dev.vars.example .dev.vars
# worker/.dev.vars を編集して ANTHROPIC_API_KEY=dummy-for-local-testing など
```

```bash
npx wrangler dev --local
```

デフォルトで `http://localhost:8787` で待ち受ける。

### curlでの動作確認

**1. 許可Originからのプリフライト（204 + CORSヘッダが返るはず）**

```bash
curl -i -X OPTIONS http://localhost:8787/advice \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST"
```

**2. 許可外Originからのリクエスト（403で拒否されるはず）**

```bash
curl -i -X POST http://localhost:8787/advice \
  -H "Origin: https://evil.example.com" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**3. 必須フィールド欠如（400 invalid_request が返るはず）**

```bash
curl -i -X POST http://localhost:8787/advice \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{"anonId": "test-anon-1"}'
```

**4. 正常なリクエスト形（Anthropicキーが無い/ダミーの場合は502 upstream_error が
正しい。CORS/バリデーション/レート制限のロジックが正しく通っていることの確認が目的）**

```bash
curl -i -X POST http://localhost:8787/advice \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{
    "anonId": "test-anon-1",
    "subjectName": "数学",
    "chapterName": "二次関数",
    "subtopicName": null,
    "daysLeftUntilTest": 5,
    "message": "このまま続けるべきか迷っています",
    "history": []
  }'
```

**5. レート制限の確認（`wrangler.toml` の `GLOBAL_DAILY_LIMIT` または
`PER_ANON_DAILY_LIMIT` を一時的に `"1"` にして `wrangler dev --local` を再起動し、
上記4のリクエストを2回連続で送る。1回目は502(キー無しなら)、2回目は429
rate_limited が返るはず。**確認後は必ず値を元（300 / 20）に戻すこと**）**

```bash
curl -i -X POST http://localhost:8787/advice \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{"anonId":"test-anon-1","subjectName":"数学","chapterName":"二次関数","subtopicName":null,"daysLeftUntilTest":5,"message":"2回目のリクエスト","history":[]}'
```

## Stage B: 本番デプロイ（ユーザー自身が実施）

Stage AはCORS/バリデーション/レート制限のロジック確認まで。実際にCloudflareへ
デプロイしてAnthropic APIキーを使った本番動作をさせるには、以下をユーザー自身の
Cloudflareアカウントで実行する（このセッションでは未実施）。

```bash
cd worker

# 1. Cloudflareアカウントにログイン（ブラウザが開く）
npx wrangler login

# 2. KV namespaceを作成（本番用・プレビュー用の2つ）
npx wrangler kv namespace create RATE_LIMIT_KV
npx wrangler kv namespace create RATE_LIMIT_KV --preview

# 上記2コマンドの出力に含まれる id / preview_id を wrangler.toml の
# REPLACE_WITH_PRODUCTION_KV_ID / REPLACE_WITH_PREVIEW_KV_ID に書き写す

# 3. Anthropic APIキーをシークレットとして登録（対話式でキーの入力を求められる）
npx wrangler secret put ANTHROPIC_API_KEY

# 4. デプロイ
npx wrangler deploy
```

デプロイ後、Cloudflareダッシュボードの Workers > Rate Limiting Rules で
IPアドレスベースのバックストップ（3層目のレート制限）を設定することを推奨する
（コード側の2層＝グローバル日次上限・匿名ID別日次上限とは別に、Cloudflare側の
機能として設定する。このリポジトリのコードでは扱わない）。

### 本番デプロイ後のcurl確認例

```bash
curl -i -X POST https://study-planner-ai-advice.<your-subdomain>.workers.dev/advice \
  -H "Origin: https://ssei59386.github.io" \
  -H "Content-Type: application/json" \
  -d '{
    "anonId": "prod-check-1",
    "subjectName": "数学",
    "chapterName": "二次関数",
    "subtopicName": null,
    "daysLeftUntilTest": 5,
    "message": "このまま続けるべきか迷っています",
    "history": []
  }'
```
