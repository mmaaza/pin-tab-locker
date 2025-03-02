import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: {
                main: "index.html",
                background: "src/background.js", // Ensure background.js is included
                contentScript: "src/contentScript.js" // Ensure contentScript.js is included
            },
            output: {
                entryFileNames: "[name].js",
            },
        },
    },
    publicDir: "public",
});
