import { projectLibraryPlugin } from "./server/projectLibrary.js";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { peerSignalingPlugin } from "./server/peerSignaling.js";
export default defineConfig({
  appType: "spa",
  plugins: [
    tailwindcss(),
    react(),
    peerSignalingPlugin(),
    ...(process.env.TALWEG_BROWSER_STORAGE_ONLY === "1"
      ? []
      : [projectLibraryPlugin()]),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
