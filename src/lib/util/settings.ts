import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import { existsSync, readFileSync } from 'fs';
import type { SettingsObject } from './settings.d.js';

export let settings: SettingsObject = {};
const path = getAbsoluteFileURL(import.meta.url, [
    '..',
    '..',
    '..',
    'settings.json',
]);
if (!existsSync(path)) {
    process.exit(1);
}
settings = JSON.parse(readFileSync(path).toString());
