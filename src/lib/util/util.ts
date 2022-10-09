import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { get } from 'lodash-es';
import { data, locales } from './common.js';
import { colors, defaultLocaleCode } from '#src/settings.js';
import { ActionRowBuilder, APISelectMenuOption, AttachmentBuilder, ButtonBuilder, ButtonStyle, ColorResolvable, EmbedBuilder, escapeMarkdown, Interaction, InteractionReplyOptions, MessageActionRowComponentBuilder, MessageCreateOptions, SelectMenuBuilder } from 'discord.js';
import { readdirSync } from 'fs';
import { languageName } from './constants.js';

export type TimeObject = {
	d: number;
	h: number;
	m: number;
	s: number;
}

/**
 * Returns a time object (or a converted equivalent if a format is provided) converted from milliseconds.
 * Reference: https://gist.github.com/flangofas/714f401b63a1c3d84aaa
 * @param milliseconds - The milliseconds to convert.
 * @param format - The format to convert to. Accepts 's' for seconds, 'm' for minutes, 'h' for hours, 'd' for days.
 * @returns TimeObject or the converted equivalent if a format is provided.
 */
export function msToTime(milliseconds: number, format?: 's' | 'm' | 'h' | 'd'): TimeObject | number {
	const total_seconds = Math.floor(milliseconds / 1000);
	const total_minutes = Math.floor(total_seconds / 60);
	const total_hours = Math.floor(total_minutes / 60);
	const days = Math.floor(total_hours / 24);
	const seconds = total_seconds % 60;
	const minutes = total_minutes % 60;
	const hours = total_hours % 24;
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
 * Returns a TimeObject in string format.
 * @param msObject - The TimeObject.
 * @param simple - Whether to return a simple string or a more detailed one.
 * @returns The converted string.
 */
export function msToTimeString(msObject: TimeObject, simple?: boolean): string {
	if (simple) {
		if (msObject['d'] > 0) getLocaleString(defaultLocaleCode, 'MISC.MORE_THAN_A_DAY');
		return `${msObject['h'] > 0 ? `${msObject['h']}:` : ''}${msObject['h'] > 0 ? msObject['m'].toString().padStart(2, '0') : msObject['m']}:${msObject['s'].toString().padStart(2, '0')}`;
	}
	return `${msObject['d'] > 0 ? `${msObject['d']} day${msObject['d'] === 1 ? '' : 's'}, ` : ''}${msObject['h'] > 0 ? `${msObject['h']} hr${msObject['h'] === 1 ? '' : 's'}, ` : ''}${msObject['m'] > 0 ? `${msObject['m']} min${msObject['m'] === 1 ? '' : 's'}, ` : ''}${msObject['s'] > 0 ? `${msObject['s']} sec${msObject['s'] === 1 ? '' : 's'}, ` : ''}`.slice(0, -2);
}

/**
 * Returns a number rounded to the number of decimal places provided.
 * Reference: https://stackoverflow.com/a/15762794
 * @param n - The number to round.
 * @param digits - The number of decimal places to round to.
 * @returns The rounded number.
 */
export function roundTo(n: number, digits: number): number {
	let negative = false;
	if (digits === undefined) digits = 0;
	if (n < 0) {
		negative = true;
		n = n * -1;
	}
	const multiplicator = Math.pow(10, digits);
	n = parseFloat((n * multiplicator).toFixed(11));
	n = parseFloat((Math.round(n) / multiplicator).toFixed(digits));
	if (negative) n = parseFloat((n * -1).toFixed(digits));
	if (digits === 0) n = parseInt(n.toString(), 10);
	return n;
}

/**
 * Returns seconds from a human-readable string.
 * Reference: https://stackoverflow.com/a/54897508
 * @param str - The human-readable string.
 * @returns Seconds extracted from the string.
 */
export function getSeconds(str: string): number {
	let seconds = 0;
	const days = str.match(/(\d+)\s*d/);
	const hours = str.match(/(\d+)\s*h/);
	const minutes = str.match(/(\d+)\s*m/);
	const secs = str.match(/(\d+)\s*s/);
	if (days) seconds += parseInt(days[1]) * 86400;
	if (hours) seconds += parseInt(hours[1]) * 3600;
	if (minutes) seconds += parseInt(minutes[1]) * 60;
	if (secs) seconds += parseInt(secs[1]);
	return seconds;
}

/**
 * Returns a progress bar based on the percentage provided.
 * @param progress - The percentage of the bar to be filled.
 * @returns The progress bar.
 */
export function getBar(progress: number): string {
	if (isNaN(progress) || progress < 10) return '🔘▬▬▬▬▬▬▬▬▬';
	else if (progress < 20) return '▬🔘▬▬▬▬▬▬▬▬';
	else if (progress < 30) return '▬▬🔘▬▬▬▬▬▬▬';
	else if (progress < 40) return '▬▬▬🔘▬▬▬▬▬▬';
	else if (progress < 50) return '▬▬▬▬🔘▬▬▬▬▬';
	else if (progress < 60) return '▬▬▬▬▬🔘▬▬▬▬';
	else if (progress < 70) return '▬▬▬▬▬▬🔘▬▬▬';
	else if (progress < 80) return '▬▬▬▬▬▬▬🔘▬▬';
	else if (progress < 90) return '▬▬▬▬▬▬▬▬🔘▬';
	return '▬▬▬▬▬▬▬▬▬🔘';
}

/**
 * Returns a paginated array.
 * @param arr - The array to paginate.
 * @param size - The size of each page.
 * @returns The paginated array.
 */
// i can't for the life of me figure out how to not use any in this case
// and it honestly makes me lose my mind.
// if you've stumbled across this comment, please help me.
// i've also tried to use generic types but it's like nested and whatnot
// please save me.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function paginate(arr: Array<any>, size: number): Array<Array<any>> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return arr.reduce((acc: Array<any>, val: unknown, i: number): Array<any> => {
		const idx = Math.floor(i / size);
		const page = acc[idx] || (acc[idx] = []);
		page.push(val);
		return acc;
	}, []);
}

/**
 * Returns the localized string.
 * Reference: https://stackoverflow.com/a/63376860
 * @param localeCode - The language to use.
 * @param stringPath - The string to get.
 * @param vars - The extra variables required in some localized strings.
 * @returns The localized string, or LOCALE_MISSING if the locale is missing, or STRING_MISSING if the string is missing.
 */
export function getLocaleString(localeCode: string, stringPath: string, ...vars: string[]): string | 'LOCALE_MISSING' | 'STRING_MISSING' {
	if (!locales.get(localeCode)) return 'LOCALE_MISSING';
	let strings = locales.get(localeCode);
	let localeString: string = get(strings, stringPath);
	if (!localeString) {
		// This uses 'en' on purpose.
		// 'en' is the only locale with a guaranteed 100% completion rate.
		strings = locales.get('en');
		localeString = get(strings, stringPath);
	}
	if (!localeString) return 'STRING_MISSING';
	vars.forEach((v, i): string => localeString = localeString.replace(`%${i + 1}`, v));
	return localeString;
}

/**
 * Returns the localized string for the specified guild.
 * @param guildId - The guild ID.
 * @param stringPath - The string to get.
 * @param vars - The extra variables required in some localized strings.
 * @returns The localized string, or LOCALE_MISSING if the locale is missing, or STRING_MISSING if the string is missing.
 */
export async function getGuildLocaleString(guildId: string, stringPath: string, ...vars: string[]): Promise<string | 'LOCALE_MISSING' | 'STRING_MISSING'> {
	const guildLocaleCode = <string> await data.guild.get(guildId, 'settings.locale') ?? defaultLocaleCode;
	return getLocaleString(guildLocaleCode, stringPath, ...vars);
}

/**
 * Returns locale completion for a given locale.
 * @param localeCode - The locale code to check.
 * @returns Completion percentage and missing strings, or 'LOCALE_MISSING' if the locale is missing.
 */
export function checkLocaleCompletion(localeCode: string): { completion: number; missing: string[]; } | 'LOCALE_MISSING' {
	if (!locales.get(localeCode)) return 'LOCALE_MISSING';
	const englishStrings = locales.get('en');
	const foreignStrings = locales.get(localeCode);
	let foreignStringCount = 0;
	let englishStringCount = 0;
	const missingStrings: string[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function iterateObject(obj: Record<string, any>, path: string[] = []): void {
		Object.keys(obj).forEach((key): void => {
			if (typeof obj[key] === 'object') {
				iterateObject(obj[key], path.concat([key]));
				return;
			}
			englishStringCount++;
			if (!get(foreignStrings, `${path.join('.')}.${key}`)) missingStrings.push(`${path.join('.')}.${key}`);
		});
	}
	iterateObject(<object> englishStrings);
	foreignStringCount = englishStringCount - missingStrings.length;
	// missing strings
	if (englishStringCount > foreignStringCount) return { completion: foreignStringCount / englishStringCount * 100, missing: missingStrings };
	return { completion: 100, missing: [] };
}

/**
 * Returns an absolute file URL, readable by the ESM loader.
 * @param baseURL - The base URL of the module.
 * @param path - The path to the target file.
 * @returns The absolute file URL.
 */
export function getAbsoluteFileURL(baseURL: string, path: string[]): URL {
	const __dirname = dirname(fileURLToPath(baseURL));
	return pathToFileURL(resolve(__dirname, ...path));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getJSONResponse(body: any): Promise<unknown> {
	let fullBody = '';

	for await (const d of body) {
		fullBody += d.toString();
	}
	return JSON.parse(fullBody);
}

/**
 * Returns a MessageCreateOptions object.
 * @param inputData - The data to be used. Can be a string, EmbedBuilder, or an array of either.
 * @param options - Extra data, such as type, components, or files.
 * @returns The MessageCreateOptions object.
 */
export function buildMessageOptions(inputData: string | EmbedBuilder | (string | EmbedBuilder)[], { type = 'neutral', components = null, files = null }: { type?: 'success' | 'neutral' | 'warning' | 'error'; components?: ActionRowBuilder<MessageActionRowComponentBuilder>[]; files?: AttachmentBuilder[]; } = {}): MessageCreateOptions & InteractionReplyOptions {
	const messageData = Array.isArray(inputData) ? inputData : [inputData];
	const embedData = messageData.map((msg): EmbedBuilder => {
		if (typeof msg === 'string') return new EmbedBuilder().setDescription(msg).setColor(<ColorResolvable> colors[type]);
		if (!msg.data.color) return msg.setColor(<ColorResolvable> colors[type]);
		return msg;
	});
	const opts: MessageCreateOptions & InteractionReplyOptions = { embeds: embedData };
	if (components !== null) opts.components = components;
	if (files !== null) opts.files = files;
	return opts;
}

export async function settingsPage(interaction: Interaction, guildLocaleCode: string, option: 'language' | 'format'): Promise<{ current: string; embeds: EmbedBuilder[]; actionRow: ActionRowBuilder; }> {
	let current: string;
	let embeds: EmbedBuilder[] = [];
	const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
	switch (option) {
		case 'language':
			current = `${languageName[guildLocaleCode] ?? 'Unknown'} (${guildLocaleCode})`;
			actionRow.addComponents(
				new SelectMenuBuilder()
					.setCustomId('language')
					.addOptions(
						readdirSync(getAbsoluteFileURL(import.meta.url, ['..', '..', '..', 'locales']))
							.map((file): APISelectMenuOption => ({ label: `${languageName[file] ?? 'Unknown'} (${file})`, value: file, default: file === guildLocaleCode })),
					),
			);
			break;
		case 'format': {
			current = <string> await data.guild.get(interaction.guildId, 'settings.format') ?? 'simple';
			actionRow.addComponents(
				new ButtonBuilder()
					.setCustomId('format_simple')
					.setLabel(getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.FORMAT.OPTIONS.SIMPLE'))
					.setStyle(current === 'simple' ? ButtonStyle.Success : ButtonStyle.Secondary)
					.setDisabled(current === 'simple'),
				new ButtonBuilder()
					.setCustomId('format_detailed')
					.setLabel(getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.FORMAT.OPTIONS.DETAILED'))
					.setStyle(current === 'detailed' ? ButtonStyle.Success : ButtonStyle.Secondary)
					.setDisabled(current === 'detailed'),
			);
			embeds = current === 'simple' ? [
				new EmbedBuilder()
					.setDescription(`${getLocaleString(guildLocaleCode, 'MUSIC.PLAYER.PLAYING.NOW.SIMPLE', escapeMarkdown(getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.FORMAT.EXAMPLE.SIMPLE')), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '4:20')}\n${getLocaleString(guildLocaleCode, 'MISC.ADDED_BY', interaction.user.id)}`)
					.setColor(<ColorResolvable> colors.neutral),
			] : [
				new EmbedBuilder()
					.setTitle(getLocaleString(guildLocaleCode, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE'))
					.setDescription(`**[${escapeMarkdown(getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.FORMAT.EXAMPLE.DETAILED'))}](https://www.youtube.com/watch?v=dQw4w9WgXcQ)**`)
					.addFields([
						{ name: getLocaleString(guildLocaleCode, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.DURATION'), value: '`4:20`', inline: true },
						{ name: getLocaleString(guildLocaleCode, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.UPLOADER'), value: 'Rick Astley', inline: true },
						{ name: getLocaleString(guildLocaleCode, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.ADDED_BY'), value: `<@${interaction.user.id}>`, inline: true },
					])
					.setThumbnail('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'),
			];
			current = getLocaleString(guildLocaleCode, `CMD.SETTINGS.MISC.FORMAT.OPTIONS.${current.toUpperCase()}`);
		}
	}
	return { current, embeds, actionRow };
}
