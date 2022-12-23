import type {
    MessageOptionsBuilderInputs,
    MessageOptionsBuilderOptions,
    QuaverChannels,
    QuaverClient,
    QuaverSong,
    SettingsPage,
    SettingsPageOptions,
    WhitelistedFeatures,
} from '#src/lib/util/common.d.js';
import {
    data,
    locales,
    MessageOptionsBuilderType,
} from '#src/lib/util/common.js';
import { Check, Language } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import type {
    APIEmbedField,
    APISelectMenuOption,
    ButtonInteraction,
    Interaction,
    InteractionReplyOptions,
    MessageActionRowComponentBuilder,
    MessageCreateOptions,
    ModalSubmitInteraction,
    RoleSelectMenuInteraction,
    Snowflake,
    StringSelectMenuInteraction,
} from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    escapeMarkdown,
    GuildMember,
    PermissionsBitField,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
} from 'discord.js';
import { readdirSync } from 'fs';
import { get } from 'lodash-es';
import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import type {
    LocaleCompletionState,
    TimeFormats,
    TimeObject,
} from './util.d.js';

/**
 * Returns a time object (or a converted equivalent if a format is provided) converted from milliseconds.
 * Reference: https://gist.github.com/flangofas/714f401b63a1c3d84aaa
 * @param milliseconds - The milliseconds to convert.
 * @param format - The format to convert to. Accepts 's' for seconds, 'm' for minutes, 'h' for hours, 'd' for days.
 * @returns TimeObject or the converted equivalent if a format is provided.
 */
export function msToTime(milliseconds: number, format: TimeFormats): number;
export function msToTime(milliseconds: number): TimeObject;
export function msToTime(
    milliseconds: number,
    format?: TimeFormats,
): TimeObject | number {
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
        if (msObject['d'] > 0) {
            getLocaleString(settings.defaultLocaleCode, 'MISC.MORE_THAN_A_DAY');
        }
        return `${msObject['h'] > 0 ? `${msObject['h']}:` : ''}${
            msObject['h'] > 0
                ? msObject['m'].toString().padStart(2, '0')
                : msObject['m']
        }:${msObject['s'].toString().padStart(2, '0')}`;
    }
    return `${
        msObject['d'] > 0
            ? `${msObject['d']} day${msObject['d'] === 1 ? '' : 's'}, `
            : ''
    }${
        msObject['h'] > 0
            ? `${msObject['h']} hr${msObject['h'] === 1 ? '' : 's'}, `
            : ''
    }${
        msObject['m'] > 0
            ? `${msObject['m']} min${msObject['m'] === 1 ? '' : 's'}, `
            : ''
    }${
        msObject['s'] > 0
            ? `${msObject['s']} sec${msObject['s'] === 1 ? '' : 's'}, `
            : ''
    }`.slice(0, -2);
}

/**
 * Parses a human-readable time string into milliseconds.
 * @param timeString - The time string to parse.
 * @returns The parsed milliseconds.
 */
export function parseTimeString(timeString: string): number {
    const timeRegex = /(\d+)([smhd])/g;
    const timeMatches = timeString.matchAll(timeRegex);
    let time = 0;
    for (const match of timeMatches) {
        const amount = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's':
                time += amount * 1000;
                break;
            case 'm':
                time += amount * 1000 * 60;
                break;
            case 'h':
                time += amount * 1000 * 60 * 60;
                break;
            case 'd':
                time += amount * 1000 * 60 * 60 * 24;
                break;
        }
    }
    return time;
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
export function paginate(arr: any[], size: number): any[][] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return arr.reduce((acc: any[], val: unknown, i: number): any[] => {
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
 * @returns The localized string, or LOCALE_MISSING if the locale is missing, or stringPath if the string is missing.
 */
export function getLocaleString(
    localeCode: string,
    stringPath: string,
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
    vars.forEach(
        (v, i): string => (localeString = localeString.replace(`%${i + 1}`, v)),
    );
    return localeString;
}

/**
 * Returns the localized string for the specified guild.
 * @param guildId - The guild ID.
 * @param stringPath - The string to get.
 * @param vars - The extra variables required in some localized strings.
 * @returns The localized string, or LOCALE_MISSING if the locale is missing, or stringPath if the string is missing.
 */
export async function getGuildLocaleString(
    guildId: Snowflake,
    stringPath: string,
    ...vars: string[]
): Promise<string | 'LOCALE_MISSING'> {
    const guildLocaleCode =
        (await data.guild.get<string>(guildId, 'settings.locale')) ??
        settings.defaultLocaleCode;
    return getLocaleString(guildLocaleCode, stringPath, ...vars);
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
    let foreignStringCount = 0;
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
    foreignStringCount = englishStringCount - missingStrings.length;
    // missing strings
    if (englishStringCount > foreignStringCount) {
        return {
            completion: (foreignStringCount / englishStringCount) * 100,
            missing: missingStrings,
        };
    }
    return { completion: 100, missing: [] };
}

export enum WhitelistStatus {
    /**
     * The guild is not whitelisted
     */
    NotWhitelisted,
    /**
     * The whitelist has expired
     */
    Expired,
    /**
     * The whitelist is temporary
     */
    Temporary,
    /**
     * The whitelist is permanent
     */
    Permanent,
}

/**
 * Checks if a guild is whitelisted for a feature.
 * @param guildId - The guild ID.
 * @param feature - The feature to check.
 * @returns Whether the guild is whitelisted.
 */
export async function getGuildFeatureWhitelisted(
    guildId: Snowflake,
    feature: WhitelistedFeatures,
): Promise<WhitelistStatus> {
    const whitelisted = await data.guild.get<number>(
        guildId,
        `features.${feature}.whitelisted`,
    );
    if (!whitelisted) return WhitelistStatus.NotWhitelisted;
    if (whitelisted !== -1 && Date.now() > whitelisted) {
        return WhitelistStatus.Expired;
    }
    if (whitelisted === -1) return WhitelistStatus.Permanent;
    return WhitelistStatus.Temporary;
}

export enum RequesterStatus {
    /**
     * The user is not the requester
     */
    NotRequester,
    /**
     * The user is not the requester, but has a role that can bypass typical requester checks
     */
    RoleBypass,
    /**
     * The user is not the requester, but has a permission (Manage Server) that can bypass typical requester checks
     */
    PermissionBypass,
    /**
     * The user is not the requester, but is a manager defined in settings.json
     */
    ManagerBypass,
    /**
     * The user is the requester
     */
    Requester,
}

/**
 * Returns the requester status of a user for a track.
 * @param track - The track to check against.
 * @param member - The member to check permissions for.
 * @param channel - The channel to check against.
 * @returns Whether the member is the requester of the track.
 */
export async function getRequesterStatus(
    track: QuaverSong,
    member: GuildMember,
    channel: QuaverChannels,
): Promise<RequesterStatus> {
    if (track.requester === member.id) return RequesterStatus.Requester;
    const djRole = await data.guild.get<Snowflake>(
        member.guild.id,
        'settings.dj',
    );
    const dj = djRole && member.roles.cache.has(djRole);
    if (dj) return RequesterStatus.RoleBypass;
    const guildManager =
        channel
            .permissionsFor(member)
            .missing(PermissionsBitField.Flags.ManageGuild).length === 0;
    if (guildManager) return RequesterStatus.PermissionBypass;
    const botManager = settings.managers.includes(member.id);
    if (botManager) return RequesterStatus.ManagerBypass;
    return RequesterStatus.NotRequester;
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
 * Returns all failed checks given a list of checks.
 * @param checks - The checks to run.
 * @param guildId - The guild ID.
 * @param member - The member to check.
 * @param interaction - The interaction, only required if checking for InteractionStarter.
 * @returns All failed checks.
 */
export function getFailedChecks(
    checks: Check[],
    guildId: Snowflake,
    member: GuildMember & { client: QuaverClient },
    interaction?:
        | ButtonInteraction
        | StringSelectMenuInteraction
        | RoleSelectMenuInteraction
        | ModalSubmitInteraction,
): Check[] {
    const failedChecks: Check[] = [];
    for (const check of checks ?? []) {
        switch (check) {
            case Check.GuildOnly:
                if (!guildId) failedChecks.push(check);
                break;
            case Check.ActiveSession: {
                if (!guildId) {
                    failedChecks.push(check);
                    break;
                }
                const player = member.client.music.players.get(guildId);
                if (!player) failedChecks.push(check);
                break;
            }
            case Check.InVoice:
                if (
                    !(member instanceof GuildMember) ||
                    !member?.voice.channelId
                ) {
                    failedChecks.push(check);
                }
                break;
            case Check.InSessionVoice: {
                const player = member.client.music.players.get(guildId);
                if (
                    player &&
                    member instanceof GuildMember &&
                    member?.voice.channelId !== player.channelId
                ) {
                    failedChecks.push(check);
                }
                break;
            }
            case Check.InteractionStarter: {
                if (interaction.message.interaction.user.id !== member.id) {
                    failedChecks.push(check);
                }
            }
        }
    }
    return failedChecks;
}

/**
 * Returns a sorted queue to ensure all requesters have a fair chance of playing their track.
 * @param queue - The queue to sort.
 * @returns The sorted queue.
 */
export function sortQueue(queue: QuaverSong[]): QuaverSong[] {
    if (queue.length === 0) return [];
    const sorted = [];
    const copy = [...queue];
    while (copy.length > 0) {
        // sorted is empty, so we start it off
        if (sorted.length === 0) {
            sorted.push(copy.shift());
            continue;
        }
        if (
            // the last requester is the same as the next requester
            sorted[sorted.length - 1].requester === copy[0].requester &&
            // and there is more than 1 requester in the queue
            new Set(copy.map((song): Snowflake => song.requester)).size >= 2
        ) {
            // deal with the next requester later, move them to the next position behind another requester
            copy.splice(
                copy.findIndex(
                    (element: QuaverSong): boolean =>
                        element.requester !== copy[0].requester,
                ),
                0,
                copy.shift(),
            );
            continue;
        }
        // the last requester is not the same as the next requester, or there is only 1 requester in the queue
        sorted.push(copy.shift());
    }
    return sorted;
}

/**
 * Generates an array of APIEmbedField from the lyrics.
 * @param query - The query to be used.
 * @param lyrics - The lyrics to be used.
 * @returns An array of APIEmbedField.
 */
export function generateEmbedFieldsFromLyrics(
    query: string,
    lyrics: string,
): APIEmbedField[] {
    let lyricsFields: APIEmbedField[] = [];
    // try method 1
    let giveUp = false;
    if (lyrics.split('\n\n').length === 1) giveUp = true;
    lyrics.split('\n\n').reduce((previous, chunk, index, array): string => {
        if (giveUp) return;
        if (chunk.length > 1024) giveUp = true;
        if (previous.length + chunk.length + '\n\n'.length > 1024) {
            lyricsFields.push({
                name: lyricsFields.length === 0 ? query : '​',
                value: previous,
            });
            return chunk;
        }
        if (index === array.length - 1) {
            lyricsFields.push({
                name: lyricsFields.length === 0 ? query : '​',
                value: previous + '\n\n' + chunk,
            });
        }
        return previous + '\n\n' + chunk;
    });
    if (giveUp) {
        lyricsFields = [];
        // try method 2
        lyrics.split('\n').reduce((previous, line, index, array): string => {
            if (previous.length + line.length + '\n'.length > 1024) {
                lyricsFields.push({
                    name: lyricsFields.length === 0 ? query : '​',
                    value: previous,
                });
                return line;
            }
            if (index === array.length - 1) {
                lyricsFields.push({
                    name: lyricsFields.length === 0 ? query : '​',
                    value: previous + '\n' + line,
                });
            }
            return previous + '\n' + line;
        }, '');
    }
    if (
        lyricsFields.reduce(
            (previous, current): number => previous + current.value.length,
            0,
        ) > 6000
    ) {
        let exceedIndex = -1;
        lyricsFields.reduce((previous, current, index): number => {
            if (exceedIndex !== -1) return;
            if (previous + current.value.length > 6000) {
                exceedIndex = index;
            }
            return previous + current.value.length;
        }, 0);
        lyricsFields = lyricsFields.slice(0, exceedIndex);
        lyricsFields.push({ name: '​', value: '`...`' });
    }
    return lyricsFields;
}

/**
 * Returns a MessageCreateOptions object.
 * @param inputData - The data to be used. Can be a string, EmbedBuilder, or an array of either.
 * @param options - Extra data, such as type, components, or files.
 * @returns The MessageCreateOptions object.
 */
export function buildMessageOptions(
    inputData: MessageOptionsBuilderInputs,
    {
        type = MessageOptionsBuilderType.Neutral,
        components = null,
        files = null,
    }: MessageOptionsBuilderOptions = {},
): MessageCreateOptions & InteractionReplyOptions {
    const messageData = Array.isArray(inputData) ? inputData : [inputData];
    const color: 'success' | 'neutral' | 'warning' | 'error' =
        MessageOptionsBuilderType[type].toLowerCase() as
            | 'success'
            | 'neutral'
            | 'warning'
            | 'error';
    const embedData = messageData.map((msg): EmbedBuilder => {
        if (typeof msg === 'string') {
            return new EmbedBuilder()
                .setDescription(msg)
                .setColor(settings.colors[color]);
        }
        if (!msg.data.color) return msg.setColor(settings.colors[color]);
        return msg;
    });
    const opts: MessageCreateOptions & InteractionReplyOptions = {
        embeds: embedData,
    };
    if (components !== null) opts.components = components;
    if (files !== null) opts.files = files;
    return opts;
}

/**
 * Returns a SettingsPage object.
 * @param interaction - The interaction to use for context.
 * @param guildLocaleCode - The guild's locale code.
 * @param option - The option to display.
 * @returns A Promise of a SettingsPage object.
 */
export async function buildSettingsPage(
    interaction: Interaction,
    guildLocaleCode: keyof typeof Language,
    option: SettingsPageOptions,
): Promise<SettingsPage> {
    let current: string,
        embeds: EmbedBuilder[] = [];
    const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
    switch (option) {
        case 'premium': {
            current = '';
            actionRow.addComponents(
                new ButtonBuilder()
                    .setLabel(
                        await getGuildLocaleString(
                            interaction.guildId,
                            'MISC.GET_PREMIUM',
                        ),
                    )
                    .setStyle(ButtonStyle.Link)
                    .setURL(settings.premiumURL),
            );
            const whitelisted = {
                stay: await data.guild.get<number>(
                    interaction.guildId,
                    'features.stay.whitelisted',
                ),
                autolyrics: await data.guild.get<number>(
                    interaction.guildId,
                    'features.autolyrics.whitelisted',
                ),
                smartqueue: await data.guild.get<number>(
                    interaction.guildId,
                    'features.smartqueue.whitelisted',
                ),
            };
            const features = Object.keys(whitelisted)
                .filter(
                    (key: WhitelistedFeatures): boolean =>
                        settings.features[key].enabled &&
                        settings.features[key].whitelist &&
                        settings.features[key].premium,
                )
                .map(
                    (key: WhitelistedFeatures): string =>
                        `**${getLocaleString(
                            guildLocaleCode,
                            `CMD.SETTINGS.MISC.PREMIUM.FEATURES.${key.toUpperCase()}`,
                        )}** ─ ${
                            !whitelisted[key]
                                ? getLocaleString(
                                      guildLocaleCode,
                                      'CMD.SETTINGS.MISC.PREMIUM.DISPLAY.LOCKED.DEFAULT',
                                  )
                                : whitelisted[key] !== -1 &&
                                  Date.now() > whitelisted[key]
                                ? getLocaleString(
                                      guildLocaleCode,
                                      'CMD.SETTINGS.MISC.PREMIUM.DISPLAY.LOCKED.EXPIRED',
                                      Math.floor(
                                          whitelisted[key] / 1000,
                                      ).toString(),
                                  )
                                : whitelisted[key] === -1
                                ? getLocaleString(
                                      guildLocaleCode,
                                      'CMD.SETTINGS.MISC.PREMIUM.DISPLAY.UNLOCKED.PERMANENT',
                                  )
                                : getLocaleString(
                                      guildLocaleCode,
                                      'CMD.SETTINGS.MISC.PREMIUM.DISPLAY.UNLOCKED.TEMPORARY',
                                      Math.floor(
                                          whitelisted[key] / 1000,
                                      ).toString(),
                                  )
                        }`,
                );
            embeds = [
                new EmbedBuilder()
                    .setDescription(features.join('\n'))
                    .setColor(settings.colors.neutral),
            ];
            break;
        }
        case 'language':
            current = `\`${
                Language[guildLocaleCode] ?? 'Unknown'
            } (${guildLocaleCode})\``;
            actionRow.addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('language')
                    .addOptions(
                        readdirSync(
                            getAbsoluteFileURL(import.meta.url, [
                                '..',
                                '..',
                                '..',
                                'locales',
                            ]),
                        ).map(
                            (
                                file: keyof typeof Language,
                            ): APISelectMenuOption => ({
                                label: `${
                                    Language[file] ?? 'Unknown'
                                } (${file})`,
                                value: file,
                                default: file === guildLocaleCode,
                            }),
                        ),
                    ),
            );
            break;
        case 'format': {
            const exampleId = 'dQw4w9WgXcQ';
            current =
                (await data.guild.get<string>(
                    interaction.guildId,
                    'settings.format',
                )) ?? 'simple';
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('format:simple')
                    .setLabel(
                        getLocaleString(
                            guildLocaleCode,
                            'CMD.SETTINGS.MISC.FORMAT.OPTIONS.SIMPLE',
                        ),
                    )
                    .setStyle(
                        current === 'simple'
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary,
                    )
                    .setDisabled(current === 'simple'),
                new ButtonBuilder()
                    .setCustomId('format:detailed')
                    .setLabel(
                        getLocaleString(
                            guildLocaleCode,
                            'CMD.SETTINGS.MISC.FORMAT.OPTIONS.DETAILED',
                        ),
                    )
                    .setStyle(
                        current === 'detailed'
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary,
                    )
                    .setDisabled(current === 'detailed'),
            );
            embeds =
                current === 'simple'
                    ? [
                          new EmbedBuilder()
                              .setDescription(
                                  `${getLocaleString(
                                      guildLocaleCode,
                                      'MUSIC.PLAYER.PLAYING.NOW.SIMPLE',
                                      escapeMarkdown(
                                          getLocaleString(
                                              guildLocaleCode,
                                              'CMD.SETTINGS.MISC.FORMAT.EXAMPLE.SIMPLE',
                                          ),
                                      ),
                                      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                                      '4:20',
                                  )}\n${getLocaleString(
                                      guildLocaleCode,
                                      'MISC.ADDED_BY',
                                      interaction.user.id,
                                  )}`,
                              )
                              .setColor(settings.colors.neutral),
                      ]
                    : [
                          new EmbedBuilder()
                              .setTitle(
                                  getLocaleString(
                                      guildLocaleCode,
                                      'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE',
                                  ),
                              )
                              .setDescription(
                                  `**[${escapeMarkdown(
                                      getLocaleString(
                                          guildLocaleCode,
                                          'CMD.SETTINGS.MISC.FORMAT.EXAMPLE.DETAILED',
                                      ),
                                  )}](https://www.youtube.com/watch?v=${exampleId})**`,
                              )
                              .addFields([
                                  {
                                      name: getLocaleString(
                                          guildLocaleCode,
                                          'MUSIC.PLAYER.PLAYING.NOW.DETAILED.DURATION',
                                      ),
                                      value: '`4:20`',
                                      inline: true,
                                  },
                                  {
                                      name: getLocaleString(
                                          guildLocaleCode,
                                          'MUSIC.PLAYER.PLAYING.NOW.DETAILED.UPLOADER',
                                      ),
                                      value: 'Rick Astley',
                                      inline: true,
                                  },
                                  {
                                      name: getLocaleString(
                                          guildLocaleCode,
                                          'MUSIC.PLAYER.PLAYING.NOW.DETAILED.ADDED_BY',
                                      ),
                                      value: `<@${interaction.user.id}>`,
                                      inline: true,
                                  },
                              ])
                              .setThumbnail(
                                  `https://i.ytimg.com/vi/${exampleId}/hqdefault.jpg`,
                              )
                              .setFooter({
                                  text: getLocaleString(
                                      guildLocaleCode,
                                      'MUSIC.PLAYER.PLAYING.NOW.DETAILED.REMAINING',
                                      '1',
                                  ),
                              }),
                      ];
            current = `\`${getLocaleString(
                guildLocaleCode,
                `CMD.SETTINGS.MISC.FORMAT.OPTIONS.${current.toUpperCase()}`,
            )}\``;
            break;
        }
        case 'dj': {
            current = await data.guild.get<Snowflake>(
                interaction.guildId,
                'settings.dj',
            );
            if (!current) {
                current = `\`${getLocaleString(
                    guildLocaleCode,
                    'MISC.NONE',
                )}\``;
            } else {
                current = `<@&${current}>`;
            }
            actionRow.addComponents(
                new RoleSelectMenuBuilder().setCustomId('dj').setMinValues(0),
            );
            break;
        }
        case 'autolyrics': {
            const enabled = await data.guild.get<boolean>(
                interaction.guildId,
                'settings.autolyrics',
            );
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('autolyrics:enable')
                    .setLabel(getLocaleString(guildLocaleCode, 'MISC.ENABLE'))
                    .setStyle(
                        enabled ? ButtonStyle.Success : ButtonStyle.Secondary,
                    )
                    .setDisabled(!!enabled),
                new ButtonBuilder()
                    .setCustomId('autolyrics:disable')
                    .setLabel(getLocaleString(guildLocaleCode, 'MISC.DISABLE'))
                    .setStyle(
                        !enabled ? ButtonStyle.Success : ButtonStyle.Secondary,
                    )
                    .setDisabled(!enabled),
            );
            current = `\`${
                enabled
                    ? getLocaleString(guildLocaleCode, 'MISC.ENABLED')
                    : getLocaleString(guildLocaleCode, 'MISC.DISABLED')
            }\``;
            break;
        }
        case 'smartqueue': {
            const enabled = await data.guild.get<boolean>(
                interaction.guildId,
                'settings.smartqueue',
            );
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('smartqueue:enable')
                    .setLabel(getLocaleString(guildLocaleCode, 'MISC.ENABLE'))
                    .setStyle(
                        enabled ? ButtonStyle.Success : ButtonStyle.Secondary,
                    )
                    .setDisabled(!!enabled),
                new ButtonBuilder()
                    .setCustomId('smartqueue:disable')
                    .setLabel(getLocaleString(guildLocaleCode, 'MISC.DISABLE'))
                    .setStyle(
                        !enabled ? ButtonStyle.Success : ButtonStyle.Secondary,
                    )
                    .setDisabled(!enabled),
            );
            current = `\`${
                enabled
                    ? getLocaleString(guildLocaleCode, 'MISC.ENABLED')
                    : getLocaleString(guildLocaleCode, 'MISC.DISABLED')
            }\``;
        }
    }
    return { current, embeds, actionRow };
}
