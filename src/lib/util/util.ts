import type { Song } from '@lavaclient/plugin-queue';
import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import {
    ActionRowBuilder,
    type APISelectMenuOption,
    type BaseMessageOptions,
    type ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    escapeMarkdown,
    type Guild,
    GuildMember,
    type Interaction,
    type MessageActionRowComponentBuilder,
    PermissionsBitField,
    resolveColor,
    RoleSelectMenuBuilder,
    SectionBuilder,
    type SelectMenuComponentOptionData,
    SeparatorBuilder,
    type Snowflake,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from 'discord.js';
import { get } from 'lodash-es';
import { readdirSync } from 'node:fs';
import type { ColorTypes, LavaLyricsResponse, LocaleCompletionState, LyricsResponse } from './util.d';
import type { ComponentInteractions } from '#src/lib';
import { type Initialized, QuaverGuild, type WhitelistedFeatures } from '#src/lib/guild';
import type { QuaverPlayer } from '#src/lib/music';
import { data, locales, MessageOptionsBuilderType } from '#src/lib/util/common';
import type {
    MessageOptionsBuilderInputs,
    MessageOptionsBuilderOptions,
    QuaverChannels,
    QuaverClient,
    QuaverSong,
    SettingsPage,
    SettingsPageFormatOptions,
    SettingsPageGenericOptions,
    SettingsPageOptions,
    SettingsPagePremiumOptions,
    TopLevelComponentBuilders,
} from '#src/lib/util/common.d';
import {
    acceptableSources,
    Check,
    Language,
    queryOverrides,
    settingsOptions,
    sourceManagers as extSourceManagers,
} from '#src/lib/util/constants';
import { settings } from '#src/lib/util/settings';

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
    interaction?: ComponentInteractions,
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
                const player =
                    await member?.client.music.players.fetch(guildId);
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

export function formatLavaLyricsResponse(
    json: LavaLyricsResponse,
    player?: QuaverPlayer,
): string | Error {
    if (json.lines?.length === 0 && !json.text) {
        return new Error('No results');
    }
    // text has better formatting than lines, so prefer it if available
    if (json.text) return json.text;
    return json.lines
        .map((line): string =>
            player?.position >= line.timestamp &&
            (line.duration
                ? player.position < line.timestamp + line.duration
                : true)
                ? `**__${line.line}__**`
                : line.line,
        )
        .join('\n');
}

/**
 * Returns a MessageCreateOptions object.
 * @param inputData - The data to be used. Can be a string, ContainerBuilder, or an array of either.
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
    const color: ColorTypes = MessageOptionsBuilderType[
        type
    ].toLowerCase() as ColorTypes;
    const containerData = messageData.map((msg): TopLevelComponentBuilders => {
        if (typeof msg === 'string') {
            return new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(msg),
                )
                .setAccentColor(resolveColor(settings.colors[color]));
        }
        if (msg instanceof ContainerBuilder && !msg.data.accent_color) {
            return msg.setAccentColor(resolveColor(settings.colors[color]));
        }
        return msg;
    });
    if (!components) components = [];
    components.unshift(...containerData);
    if (!files) files = [];
    return { components, files };
}

/**
 * (For internal use) Returns a settings page premium options object.
 * @param guild - The guild.
 * @returns A Promise of a SettingsPagePremiumOptions object.
 */
async function buildSettingsPagePremiumOptions(
    guild: QuaverGuild<Initialized> & Guild,
): Promise<SettingsPagePremiumOptions> {
    const components = [
        guild.builders
            .buttonLocale('MISC.GET_PREMIUM')
            .setStyle(ButtonStyle.Link)
            .setURL(settings.premiumURL),
    ];
    const whitelisted = {
        stay: await guild.features.get<number>('stay.whitelisted'),
        autolyrics: await guild.features.get<number>('autolyrics.whitelisted'),
        smartqueue: await guild.features.get<number>('smartqueue.whitelisted'),
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
                `**${guild.locale(
                    `CMD.SETTINGS.MISC.PREMIUM.FEATURES.${key.toUpperCase()}`,
                )}** ─ ${
                    !whitelisted[key]
                        ? guild.locale(
                              'CMD.SETTINGS.MISC.PREMIUM.DISPLAY.LOCKED.DEFAULT',
                          )
                        : whitelisted[key] !== -1 &&
                            Date.now() > whitelisted[key]
                          ? guild.locale(
                                'CMD.SETTINGS.MISC.PREMIUM.DISPLAY.LOCKED.EXPIRED',
                                Math.floor(whitelisted[key] / 1000).toString(),
                            )
                          : whitelisted[key] === -1
                            ? guild.locale(
                                  'CMD.SETTINGS.MISC.PREMIUM.DISPLAY.UNLOCKED.PERMANENT',
                              )
                            : guild.locale(
                                  'CMD.SETTINGS.MISC.PREMIUM.DISPLAY.UNLOCKED.TEMPORARY',
                                  Math.floor(
                                      whitelisted[key] / 1000,
                                  ).toString(),
                              )
                }`,
        );
    return { components, features };
}

/**
 * (For internal use) Returns a settings page language options object.
 * @param guild - The guild.
 * @returns A SettingsPageGenericOptions object.
 */
function buildSettingsPageLanguageOptions(
    guild: QuaverGuild<Initialized> & Guild,
): SettingsPageGenericOptions {
    const components = [
        new StringSelectMenuBuilder().setCustomId('language').addOptions(
            readdirSync(
                getAbsoluteFileURL(import.meta.url, [
                    '..',
                    '..',
                    '..',
                    'locales',
                ]),
            ).map(
                (file: keyof typeof Language): APISelectMenuOption => ({
                    label: `${Language[file] ?? 'Unknown'} (${file})`,
                    value: file,
                    default:
                        file === (guild.localeCode as keyof typeof Language),
                }),
            ),
        ),
    ];
    return { components };
}

/**
 * (For internal use) Returns a settings page format options object.
 * @param current - The current format setting.
 * @param userId - The user ID.
 * @param guild - The guild.
 * @returns A SettingsPageFormatOptions object.
 */
function buildSettingsPageFormatOptions(
    current: string,
    userId: Snowflake,
    guild: QuaverGuild<Initialized> & Guild,
): SettingsPageFormatOptions {
    const exampleId = 'dQw4w9WgXcQ';
    const emoji = settings.emojis?.youtube ?? '';
    const components = [
        guild.builders
            .buttonLocale('CMD.SETTINGS.MISC.FORMAT.OPTIONS.SIMPLE')
            .setStyle(
                current === 'simple'
                    ? ButtonStyle.Success
                    : ButtonStyle.Secondary,
            )
            .setDisabled(current === 'simple')
            .setCustomId('format:simple'),
        guild.builders
            .buttonLocale('CMD.SETTINGS.MISC.FORMAT.OPTIONS.DETAILED')
            .setStyle(
                current === 'detailed'
                    ? ButtonStyle.Success
                    : ButtonStyle.Secondary,
            )
            .setDisabled(current === 'detailed')
            .setCustomId('format:detailed'),
    ];
    const containers = [
        current === 'simple'
            ? new ContainerBuilder()
                  .addTextDisplayComponents(
                      new TextDisplayBuilder().setContent(
                          `${guild.locale(
                              'MUSIC.PLAYER.PLAYING.NOW.SIMPLE.TEXT',
                              `[${guild.locale(
                                  'CMD.SETTINGS.MISC.FORMAT.EXAMPLE.SIMPLE',
                              )}](https://www.youtube.com/watch?v=${exampleId})`,
                              '4:20',
                          )}\n${guild.locale('MUSIC.PLAYER.PLAYING.NOW.SIMPLE.SOURCE')}: ${emoji ? `${emoji} ` : ''}**${guild.locale('MISC.SOURCES.YOUTUBE')}** ─ ${guild.locale(
                              'MISC.ADDED_BY',
                              userId,
                          )}`,
                      ),
                  )
                  .addSeparatorComponents(
                      ...(settings.features.web.dashboardURL
                          ? [new SeparatorBuilder()]
                          : []),
                  )
                  .addActionRowComponents(
                      ...(settings.features.web.dashboardURL
                          ? [
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                    guild.builders
                                        .buttonLocale('MISC.DASHBOARD')
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(
                                            `${settings.features.web.dashboardURL.replace(
                                                /\/+$/,
                                                '',
                                            )}/guild/${guild.id}`,
                                        ),
                                ),
                            ]
                          : []),
                  )
                  .setAccentColor(resolveColor(settings.colors.neutral))
            : new ContainerBuilder()
                  .addSectionComponents(
                      new SectionBuilder()
                          .addTextDisplayComponents(
                              guild.builders.textDisplayLocale(
                                  'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE',
                              ),
                              new TextDisplayBuilder().setContent(
                                  `${guild.locale(
                                      'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TEXT',
                                      `[Rick Astley - ${guild.locale('CMD.SETTINGS.MISC.FORMAT.EXAMPLE.DETAILED')}](https://www.youtube.com/watch?v=${exampleId})`,
                                      '4:20',
                                  )}\n${guild.locale('MUSIC.PLAYER.PLAYING.NOW.DETAILED.SOURCE')}: ${emoji ? `${emoji} ` : ''}**${guild.locale('MISC.SOURCES.YOUTUBE')}** ─ ${guild.locale(
                                      'MISC.ADDED_BY',
                                      userId,
                                  )}`,
                              ),
                              guild.builders.textDisplayLocale(
                                  'MUSIC.PLAYER.PLAYING.NOW.DETAILED.REMAINING',
                                  '1',
                              ),
                          )
                          .setThumbnailAccessory(
                              new ThumbnailBuilder().setURL(
                                  `https://i.ytimg.com/vi/${exampleId}/hqdefault.jpg`,
                              ),
                          ),
                  )
                  .addSeparatorComponents(
                      ...(settings.features.web.dashboardURL
                          ? [new SeparatorBuilder()]
                          : []),
                  )
                  .addActionRowComponents(
                      new ActionRowBuilder<ButtonBuilder>().addComponents(
                          guild.builders
                              .buttonLocale('MISC.DASHBOARD')
                              .setStyle(ButtonStyle.Link)
                              .setURL(
                                  `${settings.features.web.dashboardURL.replace(
                                      /\/+$/,
                                      '',
                                  )}/guild/${guild.id}`,
                              ),
                      ),
                  ),
    ];
    return { components, containers };
}

/**
 * (For internal use) Returns a settings page DJ options object.
 * @param raw - The raw role ID.
 * @returns A SettingsPageGenericOptions object.
 */
function buildSettingsPageDJOptions(
    raw: Snowflake | undefined,
): SettingsPageGenericOptions {
    const components = [
        new RoleSelectMenuBuilder()
            .setCustomId('dj')
            .setMinValues(0)
            .setDefaultRoles(raw ? [raw] : []),
    ];
    return { components };
}

function buildSettingsPageSourceOptions(
    current: string,
    guild: QuaverGuild<Initialized> & Guild,
): SettingsPageGenericOptions {
    const components = [
        new StringSelectMenuBuilder().setCustomId('source').addOptions(
            Object.keys(acceptableSources).map(
                (source: string): APISelectMenuOption => ({
                    label: guild.locale(`MISC.SOURCES.${source.toUpperCase()}`),
                    value: source,
                    default: current === source,
                }),
            ),
        ),
    ];
    return { components };
}

/**
 * Returns a SettingsPage object.
 * @param interaction - The interaction to use for context.
 * @param option - The option to display.
 * @returns A Promise of a SettingsPage object.
 */
export async function buildSettingsPage(
    interaction: Interaction,
    option: SettingsPageOptions,
): Promise<SettingsPage> {
    const guild = await QuaverGuild.wrap(interaction.guild);
    const guildLocaleCode = guild.localeCode as keyof typeof Language;
    let current: string;
    const containers: ContainerBuilder[] = [];
    const baseContainer = new ContainerBuilder();
    const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
    switch (option) {
        case 'premium': {
            current = '';
            const { components, features } =
                await buildSettingsPagePremiumOptions(guild);
            actionRow.addComponents(...components);
            baseContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(features.join('\n')),
            );
            break;
        }
        case 'language': {
            current = `\`${
                Language[guildLocaleCode] ?? 'Unknown'
            } (${guildLocaleCode})\``;
            const { components } = buildSettingsPageLanguageOptions(guild);
            actionRow.addComponents(...components);
            break;
        }
        case 'notifyin247': {
            const enabled =
                (await guild.settings.get<boolean>('notifyin247')) ?? true;
            actionRow.addComponents(
                ...guild.builders.buttonToggles('notifyin247', !!enabled),
            );
            current = `\`${
                enabled
                    ? guild.locale('MISC.ENABLED')
                    : guild.locale('MISC.DISABLED')
            }\``;
            break;
        }
        case 'format': {
            current = (await guild.settings.get<string>('format')) ?? 'simple';
            const { components, containers: container } =
                buildSettingsPageFormatOptions(
                    current,
                    interaction.user.id,
                    guild,
                );
            actionRow.addComponents(...components);
            containers.push(...container);
            current = `\`${guild.locale(
                `CMD.SETTINGS.MISC.FORMAT.OPTIONS.${current.toUpperCase()}`,
            )}\``;
            break;
        }
        case 'dj': {
            current = await guild.settings.get<Snowflake>('dj');
            let raw = undefined;
            if (!current) {
                current = `\`${guild.locale('MISC.NONE')}\``;
            } else {
                raw = current;
                current = `<@&${current}>`;
            }
            const { components } = buildSettingsPageDJOptions(raw);
            actionRow.addComponents(...components);
            break;
        }
        case 'source': {
            current =
                (await guild.settings.get<string>('source')) ??
                Object.keys(acceptableSources)[0];
            const { components } = buildSettingsPageSourceOptions(
                current,
                guild,
            );
            actionRow.addComponents(...components);
            current = `\`${guild.locale(
                `MISC.SOURCES.${current.toUpperCase()}`,
            )}\``;
            break;
        }
        case 'autolyrics': {
            const enabled = await guild.settings.get<boolean>('autolyrics');
            actionRow.addComponents(
                ...guild.builders.buttonToggles('autolyrics', !!enabled),
            );
            current = `\`${
                enabled
                    ? guild.locale('MISC.ENABLED')
                    : guild.locale('MISC.DISABLED')
            }\``;
            break;
        }
        case 'smartqueue': {
            const enabled = await guild.settings.get<boolean>('smartqueue');
            actionRow.addComponents(
                ...guild.builders.buttonToggles('smartqueue', !!enabled),
            );
            current = `\`${
                enabled
                    ? guild.locale('MISC.ENABLED')
                    : guild.locale('MISC.DISABLED')
            }\``;
        }
    }
    baseContainer
        .spliceComponents(
            0,
            0,
            new TextDisplayBuilder().setContent(
                `${guild.locale(
                    'CMD.SETTINGS.RESPONSE.HEADER',
                    guild.name,
                )}\n\n**${guild.locale(
                    `CMD.SETTINGS.MISC.${option.toUpperCase()}.NAME`,
                )}** ─ ${guild.locale(
                    `CMD.SETTINGS.MISC.${option.toUpperCase()}.DESCRIPTION`,
                )}${
                    current
                        ? `\n> ${guild.locale('MISC.CURRENT')}: ${current}`
                        : ''
                }`,
            ),
        )
        .addActionRowComponents(actionRow)
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('settings')
                    .addOptions(
                        settingsOptions.map(
                            (opt): SelectMenuComponentOptionData => ({
                                label: guild.locale(
                                    `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`,
                                ),
                                description: guild.locale(
                                    `CMD.SETTINGS.MISC.${opt.toUpperCase()}.DESCRIPTION`,
                                ),
                                value: opt,
                                default: opt === option,
                            }),
                        ),
                    ),
            ),
        );
    containers.unshift(baseContainer);
    return { current, containers, actionRow };
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

/**
 * Updates the source managers.
 * @param sourceManagers - The source managers to use.
 */
export function updateSourceManagers(sourceManagers: readonly string[]): void {
    extSourceManagers.push(...sourceManagers);
}

/**
 * Updates the acceptable sources.
 * @param sourceManagers - The source managers to use.
 */
export function updateAcceptableSources(
    sourceManagers: Record<string, string>,
): void {
    for (const [key, value] of Object.entries(sourceManagers)) {
        acceptableSources[key] = value;
    }
}

/**
 * Cleans a URI for use in markdown.
 * @param uri - The URI to clean.
 * @returns The cleaned URI. If not a valid URI, returns the input.
 */
export function cleanURIForMarkdown(uri: string): string {
    return uri.match(/^(https?:\/\/.*?)(\/)?$/)
        ? uri.replace(/^https?:\/\//, '').replace(/\/$/, '')
        : uri;
}

/**
 * Returns the markdown-formatted locale string for a track.
 * @param track - The track to format.
 * @returns The markdown-formatted string.
 */
export function getTrackMarkdownLocaleString(track: Song): string {
    return track.info.title === track.info.uri
        ? track.info.uri
        : `[${track.info.title}](${track.info.uri})`;
}
