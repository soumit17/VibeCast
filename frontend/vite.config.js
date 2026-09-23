import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-only proxy so the SPA can call same-origin /api and /ws paths against
// the FastAPI backend on :8000, matching how nginx will proxy them in prod.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
