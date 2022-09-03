import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { get } from 'lodash-es';
import { data, locales } from './common.js';
import { colors, defaultLocale } from '#settings';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown, SelectMenuBuilder } from 'discord.js';
import fs from 'fs';
import { languageName } from './constants.js';

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
 * Returns the localized string for the specified guild.
 * @param {string} guildId The guild ID.
 * @param {string} string The string to get.
 * @param {...string} vars The extra variables required in some localized strings.
 * @returns {Promise<string|'LOCALE_MISSING'|'STRING_MISSING'>} The localized string, or LOCALE_MISSING if the locale is missing, or STRING_MISSING if the string is missing.
 */
export async function getGuildLocale(guildId, string, ...vars) {
	return getLocale(await data.guild.get(guildId, 'settings.locale') ?? defaultLocale, string, ...vars);
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

	for await (const d of body) {
		fullBody += d.toString();
	}
	return JSON.parse(fullBody);
}

/**
 * Returns a MessageOptions object.
 * @param {string|EmbedBuilder|string[]|EmbedBuilder[]} msgData The data to be used. Can be a string, EmbedBuilder, or an array of either.
 * @param {{type?: "success"|"neutral"|"warning"|"error", components?: import('discord.js').ActionRowBuilder[], files?: import('discord.js').Attachment[]}} optionals Extra data, such as type or components.
 * @returns {import('discord.js').MessageOptions & {embeds: EmbedBuilder[]}} The MessageOptions object.
 */
export function messageDataBuilder(msgData, { type = 'neutral', components = null, files = null } = {}) {
	if (!Array.isArray(msgData)) msgData = [msgData];
	msgData = msgData.map(msg => {
		if (typeof msg === 'string') return new EmbedBuilder().setDescription(msg).setColor(colors[type]);
		if (!msg.data.color) return msg.setColor(colors[type]);
		return msg;
	});
	/** @type {import('discord.js').MessageOptions & {embeds: EmbedBuilder[]}} */
	const opts = { embeds: msgData };
	if (components !== null) opts.components = components;
	if (files !== null) opts.files = files;
	return opts;
}

export async function settingsPage(interaction, guildLocale, option) {
	let current;
	let embeds = [];
	const actionRow = new ActionRowBuilder();
	switch (option) {
		case 'language':
			current = `${languageName[guildLocale] ?? 'Unknown'} (${guildLocale})`;
			actionRow.addComponents(
				new SelectMenuBuilder()
					.setCustomId('language')
					.addOptions(
						fs.readdirSync(getAbsoluteFileURL(import.meta.url, ['..', '..', 'locales']))
							.map(file => ({ label: `${languageName[file] ?? 'Unknown'} (${file})`, value: file, default: file === guildLocale })),
					),
			);
			break;
		case 'format': {
			current = await data.guild.get(interaction.guildId, 'settings.format') ?? 'simple';
			actionRow.addComponents(
				new ButtonBuilder()
					.setCustomId('format_simple')
					.setLabel(getLocale(guildLocale, 'CMD.SETTINGS.MISC.FORMAT.OPTIONS.SIMPLE'))
					.setStyle(current === 'simple' ? ButtonStyle.Success : ButtonStyle.Secondary)
					.setDisabled(current === 'simple'),
				new ButtonBuilder()
					.setCustomId('format_detailed')
					.setLabel(getLocale(guildLocale, 'CMD.SETTINGS.MISC.FORMAT.OPTIONS.DETAILED'))
					.setStyle(current === 'detailed' ? ButtonStyle.Success : ButtonStyle.Secondary)
					.setDisabled(current === 'detailed'),
			);
			embeds = current === 'simple' ? [
				new EmbedBuilder()
					.setDescription(`${getLocale(guildLocale, 'MUSIC.PLAYER.PLAYING.NOW.SIMPLE', escapeMarkdown(getLocale(guildLocale, 'CMD.SETTINGS.MISC.FORMAT.EXAMPLE.SIMPLE')), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '4:20')}\n${getLocale(guildLocale, 'MISC.ADDED_BY', interaction.user.id)}`)
					.setColor(colors.neutral),
			] : [
				new EmbedBuilder()
					.setTitle(getLocale(guildLocale, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE'))
					.setDescription(`**[${escapeMarkdown(getLocale(guildLocale, 'CMD.SETTINGS.MISC.FORMAT.EXAMPLE.DETAILED'))}](https://www.youtube.com/watch?v=dQw4w9WgXcQ)**`)
					.addFields([
						{ name: getLocale(guildLocale, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.DURATION'), value: '`4:20`', inline: true },
						{ name: getLocale(guildLocale, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.UPLOADER'), value: 'Rick Astley', inline: true },
						{ name: getLocale(guildLocale, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.ADDED_BY'), value: `<@${interaction.user.id}>`, inline: true },
					])
					.setThumbnail('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'),
			];
			current = getLocale(guildLocale, `CMD.SETTINGS.MISC.FORMAT.OPTIONS.${current.toUpperCase()}`);
		}
	}
	return { current, embeds, actionRow };
}
