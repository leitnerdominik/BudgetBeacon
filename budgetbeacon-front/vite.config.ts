import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET ?? "http://localhost:5078";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    proxy: {
      "/api": {
        target: devProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
