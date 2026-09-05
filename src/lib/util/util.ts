import {
    type MessageOptionsBuilderInputs,
    type MessageOptionsBuilderOptions,
    MessageOptionsBuilderType,
    type QuaverClient,
    type TopLevelComponentBuilders,
} from '#src/lib';
import { data } from '#src/lib/data';
import type { Initialized, QuaverGuild } from '#src/lib/guild';
import type { ComponentInteractions } from '#src/lib/interactions';
import type { LocaleKey } from '#src/lib/locales';
import type { QuaverPlayer } from '#src/lib/music';
import {
    acceptableSources,
    Check,
    type QuaverChannels,
    type QuaverSong,
    queryOverrides,
    settings,
    sourceManagers as extSourceManagers,
} from '#src/lib/util';
import type { Song } from '@lavaclient/plugin-queue';
import {
    type BaseMessageOptions,
    ContainerBuilder,
    GuildMember,
    PermissionsBitField,
    resolveColor,
    type Snowflake,
    TextDisplayBuilder,
} from 'discord.js';
import type { LoadResult } from 'lavalink-protocol';
import type { LavaLyricsResponse } from '.';

type ColorTypes = 'success' | 'neutral' | 'warning' | 'error';

type LyricsResponse = {
    type: 'text' | 'timed';
    text?: string;
    lines?: { line: string; range: { start: number; end: number } }[];
    track: {
        title?: string;
        author?: string;
        album?: string;
        albumArt?: { url: string; height: number; width: number }[];
        override?: string;
    };
    source?: string;
};

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
 * Updates the query overrides based on the source managers.
 * @param sourceManagers - The source managers to use.
 */
export function updateQueryOverrides(sourceManagers: readonly string[]): void {
    queryOverrides.push(
        ...(sourceManagers.includes('quavermusic') ? ['qmsearch:'] : []),
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
 * @param showArtist - Whether to include the artist name.
 * @returns The markdown-formatted string.
 */
export function getTrackMarkdownLocaleString(track: Song, showArtist = false): string {
    if (track.info.title === track.info.uri) {
        return track.info.uri;
    }
    if (showArtist && track.info.author) {
        return `[${track.info.author} - ${track.info.title}](${track.info.uri})`;
    }
    return `[${track.info.title}](${track.info.uri})`;
}

/**
 * Splits a query into multiple URLs if it contains multiple links separated by spaces.
 * Returns an array of queries (either single query or multiple URLs).
 * @param query - The query string to check.
 * @returns An array of query strings.
 */
export function splitMultipleLinks(query: string): string[] {
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = query.match(urlPattern);

    // If we found multiple URLs and the query is essentially just URLs (with spaces)
    if (urls && urls.length > 1) {
        // Check if removing all URLs leaves only whitespace
        const remainingText = query.replace(urlPattern, '').trim();
        if (remainingText === '') {
            return urls;
        }
    }

    // Otherwise, return the original query as a single item
    return [query];
}

/**
 * Searches for tracks using the configured source, falling back to other sources if no tracks are found.
 * Searches up to 3 sources and combines results for search queries.
 * Results are ordered by internal source ordering, followed by each source's result order.
 * @param client - The QuaverClient instance.
 * @param guild - The QuaverGuild instance.
 * @param query - The search query.
 */
export async function searchTracks(
    client: QuaverClient,
    guild: QuaverGuild<Initialized>,
    query: string,
): Promise<LoadResult> {
    if (queryOverrides.some((q): boolean => query.startsWith(q))) {
        return await client.music.api.loadTracks(query);
    }

    const startingSource =
        ((await guild.settings.get('source')) as string) ??
        Object.keys(acceptableSources)[0];

    const sources = Object.keys(acceptableSources);
    const orderedSources = [
        startingSource,
        ...sources.filter((s): boolean => s !== startingSource),
    ].filter((s): boolean => !!acceptableSources[s]);

    const MAX_SOURCES = 3;
    const searchResults: Array<{ result: LoadResult; sourceIndex: number; originalIndex: number }> = [];
    let lastResult: LoadResult | null = null;

    for (let i = 0; i < Math.min(orderedSources.length, MAX_SOURCES); i++) {
        const source = orderedSources[i];
        const searchQuery = `${acceptableSources[source]}${query}`;
        try {
            const result = await client.music.api.loadTracks(searchQuery);
            lastResult = result;

            if (result) {
                // For playlists and tracks, return immediately (existing behavior)
                if (result.loadType === 'playlist' &&
                    Array.isArray(result.data?.tracks) &&
                    result.data.tracks.length > 0) {
                    return result;
                }

                if (result.loadType === 'track' && result.data) {
                    return result;
                }

                // For search results, collect them
                if (result.loadType === 'search' &&
                    Array.isArray(result.data) &&
                    result.data.length > 0) {
                    result.data.forEach((track: Song, index: number): void => {
                        searchResults.push({
                            result,
                            sourceIndex: i,
                            originalIndex: index,
                        });
                    });
                }
            }
        } catch {
            // Ignore error and try the next source
        }
    }

    // If we have search results from multiple sources, combine them
    if (searchResults.length > 0) {
        // Extract all tracks with metadata
        const tracksWithMetadata = searchResults.map((item): {
            track: Song;
            sourceIndex: number;
            originalIndex: number;
        } => {
            const track = (item.result as Extract<LoadResult, { loadType: 'search' }>).data[item.originalIndex];
            return {
                track,
                sourceIndex: item.sourceIndex,
                originalIndex: item.originalIndex,
            };
        });

        // Sort by: source index (asc), then original index (asc)
        // This preserves the internal source ordering, followed by each source's result order
        tracksWithMetadata.sort((a, b): number => {
            if (a.sourceIndex !== b.sourceIndex) {
                return a.sourceIndex - b.sourceIndex;
            }
            return a.originalIndex - b.originalIndex;
        });

        // Return combined results
        return {
            loadType: 'search',
            data: tracksWithMetadata.map((item): Song => item.track),
        };
    }

    return (
        lastResult ?? {
            loadType: 'error',
            data: {
                message: 'All search sources failed.',
                severity: 'common',
                cause: 'No source returned a result',
            },
        }
    );
}

/**
 * Formats a session log event into a markdown string.
 * @param log - The session log item.
 * @param locale - The locale function of the guild.
 * @returns The formatted string.
 */
export function formatSessionLog(
    log: {
        timestamp: number;
        action: string;
        userId: string | null;
        userTag: string | null;
        details: string | null;
    },
    locale: (key: LocaleKey, ...args: string[]) => string,
): string {
    const timeStr = `<t:${Math.floor(log.timestamp / 1000)}:T>`;
    let actorDisplay = `<@${settings.applicationId}>`;
    if (log.userId) {
        actorDisplay = `<@${log.userId}>`;
    } else if (log.userTag) {
        actorDisplay = `**${log.userTag}**`;
    }

    const localeKey = `CMD.SESSIONLOGS.MISC.EVENT.${log.action}`;
    let detailVal = log.details;
    if (detailVal === 'ENABLED' || detailVal === 'DISABLED') {
        detailVal = locale(`CMD.SESSIONLOGS.MISC.${detailVal}` as LocaleKey);
    } else if (log.action === 'LOOP' && detailVal) {
        try {
            detailVal = locale(
                `CMD.LOOP.OPTION.TYPE.OPTION.${detailVal.toUpperCase()}` as LocaleKey,
            );
        } catch {
            // fallback
        }
    }

    let actionText = '';
    try {
        actionText = locale(
            localeKey as LocaleKey,
            actorDisplay,
            detailVal ?? '',
        );
    } catch {
        actionText = `${actorDisplay} executed ${log.action} ${log.details ?? ''}`;
    }

    return `**${timeStr}** ${actionText}`;
}
