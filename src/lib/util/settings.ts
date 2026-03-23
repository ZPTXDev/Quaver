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
    console.error(`\nConfiguration Error\n${'-'.repeat(19)}`);
    console.error('- settings.json: File missing\n');
    process.exit(1);
}

let rawData: unknown;
try {
    rawData = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
    console.error(`\nConfiguration Error\n${'-'.repeat(19)}`);
    console.error(
        `- settings.json: Invalid JSON (${error instanceof Error ? error.message : String(error)})\n`,
    );
    process.exit(1);
}
const result = SettingsSchema.safeParse(rawData);
if (!result.success) {
    const formattedErrors = z.treeifyError(result.error);
    const logErrors = (obj: TreeifiedError, prefix = ''): void => {
        if (obj.errors && Array.isArray(obj.errors)) {
            obj.errors.forEach((err: string): void => {
                console.error(`- ${prefix || '<root>'}: ${err}`);
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
