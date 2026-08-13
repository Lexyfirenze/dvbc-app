import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "De Voci Belli Chorale",
        short_name: "DVB Chorale",
        description: "Members portal for De Voci Belli Chorale - rehearsals, attendance, and the music library.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#FBF8FC",
        theme_color: "#7A1F3D",
        orientation: "portrait",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,jpg,jpeg,svg,ico}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        mode: "development",
      },
    }),
  ],
});
