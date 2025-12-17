import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'**/node_modules/**',
				'**/dist/**',
				'**/*.config.{js,ts}',
				'**/scripts/**',
				'**/locales/types.ts', // Generated file
			],
		},
	},
	resolve: {
		alias: {
			'#src': resolve(__dirname, './src'),
		},
	},
});
