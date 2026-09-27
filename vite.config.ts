import { defineConfig } from 'vite';

export default defineConfig({
  // The published Engine is replaced independently of Zoë's source. A running
  // dev server must not keep using an older optimized copy after npm install.
  optimizeDeps: { exclude: ['@zoeyetc/computational-listening-engine'] },
});
