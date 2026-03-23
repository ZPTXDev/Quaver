import { type Settings, SettingsSchema } from '#src/schemas';
import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

interface TreeifiedError {
    errors: string[];
    properties?: Record<string, TreeifiedError>;
    items?: Array<TreeifiedError | undefined>;
}

const path = getAbsoluteFileURL(import.meta.url, [
    '..',
    '..',
    '..',
    'settings.json',
]);

if (!existsSync(path)) {
    console.error('No settings.json file found. Please create one to proceed.');
    process.exit(1);
}

const rawData = JSON.parse(readFileSync(path).toString());
const result = SettingsSchema.safeParse(rawData);
if (!result.success) {
    const formattedErrors = z.treeifyError(result.error);
    const logErrors = (obj: TreeifiedError, prefix = ''): void => {
        if (obj.errors && Array.isArray(obj.errors)) {
            obj.errors.forEach((err: string): void => {
                console.error(`- ${prefix}: ${err}`);
            });
        }
        if (obj.properties) {
            for (const [key, value] of Object.entries(obj.properties)) {
                logErrors(value, prefix ? `${prefix}.${key}` : key);
            }
        }
        if (obj.items) {
            obj.items.forEach((item, index): void => {
                if (item) logErrors(item, `${prefix}[${index}]`);
            });
        }
    };
    console.error(`\nConfiguration Error\n${'-'.repeat(19)}`);
    logErrors(formattedErrors);
    console.error();
    process.exit(1);
}

export const settings: Settings = result.data;
