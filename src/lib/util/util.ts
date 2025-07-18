import type {
    MessageOptionsBuilderInputs,
    MessageOptionsBuilderOptions,
    QuaverChannels,
    QuaverClient,
    QuaverPlayer,
    QuaverSong,
    SettingsPage,
    SettingsPageFormatOptions,
    SettingsPageGenericOptions,
    SettingsPageOptions,
    SettingsPagePremiumOptions,
    TopLevelComponentBuilders,
    WhitelistedFeatures,
} from '#src/lib/util/common.d.js';
import { data, locales, MessageOptionsBuilderType } from '#src/lib/util/common.js';
import {
    acceptableSources,
    Check,
    Language,
    queryOverrides,
    settingsOptions,
    sourceManagers as extSourceManagers,
} from '#src/lib/util/constants.js';
import { settings } from '#src/lib/util/settings.js';
import { getAbsoluteFileURL } from '@zptxdev/zptx-lib';
import type {
    APISelectMenuOption,
    BaseMessageOptions,
    Interaction,
    MessageActionRowComponentBuilder,
    Snowflake,
} from 'discord.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    escapeMarkdown,
    GuildMember,
    PermissionsBitField,
    resolveColor,
    RoleSelectMenuBuilder,
    SectionBuilder,
    type SelectMenuComponentOptionData,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from 'discord.js';
import { readdirSync } from 'fs';
import { get } from 'lodash-es';
import type { ColorTypes, LocaleCompletionState, LyricsResponse } from './util.d.js';
import type { ComponentInteractions } from '#src/events/interactionCreate.d.js';
import type { Song } from '@lavaclient/plugin-queue';

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
 * Returns the Enable and Disable button components used in settings.
 * @param customId - The custom ID of the button.
 * @param enabled - Whether the setting is enabled.
 * @param guildLocaleCode - The guild's locale code.
 * @returns An array of ButtonBuilder components for enabling and disabling the setting.
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
 * @param guildId - The guild ID.
 * @param guildLocaleCode - The guild's locale code.
 * @returns A Promise of a SettingsPagePremiumOptions object.
 */
async function buildSettingsPagePremiumOptions(guildId: Snowflake, guildLocaleCode: keyof typeof Language): Promise<SettingsPagePremiumOptions> {
    const components = [
        new ButtonBuilder()
            .setLabel(
                getLocaleString(guildLocaleCode, 'MISC.GET_PREMIUM'),
            )
            .setStyle(ButtonStyle.Link)
            .setURL(settings.premiumURL),
    ];
    const whitelisted = {
        stay: await data.guild.get<number>(guildId, 'features.stay.whitelisted'),
        autolyrics: await data.guild.get<number>(guildId, 'features.autolyrics.whitelisted'),
        smartqueue: await data.guild.get<number>(guildId, 'features.smartqueue.whitelisted'),
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
    return { components, features };
}

/**
 * (For internal use) Returns a settings page language options object.
 * @param guildLocaleCode - The guild's locale code.
 * @returns A SettingsPageGenericOptions object.
 */
function buildSettingsPageLanguageOptions(
    guildLocaleCode: keyof typeof Language,
): SettingsPageGenericOptions {
    const components = [
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
    ];
    return { components };
}

/**
 * (For internal use) Returns a settings page format options object.
 * @param current - The current format setting.
 * @param userId - The user ID.
 * @param guildId - The guild ID.
 * @param guildLocaleCode - The guild's locale code.
 * @returns A SettingsPageFormatOptions object.
 */
function buildSettingsPageFormatOptions(
    current: string,
    userId: Snowflake,
    guildId: Snowflake,
    guildLocaleCode: keyof typeof Language,
): SettingsPageFormatOptions {
    const exampleId = 'dQw4w9WgXcQ';
    const emoji = settings.emojis?.youtube ?? '';
    const components = [
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
    ];
    const containers = [
        current === 'simple'
            ? new ContainerBuilder({
                components: [
                    new TextDisplayBuilder()
                        .setContent(
                            `${getLocaleString(
                                guildLocaleCode,
                                'MUSIC.PLAYER.PLAYING.NOW.SIMPLE.TEXT',
                                `[${getLocaleString(
                                    guildLocaleCode,
                                    'CMD.SETTINGS.MISC.FORMAT.EXAMPLE.SIMPLE',
                                )}](https://www.youtube.com/watch?v=${exampleId})`,
                                '4:20',
                            )}\n${getLocaleString(guildLocaleCode, 'MUSIC.PLAYER.PLAYING.NOW.SIMPLE.SOURCE')}: ${emoji ? `${emoji} ` : ''}**${getLocaleString(guildLocaleCode, 'MISC.SOURCES.YOUTUBE')}** ─ ${getLocaleString(
                                guildLocaleCode,
                                'MISC.ADDED_BY',
                                userId,
                            )}`,
                        )
                        .toJSON(),
                    ...(settings.features.web.dashboardURL
                        ? [
                            new SeparatorBuilder().toJSON(),
                            new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setURL(
                                            `${settings.features.web.dashboardURL.replace(
                                                /\/+$/,
                                                '',
                                            )}/guild/${guildId}`,
                                        )
                                        .setStyle(ButtonStyle.Link)
                                        .setLabel(
                                            getLocaleString(
                                                guildLocaleCode,
                                                'MISC.DASHBOARD',
                                            ),
                                        ),
                                )
                                .toJSON(),
                        ]
                        : []),
                ],
            }).setAccentColor(resolveColor(settings.colors.neutral))
            : new ContainerBuilder({
                components: [
                    new SectionBuilder({
                        components: [
                            new TextDisplayBuilder()
                                .setContent(
                                    getLocaleString(
                                        guildLocaleCode,
                                        'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TITLE',
                                    ),
                                )
                                .toJSON(),
                            new TextDisplayBuilder()
                                .setContent(
                                    `${getLocaleString(
                                        guildLocaleCode,
                                        'MUSIC.PLAYER.PLAYING.NOW.DETAILED.TEXT',
                                        `[Rick Astley - ${getLocaleString(guildLocaleCode, 'CMD.SETTINGS.MISC.FORMAT.EXAMPLE.DETAILED')}](https://www.youtube.com/watch?v=${exampleId})`,
                                        '4:20',
                                    )}\n${getLocaleString(guildLocaleCode, 'MUSIC.PLAYER.PLAYING.NOW.DETAILED.SOURCE')}: ${emoji ? `${emoji} ` : ''}**${getLocaleString(guildLocaleCode, 'MISC.SOURCES.YOUTUBE')}** ─ ${getLocaleString(
                                        guildLocaleCode,
                                        'MISC.ADDED_BY',
                                        userId,
                                    )}`,
                                )
                                .toJSON(),
                            new TextDisplayBuilder()
                                .setContent(
                                    getLocaleString(
                                        guildLocaleCode,
                                        'MUSIC.PLAYER.PLAYING.NOW.DETAILED.REMAINING',
                                        '1',
                                    ),
                                )
                                .toJSON(),
                        ],
                        accessory: new ThumbnailBuilder()
                            .setURL(
                                `https://i.ytimg.com/vi/${exampleId}/hqdefault.jpg`,
                            )
                            .toJSON(),
                    }).toJSON(),
                    ...(settings.features.web.dashboardURL
                        ? [
                            new SeparatorBuilder().toJSON(),
                            new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setURL(
                                            `${settings.features.web.dashboardURL.replace(
                                                /\/+$/,
                                                '',
                                            )}/guild/${guildId}`,
                                        )
                                        .setStyle(ButtonStyle.Link)
                                        .setLabel(
                                            getLocaleString(
                                                guildLocaleCode,
                                                'MISC.DASHBOARD',
                                            ),
                                        ),
                                )
                                .toJSON(),
                        ]
                        : []),
                ],
            }),
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
    guildLocaleCode: keyof typeof Language,
): SettingsPageGenericOptions {
    const components = [
        new StringSelectMenuBuilder().setCustomId('source').addOptions(
            Object.keys(acceptableSources).map(
                (source: string): APISelectMenuOption => ({
                    label: getLocaleString(
                        guildLocaleCode,
                        `MISC.SOURCES.${source.toUpperCase()}`,
                    ),
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
 * @param guildLocaleCode - The guild's locale code.
 * @param option - The option to display.
 * @returns A Promise of a SettingsPage object.
 */
export async function buildSettingsPage(
    interaction: Interaction,
    guildLocaleCode: keyof typeof Language,
    option: SettingsPageOptions,
): Promise<SettingsPage> {
    let current: string;
    const containers: ContainerBuilder[] = [];
    const baseContainer = new ContainerBuilder();
    const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
    switch (option) {
        case 'premium': {
            current = '';
            const { components, features } = await buildSettingsPagePremiumOptions(
                interaction.guildId,
                guildLocaleCode,
            );
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
            const { components } = buildSettingsPageLanguageOptions(guildLocaleCode);
            actionRow.addComponents(...components);
            break;
        }
        case 'notifyin247': {
            const enabled =
                (await data.guild.get<boolean>(
                    interaction.guildId,
                    'settings.notifyin247',
                )) ?? true;
            actionRow.addComponents(
                ...getButtonToggleComponents(
                    'notifyin247',
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
        case 'format': {
            current =
                (await data.guild.get<string>(
                    interaction.guildId,
                    'settings.format',
                )) ?? 'simple';
            const { components, containers: container } = buildSettingsPageFormatOptions(
                current,
                interaction.user.id,
                interaction.guildId,
                guildLocaleCode,
            );
            actionRow.addComponents(...components);
            containers.push(...container);
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
            let raw = undefined;
            if (!current) {
                current = `\`${getLocaleString(
                    guildLocaleCode,
                    'MISC.NONE',
                )}\``;
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
                (await data.guild.get<string>(
                    interaction.guildId,
                    'settings.source',
                )) ?? Object.keys(acceptableSources)[0];
            const { components } = buildSettingsPageSourceOptions(
                current,
                guildLocaleCode,
            );
            actionRow.addComponents(...components);
            current = `\`${getLocaleString(
                guildLocaleCode,
                `MISC.SOURCES.${current.toUpperCase()}`,
            )}\``;
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
    baseContainer
        .spliceComponents(
            0,
            0,
            new TextDisplayBuilder().setContent(
                `${getLocaleString(
                    guildLocaleCode,
                    'CMD.SETTINGS.RESPONSE.HEADER',
                    interaction.guild.name,
                )}\n\n**${getLocaleString(
                    guildLocaleCode,
                    `CMD.SETTINGS.MISC.${option.toUpperCase()}.NAME`,
                )}** ─ ${getLocaleString(
                    guildLocaleCode,
                    `CMD.SETTINGS.MISC.${option.toUpperCase()}.DESCRIPTION`,
                )}${
                    current
                        ? `\n> ${getLocaleString(
                            guildLocaleCode,
                            'MISC.CURRENT',
                        )}: ${current}`
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
                                label: getLocaleString(
                                    guildLocaleCode,
                                    `CMD.SETTINGS.MISC.${opt.toUpperCase()}.NAME`,
                                ),
                                description: getLocaleString(
                                    guildLocaleCode,
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
