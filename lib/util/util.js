import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { get } from 'lodash-es';
import { locales } from './common.js';
import { defaultLocale } from '#settings';

/**
 * Returns a time object (or a converted equivalent if a format is provided) converted from milliseconds.
 * Reference: https://gist.github.com/flangofas/714f401b63a1c3d84aaa
 * @param {number} milliseconds The milliseconds to convert.
 * @param {'s'|'m'|'h'|'d'} [format] The format to convert to. Accepts 's' for seconds, 'm' for minutes, 'h' for hours, 'd' for days.
 * @returns {{d: number, h: number, m: number, s: number}|number} Time object or the converted equivalent if a format is provided.
 */
export function msToTime(milliseconds, format) {
	const total_seconds = parseInt(Math.floor(milliseconds / 1000));
	const total_minutes = parseInt(Math.floor(total_seconds / 60));
	const total_hours = parseInt(Math.floor(total_minutes / 60));
	const days = parseInt(Math.floor(total_hours / 24));

	const seconds = parseInt(total_seconds % 60);
	const minutes = parseInt(total_minutes % 60);
	const hours = parseInt(total_hours % 24);

	switch (format) {
		case 's':
			return total_seconds;
		case 'm':
			return total_minutes;
		case 'h':
			return total_hours;
		case 'd':
			return days;
		default:
			return { d: days, h: hours, m: minutes, s: seconds };
	}
}

/**
 * Returns a converted time object (from msToTime) in string format.
 * @param {{d: number, h: number, m: number, s: number}} msObject The time object provided by msToTime.
 * @param {boolean} simple Whether to return a simple string or a more detailed one.
 * @returns {string} The converted string.
 */
export function msToTimeString(msObject, simple) {
	if (simple) {
		if (msObject['d'] > 0) {
			return getLocale(defaultLocale, 'MISC.MORE_THAN_A_DAY');
		}
		return `${msObject['h'] > 0 ? `${msObject['h']}:` : ''}${msObject['h'] > 0 ? msObject['m'].toString().padStart(2, '0') : msObject['m']}:${msObject['s'].toString().padStart(2, '0')}`;
	}
	return `${msObject['d'] > 0 ? `${msObject['d']} day${msObject['d'] === 1 ? '' : 's'}, ` : ''}${msObject['h'] > 0 ? `${msObject['h']} hr${msObject['h'] === 1 ? '' : 's'}, ` : ''}${msObject['m'] > 0 ? `${msObject['m']} min${msObject['m'] === 1 ? '' : 's'}, ` : ''}${msObject['s'] > 0 ? `${msObject['s']} sec${msObject['s'] === 1 ? '' : 's'}, ` : ''}`.slice(0, -2);
}

/**
 * Returns a number rounded to the number of decimal places provided.
 * Reference: https://stackoverflow.com/a/15762794
 * @param {number} n The number to round.
 * @param {number} digits The number of decimal places to round to.
 * @returns {number} The rounded number.
 */
export function roundTo(n, digits) {
	let negative = false;
	if (digits === undefined) {digits = 0;}
	if (n < 0) {
		negative = true;
		n = n * -1;
	}
	const multiplicator = Math.pow(10, digits);
	n = parseFloat((n * multiplicator).toFixed(11));
	n = (Math.round(n) / multiplicator).toFixed(digits);
	if (negative) {n = (n * -1).toFixed(digits);}
	if (digits === 0) {n = parseInt(n, 10);}
	return n;
}

/**
 * Returns seconds from a human-readable string.
 * Reference: https://stackoverflow.com/a/54897508
 * @param {string} str The human-readable string.
 * @returns {number} Seconds extracted from the string.
 */
export function getSeconds(str) {
	let seconds = 0;
	const days = str.match(/(\d+)\s*d/);
	const hours = str.match(/(\d+)\s*h/);
	const minutes = str.match(/(\d+)\s*m/);
	const secs = str.match(/(\d+)\s*s/);
	if (days) { seconds += parseInt(days[1]) * 86400; }
	if (hours) { seconds += parseInt(hours[1]) * 3600; }
	if (minutes) { seconds += parseInt(minutes[1]) * 60; }
	if (secs) { seconds += parseInt(secs[1]); }
	return seconds;
}

/**
 * Returns a progress bar based on the percentage provided.
 * @param {number} progress The percentage of the bar to be filled.
 * @returns {string} The progress bar.
 */
export function getBar(progress) {
	if (isNaN(progress) || progress < 10) {return '🔘▬▬▬▬▬▬▬▬▬';}
	else if (progress < 20) {return '▬🔘▬▬▬▬▬▬▬▬';}
	else if (progress < 30) {return '▬▬🔘▬▬▬▬▬▬▬';}
	else if (progress < 40) {return '▬▬▬🔘▬▬▬▬▬▬';}
	else if (progress < 50) {return '▬▬▬▬🔘▬▬▬▬▬';}
	else if (progress < 60) {return '▬▬▬▬▬🔘▬▬▬▬';}
	else if (progress < 70) {return '▬▬▬▬▬▬🔘▬▬▬';}
	else if (progress < 80) {return '▬▬▬▬▬▬▬🔘▬▬';}
	else if (progress < 90) {return '▬▬▬▬▬▬▬▬🔘▬';}
	else {return '▬▬▬▬▬▬▬▬▬🔘';}
}

/**
 * Returns a paginated array.
 * @param {Array} arr The array to paginate.
 * @param {number} size The size of each page.
 * @returns {Array} The paginated array.
 */
export function paginate(arr, size) {
	return arr.reduce((acc, val, i) => {
		const idx = Math.floor(i / size);
		const page = acc[idx] || (acc[idx] = []);
		page.push(val);
		return acc;
	}, []);
}

/**
 * Returns the localized string.
 * Reference: https://stackoverflow.com/a/63376860
 * @param {string} language The language to use.
 * @param {string} string The string to get.
 * @param {...string} vars The extra variables required in some localized strings.
 * @returns {string|'LOCALE_MISSING'|'STRING_MISSING'} The localized string, or LOCALE_MISSING if the locale is missing, or STRING_MISSING if the string is missing.
 */
export function getLocale(language, string, ...vars) {
	if (!locales.get(language)) return 'LOCALE_MISSING';
	let strings = locales.get(language);
	let locale = get(strings, string);
	if (!locale) {
		// This uses 'en' on purpose.
		// 'en' is the only locale with a guaranteed 100% completion rate.
		strings = locales.get('en');
		locale = get(strings, string);
	}
	if (!locale) return 'STRING_MISSING';
	vars.forEach((v, i) => {
		locale = locale.replace(`%${i + 1}`, v);
	});
	return locale;
}

/**
 * Returns locale completion for a given locale.
 * @param {string} language The locale code to check.
 * @returns {{completion: number, missing: string[]}|'LOCALE_MISSING'} Completion percentage and missing strings, or 'LOCALE_MISSING' if the locale is missing.
 */
export function checkLocaleCompletion(language) {
	if (!locales.get(language)) return 'LOCALE_MISSING';
	const strings = locales.get('en');
	const foreignStrings = locales.get(language);
	let foreignStringCount = 0;
	let stringCount = 0;
	const missingStrings = [];
	function iterateObject(obj, path = []) {
		Object.keys(obj).forEach(key => {
			if (typeof obj[key] === 'object') { iterateObject(obj[key], path.concat([key])); }
			else {
				stringCount++;
				if (!get(foreignStrings, `${path.join('.')}.${key}`)) missingStrings.push(`${path.join('.')}.${key}`);
			}
		});
	}
	iterateObject(strings);
	foreignStringCount = stringCount - missingStrings.length;
	// missing strings
	if (stringCount > foreignStringCount) {
		return { completion: foreignStringCount / stringCount * 100, missing: missingStrings };
	}
	return { completion: 100, missing: [] };
}

/**
 * Returns an absolute file URL, readable by the ESM loader.
 * @param {string} baseURL The base URL of the module.
 * @param {string[]} path The path to the target file.
 * @returns {URL} The absolute file URL.
 */
export function getAbsoluteFileURL(baseURL, path) {
	const __dirname = dirname(fileURLToPath(baseURL));
	return pathToFileURL(resolve(__dirname, ...path));
}

export async function getJSONResponse(body) {
	let fullBody = '';

	for await (const data of body) {
		fullBody += data.toString();
	}
	return JSON.parse(fullBody);
}
