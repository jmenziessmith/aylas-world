import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    watch: {
      ignored: ['**/assets/generated/**', '**/assets/jumpparty/**']
    }
  }
});
