import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages はプロジェクトサイトとして /pomodoro-timer/ 配下で配信されるため、
// ビルド時だけ base を切り替える（ローカル開発時は "/" のまま）。
const BASE_PATH = "/pomodoro-timer/";

// 仕様書 §4: モバイル向け PWA。ホーム画面に追加してオフラインで使える。
export default defineConfig(({ command }) => ({
  base: command === "build" ? BASE_PATH : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
      },
      manifest: {
        name: "MyFitLog - フィットネス＆ライフログ",
        short_name: "MyFitLog",
        description: "筋トレ・食事・睡眠・体重を記録できるオフライン対応のフィットネス＆ライフログ",
        theme_color: "#1f7352",
        background_color: "#f8faf9",
        display: "standalone",
        orientation: "portrait",
        start_url: command === "build" ? BASE_PATH : "/",
        scope: command === "build" ? BASE_PATH : "/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
}));
