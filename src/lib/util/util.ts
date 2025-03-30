import type {
    MessageOptionsBuilderInputs,
    MessageOptionsBuilderOptions,
    QuaverChannels,
    QuaverClient,
    QuaverPlayer,
    QuaverSong,
    SettingsPage,
    SettingsPageOptions,
    WhitelistedFeatures,
} from '#src/lib/util/common.d.js';
import { data, locales, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import { Check, Language, queryOverrides } from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import type {
    APIEmbedField,
    APISelectMenuOption,
    BaseMessageOptions,
    ButtonInteraction,
    Interaction,
    MessageActionRowComponentBuilder,
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
import type { LocaleCompletionState, LyricsResponse } from './util.d.js';

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
 * Checks if a guild is whitelisted for a feature. Returns Permanent status if the feature does not have whitelist enabled.
 * @param guildId - The guild ID.
 * @param feature - The feature to check.
 * @returns Whether the guild is whitelisted.
 */
export async function getGuildFeatureWhitelisted(
    guildId: Snowflake,
    feature: WhitelistedFeatures,
): Promise<WhitelistStatus> {
    if (!settings.features[feature].whitelist) return WhitelistStatus.Permanent;
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
    if (track.requesterId === member.id) return RequesterStatus.Requester;
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
 * Returns all failed checks given a list of checks.
 * @param checks - The checks to run.
 * @param guildId - The guild ID.
 * @param member - The member to check.
 * @param interaction - The interaction, only required if checking for InteractionStarter.
 * @returns All failed checks.
 */
export async function getFailedChecks(
    checks: Check[],
    guildId: Snowflake,
    member: GuildMember & { client: QuaverClient },
    interaction?:
        | ButtonInteraction
        | StringSelectMenuInteraction
        | RoleSelectMenuInteraction
        | ModalSubmitInteraction,
): Promise<Check[]> {
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
                const player = await member.client.music.players.fetch(guildId);
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
                const player = await member.client.music.players.fetch(guildId);
                if (
                    player &&
                    member instanceof GuildMember &&
                    member?.voice.channelId !== player.voice.channelId
                ) {
                    failedChecks.push(check);
                }
                break;
            }
            case Check.InteractionStarter: {
                if (
                    interaction.message.interactionMetadata.user.id !==
                    member.id
                ) {
                    failedChecks.push(check);
                }
            }
        }
    }
    return failedChecks;
}

/**
 * Returns the Enable and Disable button components used in settings.
 * @param customId - The custom ID of the button.
 * @param enabled - Whether the setting is enabled.
 * @param guildLocaleCode - The guild's locale code.
 */
export function getButtonToggleComponents(
    customId: string,
    enabled: boolean,
    guildLocaleCode: keyof typeof Language,
): ButtonBuilder[] {
    return ['enable', 'disable'].map(
        (state): ButtonBuilder =>
            new ButtonBuilder()
                .setCustomId(`${customId}:${state}`)
                .setLabel(
                    getLocaleString(
                        guildLocaleCode,
                        `MISC.${state.toUpperCase()}`,
                    ),
                )
                .setStyle(
                    state === 'enable'
                        ? enabled
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                        : !enabled
                          ? ButtonStyle.Success
                          : ButtonStyle.Secondary,
                )
                .setDisabled(state === 'enable' ? enabled : !enabled),
    );
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
            sorted[sorted.length - 1].requesterId === copy[0].requesterId &&
            // and there is more than 1 requester in the queue
            new Set(copy.map((song): Snowflake => song.requesterId)).size >= 2
        ) {
            // deal with the next requester later, move them to the next position behind another requester
            copy.splice(
                copy.findIndex(
                    (element: QuaverSong): boolean =>
                        element.requesterId !== copy[0].requesterId,
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
 * Formats LyricResponse into a string.
 * @param json - The LyricsResponse object.
 * @param player - The QuaverPlayer object. (for marking position in lyrics)
 */
export function formatResponse(
    json: LyricsResponse,
    player?: QuaverPlayer,
): string | Error {
    return json.type === 'text'
        ? json.text
        : json.type === 'timed'
          ? json.lines
                .map((line): string =>
                    player?.position >= line.range.start &&
                    player?.position < line.range.end
                        ? `**__${line.line}__**`
                        : line.line,
                )
                .join('\n')
          : new Error('No results');
}

/**
 * Generates an array of APIEmbedField from the lyrics.
 * @param json - The LyricsResponse object.
 * @param lyrics - The lyrics to be used.
 * @returns An array of APIEmbedField.
 */
export function generateEmbedFieldsFromLyrics(
    json: LyricsResponse,
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
                name:
                    lyricsFields.length === 0
                        ? `${json.track.author} - ${json.track.title}`
                        : '​',
                value: previous,
            });
            return chunk;
        }
        if (index === array.length - 1) {
            lyricsFields.push({
                name:
                    lyricsFields.length === 0
                        ? `${json.track.author} - ${json.track.title}`
                        : '​',
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
                    name:
                        lyricsFields.length === 0
                            ? `${json.track.author} - ${json.track.title}`
                            : '​',
                    value: previous,
                });
                return line;
            }
            if (index === array.length - 1) {
                lyricsFields.push({
                    name:
                        lyricsFields.length === 0
                            ? `${json.track.author} - ${json.track.title}`
                            : '​',
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
): BaseMessageOptions {
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
    const opts: BaseMessageOptions = {
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
                new RoleSelectMenuBuilder()
                    .setCustomId('dj')
                    .setMinValues(0)
                    .setDefaultRoles(current),
            );
            break;
        }
        case 'autolyrics': {
            const enabled = await data.guild.get<boolean>(
                interaction.guildId,
                'settings.autolyrics',
            );
            actionRow.addComponents(
                ...getButtonToggleComponents(
                    'autolyrics',
                    !!enabled,
                    guildLocaleCode,
                ),
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
                ...getButtonToggleComponents(
                    'smartqueue',
                    !!enabled,
                    guildLocaleCode,
                ),
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

/**
 * Updates the query overrides based on the source managers.
 * @param sourceManagers - The source managers to use.
 */
export function updateQueryOverrides(sourceManagers: readonly string[]): void {
    queryOverrides.push(
        ...(sourceManagers.includes('http') ? ['https://', 'http://'] : []),
        ...(sourceManagers.includes('spotify') ? ['spsearch:', 'sprec:'] : []),
        ...(sourceManagers.includes('applemusic') ? ['amsearch:'] : []),
        ...(sourceManagers.includes('deezer')
            ? ['dzsearch:', 'dzisrc:', 'dzrec:']
            : []),
        ...(sourceManagers.includes('yandexmusic')
            ? ['ymsearch:', 'ymrec:']
            : []),
        ...(sourceManagers.includes('flowery-tts') ? ['ftts://'] : []),
        ...(sourceManagers.includes('vkmusic') ? ['vksearch:', 'vkrec:'] : []),
        ...(sourceManagers.includes('tidal') ? ['tdsearch:', 'tdrec:'] : []),
        ...(sourceManagers.includes('youtube')
            ? ['ytsearch:', 'ytmsearch:']
            : []),
        ...(sourceManagers.includes('soundcloud') ? ['scsearch:'] : []),
    );
}
