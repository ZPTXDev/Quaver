import { defineConfig } from 'tsdown';
import fg from 'fast-glob';

const entries = await fg([
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/locales/**',
    '!src/scripts/**',
]);

export default defineConfig({
    entry: entries,
    outDir: 'dist',
    format: 'esm',
    platform: 'node',
    unbundle: true,
    tsconfig: 'tsconfig.json',
});
