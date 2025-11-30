import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const readable = mode !== 'ship'

  return {
    plugins: [vue()],
    publicDir: 'example/public',
    build: readable
      ? {
          minify: false,
          sourcemap: true,
          rollupOptions: {
            output: {
              preserveModules: true,
              preserveModulesRoot: 'example/src',
              entryFileNames: '[name].js',
              chunkFileNames: '[name].js',
              assetFileNames: 'assets/[name][extname]',
            },
          },
        }
      : {},
  }
})
