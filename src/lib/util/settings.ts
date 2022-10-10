import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import type { SettingsObject } from './settings.types.js';

function getAbsoluteFileURL(baseURL: string, path: string[]): URL {
	const __dirname = dirname(fileURLToPath(baseURL));
	return pathToFileURL(resolve(__dirname, ...path));
}

export let settings: SettingsObject = {};
const path = getAbsoluteFileURL(import.meta.url, ['..', '..', '..', 'settings.json']);
if (!existsSync(path)) {
	process.exit(1);
}
settings = JSON.parse(readFileSync(path).toString());
