import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: {
                main: "index.html",
                options: "options.html",
                blocked: "blocked.html",
                background: "src/background.js",
            },
            output: {
                entryFileNames: "[name].js",
            },
        },
    },
    publicDir: "public",
});
