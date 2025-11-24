import type { LocaleKey } from '#src/lib/locales';
import { Collection, escapeMarkdown } from 'discord.js';
import { get } from 'lodash-es';

export enum Language {
    ceb = 'Cebuano',
    en = 'English',
    fil = 'Filipino',
}

type LocaleCompletionState = {
    completion: number;
    missing: string[];
};

export let locales = new Collection();

export function setLocales(newLocales: Collection<string, unknown>): void {
    locales = newLocales;
}

/**
 * Returns the localized string.
 * Reference: https://stackoverflow.com/a/63376860
 * @param localeCode - The language to use.
 * @param stringPath - The string to get.
 * @param vars - The extra variables required in some localized strings.
 * @returns The localized string, or LOCALE_MISSING if the locale is missing, or stringPath if the string is missing.
 */
export function getLocaleString(
    localeCode: string,
    stringPath: LocaleKey,
    ...vars: string[]
): string | 'LOCALE_MISSING' {
    if (!locales.get(localeCode)) return 'LOCALE_MISSING';
    let strings = locales.get(localeCode);
    let localeString: string = get(strings, stringPath);
    if (!localeString) {
        // This uses 'en' on purpose.
        // 'en' is the only locale with a guaranteed 100% completion rate.
        strings = locales.get('en');
        localeString = get(strings, stringPath);
    }
    if (!localeString) return stringPath;
    const safeVars = vars.map((v): string => encodeURI(escapeMarkdown(v)));
    const varMap: Record<string, string> = {};
    safeVars.forEach((v, i): void => {
        varMap[`%${i + 1}`] = v;
    });
    localeString = localeString.replace(/%\d+/g, (match): string => {
        const index = parseInt(match.slice(1), 10);
        if (isNaN(index) || index < 1 || index > safeVars.length) {
            return match;
        }
        return decodeURI(varMap[match]);
    });
    return localeString;
}

/**
 * Returns locale completion for a given locale.
 * @param localeCode - The locale code to check.
 * @returns Completion percentage and missing strings, or 'LOCALE_MISSING' if the locale is missing.
 */
export function checkLocaleCompletion(
    localeCode: string,
): LocaleCompletionState | 'LOCALE_MISSING' {
    if (!locales.get(localeCode)) return 'LOCALE_MISSING';
    const englishStrings = locales.get('en');
    const foreignStrings = locales.get(localeCode);
    let englishStringCount = 0;
    const missingStrings: string[] = [];

    function iterateObject(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obj: Record<string, any>,
        path: string[] = [],
    ): void {
        Object.keys(obj).forEach((key): void => {
            if (typeof obj[key] === 'object') {
                iterateObject(obj[key], path.concat([key]));
                return;
            }
            englishStringCount++;
            if (!get(foreignStrings, `${path.join('.')}.${key}`)) {
                missingStrings.push(`${path.join('.')}.${key}`);
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    iterateObject(englishStrings as Record<string, any>);
    const foreignStringCount = englishStringCount - missingStrings.length;
    // missing strings
    if (englishStringCount > foreignStringCount) {
        return {
            completion: (foreignStringCount / englishStringCount) * 100,
            missing: missingStrings,
        };
    }
    return { completion: 100, missing: [] };
}

export * from './types';
