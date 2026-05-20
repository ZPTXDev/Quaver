import {
    type MessageOptionsBuilderInputs,
    type MessageOptionsBuilderOptions,
    MessageOptionsBuilderType,
    type QuaverClient,
    type TopLevelComponentBuilders,
} from '#src/lib';
import type { Initialized, QuaverGuild } from '#src/lib/guild';
import type { LoadResult } from 'lavalink-protocol';
import { data } from '#src/lib/data';
import type { ComponentInteractions } from '#src/lib/interactions';
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
 * @returns The markdown-formatted string.
 */
export function getTrackMarkdownLocaleString(track: Song): string {
    return track.info.title === track.info.uri
        ? track.info.uri
        : `[${track.info.title}](${track.info.uri})`;
}

/**
 * Searches for tracks using the configured source, falling back to other sources if no tracks are found.
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

    let result: LoadResult | null = null;
    for (const source of orderedSources) {
        const searchQuery = `${acceptableSources[source]}${query}`;
        try {
            result = await client.music.api.loadTracks(searchQuery);
            if (result) {
                const hasTracks =
                    (result.loadType === 'playlist' &&
                        Array.isArray(result.data?.tracks) &&
                        result.data.tracks.length > 0) ||
                    (result.loadType === 'track' && result.data) ||
                    (result.loadType === 'search' &&
                        Array.isArray(result.data) &&
                        result.data.length > 0);
                if (hasTracks) {
                    return result;
                }
            }
        } catch {
            // Ignore error and try the next source
        }
    }
    return result;
}
