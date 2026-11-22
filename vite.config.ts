import { defineConfig } from 'vite';
import { version } from './package.json';

export default defineConfig({
  base: '/Traningsapp/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});
