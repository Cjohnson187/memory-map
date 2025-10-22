import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path";
import netlifyPlugin from '@netlify/vite-plugin';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        netlifyPlugin()
    ],
    resolve: {
        alias: {
            // This tells Vite that '@/...' means the absolute path to the './src' directory.
            "@": path.resolve(__dirname, "./src"),
        },
    },
})
