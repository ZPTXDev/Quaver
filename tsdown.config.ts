import { defineConfig } from 'tsdown';
// @ts-expect-error - idk
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
    sourcemap: true,
    unbundle: true,
    tsconfig: 'tsconfig.json',
});
