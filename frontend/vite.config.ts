import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    allowedHosts: ["just-beauty.be", "www.just-beauty.be", "dev03.lfinfo.be", ".lfinfo.be"],
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:3105",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3105",
        changeOrigin: true,
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
