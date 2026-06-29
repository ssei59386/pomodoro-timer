import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages はプロジェクトサイトとして /pomodoro-timer/ 配下で配信されるため、
// ビルド時だけ base を切り替える（ローカル開発時は "/" のまま）。
const BASE_PATH = "/pomodoro-timer/";

// 仕様書 §4: モバイル向け PWA。ホーム画面に追加して使える。
export default defineConfig(({ command }) => ({
  base: command === "build" ? BASE_PATH : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "定期テスト学習進捗管理",
        short_name: "学習進捗",
        description: "定期テストの点数を最大化する学習進捗管理アプリ",
        theme_color: "#2563eb",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        start_url: BASE_PATH,
        scope: BASE_PATH,
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
}));
